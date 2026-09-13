"""Fetch public concert facts into a static snapshot. Python 3.11+; see requirements.txt.

No user preferences or credentials are included in the output. Venue adapters use
explicitly configured public calendars; Ticketmaster uses TICKETMASTER_API_KEY.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from html import unescape
import json
import math
import os
from pathlib import Path
import re
import time
import unicodedata
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse, parse_qs, unquote, quote
from urllib.request import Request, urlopen, build_opener, HTTPCookieProcessor
from zoneinfo import ZoneInfo
from collector_credentials import load_ticketmaster_key, load_tickster_key

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "MagicCompass/0.1 (personal concert calendar; https://honkstonk.github.io/)"


def name_key(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def safe_url(value):
    parsed = urlparse(str(value or ""))
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def fetch(url, headers=None, data=None):
    """Bounded retries and response sizes; never print URLs containing credentials."""
    for attempt in range(3):
        time.sleep(0.55)  # Below both published Ticketmaster per-second limits.
        try:
            with urlopen(Request(url, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/html", **(headers or {})}), timeout=25) as response:
                content = response.read(4_000_001)
                if len(content) > 4_000_000:
                    raise ValueError("Source response is unexpectedly large")
                return content.decode("utf-8")
        except HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 2:
                delay = error.headers.get("Retry-After", "2")
                time.sleep(min(int(delay) if delay.isdigit() else 2, 20) * (attempt + 1))
                continue
            raise RuntimeError(f"Source returned HTTP {error.code}") from None
        except (URLError, TimeoutError):
            if attempt == 2:
                raise RuntimeError("Source request timed out or could not connect") from None
    raise RuntimeError("Source request failed")


def fetch_binary(url, maximum=40_000_000):
    """Download a bounded binary source without ever logging its signed URL."""
    for attempt in range(3):
        time.sleep(0.55)
        try:
            with urlopen(Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,application/gzip"}), timeout=60) as response:
                content = response.read(maximum + 1)
                if len(content) > maximum:
                    raise ValueError("Source response is unexpectedly large")
                return content
        except HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 2:
                delay = error.headers.get("Retry-After", "2")
                time.sleep(min(int(delay) if delay.isdigit() else 2, 20) * (attempt + 1))
                continue
            raise RuntimeError(f"Source returned HTTP {error.code}") from None
        except (URLError, TimeoutError):
            if attempt == 2:
                raise RuntimeError("Source request timed out or could not connect") from None
    raise RuntimeError("Source request failed")


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.links, self.json_ld, self.text = [], [], []
        self.script = False
        self.capture = False
        self.buffer = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script":
            self.script = True
            self.capture = attrs.get("type", "").lower() == "application/ld+json"
            self.buffer = []

    def handle_endtag(self, tag):
        if tag == "script":
            if self.capture:
                self.json_ld.append(json.loads("".join(self.buffer)))
            self.script = self.capture = False

    def handle_data(self, data):
        if self.capture:
            self.buffer.append(data)
        elif not self.script and data.strip():
            self.text.append(data.strip())


def objects(value):
    if isinstance(value, list):
        for item in value:
            yield from objects(item)
    elif isinstance(value, dict):
        yield value
        for item in value.values():
            if isinstance(item, (dict, list)):
                yield from objects(item)


def status_name(value):
    text = str(value).lower()
    if "cancel" in text:
        return "cancelled"
    if "postpon" in text:
        return "postponed"
    if "reschedul" in text:
        return "rescheduled"
    return "scheduled"


def ticket_price(amount, currency):
    if amount is None or isinstance(amount, bool) or not isinstance(currency, str):
        return None
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return None
    currency = currency.strip().upper()
    if not math.isfinite(amount) or amount < 0 or amount > 10_000_000 or not re.fullmatch(r"[A-Z]{3}", currency):
        return None
    return {"amount": int(amount) if amount.is_integer() else amount, "currency": currency}


def cheapest_offer(offers, amount_keys=("lowPrice", "price")):
    offers = offers if isinstance(offers, list) else [offers]
    prices = []
    for offer in offers:
        if not isinstance(offer, dict):
            continue
        amount = next((offer.get(key) for key in amount_keys if offer.get(key) is not None), None)
        price = ticket_price(amount, offer.get("priceCurrency") or offer.get("currency"))
        if price:
            prices.append(price)
    currencies = {price["currency"] for price in prices}
    return min(prices, key=lambda price: price["amount"]) if len(currencies) == 1 else None


def ticketmaster_selection_price(data):
    if not isinstance(data, dict) or data.get("maintenance") or not data.get("hasEnabledTicketTypes"):
        return None
    amounts = []
    for ticket_type in data.get("ticketTypes", []):
        if (not isinstance(ticket_type, dict) or ticket_type.get("locked") or ticket_type.get("membershipLocked")
                or ticket_type.get("upsell") or not any(quantity > 0 for quantity in ticket_type.get("quantities", []) if isinstance(quantity, int))):
            continue
        for price in ticket_type.get("prices", []):
            if not isinstance(price, dict):
                continue
            parts = [price.get("faceValue"), price.get("serviceFeeChargesValue", 0), price.get("upsellFeeChargesValue", 0)]
            if any(value is None or isinstance(value, bool) for value in parts):
                continue
            try:
                amount = sum(float(value) for value in parts)
            except (TypeError, ValueError):
                continue
            if math.isfinite(amount) and amount >= 0:
                amounts.append(amount)
    return ticket_price(min(amounts), "SEK") if amounts else None


def enrich_ticketmaster_storefront_prices(events, opener=None):
    """Add the all-in per-ticket price shown by ticketmaster.se when available."""
    candidates = {}
    for event in events:
        if event.get("ticketPrice"):
            continue
        match = re.search(r"/(\d{6,})(?:[/?#]|$)", event.get("url", ""))
        if match:
            candidates[match.group(1)] = event
    if not candidates:
        return events
    own_opener = opener is None
    opener = opener or build_opener(HTTPCookieProcessor(CookieJar()))
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
    }
    try:
        opener.open(Request("https://www.ticketmaster.se/", headers=headers), timeout=20).read()
    except (HTTPError, URLError, TimeoutError, OSError):
        return events
    for event_id, event in candidates.items():
        try:
            request_headers = {**headers, "Accept": "application/json", "Referer": event["url"]}
            response = opener.open(Request(f"https://www.ticketmaster.se/api/ticketselection/{event_id}", headers=request_headers), timeout=20)
            price = ticketmaster_selection_price(json.loads(response.read().decode("utf-8")))
            if price:
                event["ticketPrice"] = price
        except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError):
            pass
        if own_opener:
            time.sleep(0.1)
    return events


def normalize_venue_event(raw, page, url, source, now):
    start = raw.get("startDate")
    if not start:
        local_date, local_time, date_time = None, None, None
    else:
        parsed = datetime.fromisoformat(start.replace("Z", "+00:00"))
        local_date = parsed.date().isoformat()
        local_time = parsed.strftime("%H:%M") if "T" in start else None
        date_time = parsed.astimezone(timezone.utc).isoformat() if parsed.tzinfo else None
    time_kind = "listed"
    # Hovet's JSON-LD start can be doors. Prefer a separately labelled show time
    # only on the same evening; never infer an overnight date or unlisted time.
    text = " ".join(page.text)
    doors = re.search(r"Entréer öppnar\s+(\d{2}:\d{2})", text)
    show = re.search(r"Showstart\s+(\d{2}:\d{2})", text)
    if doors and doors.group(1) == local_time:
        time_kind = "doors"
        if show and show.group(1) >= local_time:
            local_time, time_kind = show.group(1), "start"
            parsed = parsed.replace(hour=int(local_time[:2]), minute=int(local_time[3:]))
            date_time = parsed.astimezone(timezone.utc).isoformat() if parsed.tzinfo else None
    performer = raw.get("performer", [])
    performer = performer if isinstance(performer, list) else [performer]
    artists = [item["name"] for item in performer if isinstance(item, dict) and item.get("name")]
    event_id = source["id"] + ":" + urlparse(url).path.rstrip("/").split("/")[-1]
    offers = raw.get("offers", {})
    offer_list = offers if isinstance(offers, list) else [offers]
    ticket_url = next((offer.get("url") for offer in offer_list if isinstance(offer, dict) and safe_url(offer.get("url"))), None)
    lowest_price = cheapest_offer(offers)
    return {
        "id": event_id, "sourceIds": [event_id], "providers": [source["id"]],
        "title": raw["name"], "artists": artists,
        "styles": sorted({style for artist in artists for style in source.get("artistStyles", {}).get(name_key(artist), [])}),
        "venue": source["venue"], "localDate": local_date, "localTime": local_time,
        "timeKind": time_kind, "timeZone": "Europe/Stockholm", "dateTime": date_time,
        "status": status_name(raw.get("eventStatus", "")), "url": url,
        "ticketUrl": ticket_url if safe_url(ticket_url) else None, "lastVerifiedAt": now,
        **({"ticketPrice": lowest_price} if lowest_price else {}),
    }


def collect_venue(source, now, get=fetch):
    if source.get("adapter") == "katalin":
        return collect_katalin(source, now, get)
    if source.get("adapter") == "kollektivet_livet":
        return collect_livet(source, now, get)
    if source.get("adapter") == "slakthusen":
        return collect_slakthusen(source, now, get)
    if source.get("adapter") == "brewpunk":
        return collect_brewpunk(source, now, get)
    if source.get("adapter") == "geronimos":
        return collect_geronimos(source, now, get)
    if source.get("adapter") == "larrys_corner":
        return collect_larrys(source, now, get)
    if source.get("adapter") == "nupagang_venue":
        return collect_nupagang_venue(source, now, get)
    if source.get("adapter") == "arena_watch":
        return collect_arena_watch(source, now, get)
    index = Page(get(source["indexUrl"]))
    prefix = source["eventPrefix"]
    links = sorted({urljoin(source["indexUrl"], link).split("#")[0].split("?")[0] for link in index.links})
    links = [url for url in links if url.startswith(prefix) and url != prefix and url.rstrip("/").split("/")[-1] != "feed"]
    if not links or len(links) > 100:
        raise ValueError("Venue calendar changed or returned no event links; previous data retained")
    events = []
    for url in links:
        page = Page(get(url))
        found = [raw for raw in objects(page.json_ld) if "MusicEvent" in ([raw.get("@type")] if isinstance(raw.get("@type"), str) else raw.get("@type", []))]
        if len(found) != 1:
            raise ValueError("Venue event schema changed; previous data retained")
        events.append(normalize_venue_event(found[0], page, url, source, now))
    return events


def plain_text(value):
    return " ".join(Page(unescape(str(value or ""))).text)


class Element:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def find(self, tag=None, cls=None):
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and (cls is None or cls in child.attrs.get("class", "").split()):
                    yield child
                yield from child.find(tag, cls)

    def text(self):
        return " ".join(c.text() if isinstance(c, Element) else c for c in self.children).strip()


class CalendarHTML(HTMLParser):
    """Small tree reader for public calendar cards; scripts/styles are never data."""
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if not any(n.tag in {"script", "style"} for n in self.stack):
            self.stack[-1].children.append(data.strip())


def one_element(root, tag=None, cls=None):
    found = list(root.find(tag, cls))
    if len(found) != 1:
        raise ValueError("Venue calendar markup changed")
    return found[0]


def calendar_event(source, url, title, day, local_time, time_kind, now, styles=None, venue=None, ticket=None):
    datetime.strptime(day, "%Y-%m-%d")
    if local_time:
        local_time = datetime.strptime(local_time, "%H:%M").strftime("%H:%M")
    instant = datetime.fromisoformat(day + "T" + local_time).replace(tzinfo=ZoneInfo("Europe/Stockholm")) if local_time else None
    identifier = source["id"] + ":" + urlparse(url).path.strip("/").split("/")[-1]
    return {"id": identifier, "sourceIds": [identifier], "providers": [source["id"]],
            "title": " ".join(title.split()), "artists": [], "styles": styles or [],
            "venue": venue or source["venue"], "localDate": day, "localTime": local_time,
            "timeKind": time_kind, "timeZone": "Europe/Stockholm",
            "dateTime": instant.astimezone(timezone.utc).isoformat() if instant else None,
            "status": "cancelled" if re.search(r"\b(inställt|inställd|cancelled|canceled)\b", title, re.I) else status_name(title),
            "url": url, "ticketUrl": ticket if safe_url(ticket) else None, "lastVerifiedAt": now}


def collect_arena_watch(source, now, get=fetch):
    """Collect every public arena showing; non-music events become local busy-area alerts."""
    index = CalendarHTML(get(source["indexUrl"])).root
    cards = {}
    for card in index.find(cls="card-event"):
        links = list(card.find("a", "card-event-link"))
        headings = list(card.find("h3"))
        if len(links) != 1 or len(headings) != 1 or not links[0].attrs.get("href"):
            raise ValueError("Arena event card markup changed")
        cards[links[0].attrs["href"]] = unescape(headings[0].text())
    links = sorted(cards)
    prefix = source["eventPrefix"]
    if not links or len(links) > 80 or any(not url.startswith(prefix) for url in links):
        raise ValueError("Arena event listing changed or returned no event links")
    events, seen = [], set()
    for url in links:
        page = Page(get(url))
        found = []
        for raw in objects(page.json_ld):
            raw_types = raw.get("@type", []) if isinstance(raw, dict) else []
            raw_types = [raw_types] if isinstance(raw_types, str) else raw_types
            if raw.get("name") and raw.get("startDate") and any(str(t).endswith("Event") for t in raw_types):
                found.append((raw, raw_types))
        if not found:
            raise ValueError("Arena event details no longer expose dated events")
        for raw, raw_types in found:
            raw = dict(raw)
            raw["name"] = unescape(raw["name"])
            if name_key(raw["name"]) in {"showstart", "pit party", "massan oppnar", "massan stanger"}:
                raw["name"] = cards[url] + " — " + raw["name"]
            identity = str(raw.get("@id") or (raw["name"] + "|" + raw["startDate"] + "|" + url))
            if identity in seen:
                continue
            seen.add(identity)
            event = normalize_venue_event(raw, page, url, source, now)
            digest = hashlib.sha1(identity.encode()).hexdigest()[:20]
            event["id"] = source["id"] + ":" + digest
            event["sourceIds"] = [event["id"]]
            is_music = "MusicEvent" in raw_types
            event["purpose"] = "concert" if is_music else "venue_alert"
            event["eventCategory"] = "Music/show" if is_music else "Sport" if "SportsEvent" in raw_types else "Busy event"
            events.append(event)
    return events


def collect_livet(source, now, get=fetch):
    """Follow public offset links; pair each card's full date with its own details."""
    base, url, cards, visited = source["indexUrl"], source["indexUrl"], {}, set()
    while url:
        if url in visited or len(visited) >= 40:
            raise ValueError("Kollektivet Livet calendar pagination repeated or exceeded limit")
        visited.add(url)
        tree = CalendarHTML(get(url)).root
        listing = one_element(tree, cls="event-list")
        rows = list(listing.find(cls="event"))
        for card in rows:
            link = one_element(one_element(card, "h3"), "a").attrs["href"]
            if not link.startswith(source["eventPrefix"]) or link in cards:
                raise ValueError("Kollektivet Livet calendar returned repeated or unexpected event")
            start = datetime.fromisoformat(one_element(card, "time").attrs["datetime"])
            cards[link] = start.date().isoformat()
        next_links = {urljoin(base, a.attrs["href"]) for a in tree.find("a") if "offset=" in a.attrs.get("href", "")}
        if len(next_links) > 1 or len(cards) > 450:
            raise ValueError("Kollektivet Livet calendar is incomplete")
        # This site keeps rendering a next-offset link even on an empty terminal
        # page. Require its event-list container, then stop at that empty page.
        if not rows:
            break
        url = next(iter(next_links), None)
        if url:
            parts, expected = urlparse(url), urlparse(base)
            offset = parse_qs(parts.query).get("offset", [""])[0]
            if parts.netloc != expected.netloc or parts.path != expected.path or not offset.isdigit():
                raise ValueError("Unexpected Kollektivet Livet pagination link")
    if not cards:
        raise ValueError("Kollektivet Livet calendar returned no dated events")
    events = []
    for link, day in sorted(cards.items()):
        tree = CalendarHTML(get(link)).root
        boxes = list(tree.find(cls="info-box-event"))
        # Desktop/mobile versions may repeat the same event summary.
        if not boxes or len({" ".join(b.text().split()) for b in boxes}) != 1:
            raise ValueError("Kollektivet Livet event summary changed or conflicts")
        info = boxes[0]
        fields = {}
        for row in one_element(info, "table", "event-info").find("tr"):
            fields[one_element(row, "td", "key").text()] = one_element(row, "td", "value").text()
        categories = [s.strip() for s in fields["Vad"].split(",") if s.strip()]
        # The venue hosts exhibitions, talks and DJ parties as well as concerts.
        if "konsert" not in {name_key(c) for c in categories}:
            continue
        title = one_element(info, "h1").text()
        styles = [s for s in categories if name_key(s) not in {"konsert", "klubb", "festival"}]
        tickets = list(info.find("a", "buy-ticket"))
        doors = fields.get("Dörrar")
        if doors and doors.strip() in {"-", "–", "TBA"}:
            doors = None
        events.append(calendar_event(source, link, title, day, doors, "doors", now, styles,
                                     ticket=tickets[0].attrs.get("href") if tickets else None))
    return events


SWEDISH_MONTHS = {name: i for i, name in enumerate(["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"], 1)}


def collect_slakthusen(source, now, get=fetch):
    """Read the operator's upcoming cards and explicit event-date fields.

    BlogPosting publication dates are deliberately ignored. Only named concert
    rooms and pages with explicit live-music wording qualify; ambiguous items
    remain outside this supplement.
    """
    base, url, links, visited = source["indexUrl"], source["indexUrl"], set(), set()
    while url:
        if url in visited or len(visited) >= 30:
            raise ValueError("Slakthusen calendar pagination repeated or exceeded limit")
        visited.add(url)
        tree = CalendarHTML(get(url)).root
        listings = [e for e in tree.find("ul") if e.attrs.get("id") == "nm-blog-list"]
        if len(listings) != 1:
            raise ValueError("Slakthusen calendar changed")
        cards = list(listings[0].find("li"))
        for card in cards:
            link = one_element(card, "a").attrs["href"]
            if not link.startswith(base) or link in links:
                raise ValueError("Slakthusen calendar returned repeated or unexpected event")
            links.add(link)
        next_links = {a.attrs["href"] for a in tree.find("a") if re.fullmatch(re.escape(base) + r"page/\d+/", a.attrs.get("href", ""))}
        if len(next_links) > 1 or (next_links and not cards) or len(links) > 350:
            raise ValueError("Slakthusen calendar is incomplete")
        url = next(iter(next_links), None)
    if not links:
        raise ValueError("Slakthusen calendar returned no events")
    events = []
    for link in sorted(links):
        tree = CalendarHTML(get(link)).root
        room = one_element(tree, cls="stalle-s").text().strip()
        if room not in source["venues"]:
            continue
        title = one_element(tree, cls="titel-s").text()
        article = one_element(tree, "article")
        description = article.text()
        # Some posts have a stale room category/footer. Prefer a room explicitly
        # named in both the event title and its labelled programme details.
        for named_room in source["venues"]:
            if (re.search(r"\|\s*" + re.escape(named_room) + r"\s*$", title, re.I)
                    and re.search(r"\b(?:Lokal|Venue)\s*:\s*" + re.escape(named_room) + r"\b", description, re.I)):
                room = named_room
        # A wrestling show or a DJ-only club must not become a concert.
        if re.search(r"wrestling|stand\s*-?\s*up|quiz", title, re.I) or not re.search(r"\b(?:band\s*:|live\s*(?:från|på scen|:)|konsert\w*|concert\w*|spelning\w*)", description, re.I):
            continue
        date_text = one_element(tree, cls="datum-s").text()
        match = re.fullmatch(r"\w+\s+(\w+)\s+(\d{1,2}),\s+(\d{4})", date_text.strip())
        if not match:
            raise ValueError("Slakthusen event date changed")
        month, day, year = match.groups()
        date = f"{int(year):04d}-{SWEDISH_MONTHS[month[:3].lower()]:02d}-{int(day):02d}"
        times = list(tree.find(cls="tid-b"))
        local_time = times[0].text().strip() if times else None
        if local_time in {"", "-", "–", "TBA"}:
            local_time = None
        if local_time:
            clock = re.fullmatch(r"(\d{1,2})[.:](\d{2})(?:\s*[-–]\s*\d{1,2}[.:]\d{2})?", local_time)
            if not clock:
                raise ValueError("Slakthusen listed time changed")
            local_time = f"{int(clock[1]):02d}:{clock[2]}"
        doors = re.search(r"\bInsläpp\s*:?\s*(?:kl\.?\s*)?(\d{1,2})[.:](\d{2})", description, re.I)
        kind = "listed"
        if doors:
            local_time = f"{int(doors[1]):02d}:{doors[2]}"
            kind = "doors"
        tickets = list(one_element(tree, cls="ticket-s").find("a"))
        # Styles must be stated on this event page, never assigned to an entire venue.
        styles = [label for label, pattern in source.get("stylePatterns", {}).items() if re.search(pattern, title + " " + description, re.I)]
        clean_title = re.sub(r"\s*\|\s*" + re.escape(room) + r"\s*$", "", title, flags=re.I)
        events.append(calendar_event(source, link, clean_title, date, local_time, kind, now, styles,
                                     source["venues"][room], tickets[0].attrs.get("href") if tickets else None))
        events[-1]["styleEvidence"] = "description"
    return events


def collect_nupagang_venue(source, now, get=fetch):
    html = get(source["indexUrl"])
    lists = [o for o in objects(Page(html).json_ld) if o.get("@type") == "ItemList"]
    cards = list(CalendarHTML(html).root.find("article", "vote-card"))
    if len(lists) != 1 or lists[0].get("numberOfItems") != len(cards) or len(cards) > 150:
        raise ValueError("Nu på gång venue calendar changed or is incomplete")
    expected = {i["url"] for i in lists[0]["itemListElement"]}
    actual = {c.attrs.get("data-share-url") for c in cards}
    if expected != actual or len(actual) != len(cards):
        raise ValueError("Nu på gång calendar identities disagree")
    events = []
    for card in cards:
        if card.attrs.get("data-kind") != "concert":
            continue
        url = card.attrs["data-share-url"]
        if not url.startswith(source["eventPrefix"]):
            raise ValueError("Unexpected Nu på gång event URL")
        page = Page(get(url))
        raw_events = [o for o in objects(page.json_ld) if o.get("@type") in {"Event", "MusicEvent"} and o.get("url") == url]
        if len(raw_events) != 1:
            raise ValueError("Nu på gång event schema changed")
        raw = raw_events[0]
        location = raw.get("location", {})
        if (name_key(location.get("name")) != name_key(source["venue"]["name"])
                or name_key(location.get("address", {}).get("addressLocality")) != name_key(source["venue"]["city"])):
            raise ValueError("Nu på gång event moved to another venue")
        gig = normalize_venue_event(raw, page, url, source, now)
        gig["listingNote"] = "Listed by Nu på gång, with a Bandsintown source link. Confirm time and line-up on the source page."
        events.append(gig)
    return events


def collect_brewpunk(source, now, get=fetch):
    tree = CalendarHTML(get(source["indexUrl"])).root
    tables = [t for t in tree.find("table") if [n.text().strip() for n in t.find("th")] == ["När", "Vilka", "Var"]]
    if len(tables) != 1:
        raise ValueError("BrewPunk calendar headings changed")
    events, seen = [], set()
    venues = {name_key(k): v for k, v in source["venues"].items()}
    rows = list(tables[0].find("tr"))
    if not 1 < len(rows) <= 1000:
        raise ValueError("BrewPunk calendar size changed")
    for row in rows:
        cells = list(row.find("td"))
        if not cells:
            continue
        if len(cells) != 3:
            raise ValueError("BrewPunk calendar row changed")
        day, bill, place = [" ".join(c.text().split()) for c in cells]
        venue = venues.get(name_key(place))
        if not venue:
            continue  # Explicit venue scope avoids guessing cities from festival names.
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            raise ValueError("BrewPunk selected gig has an ambiguous or multi-day date")
        # This is an editorial calendar with a named 'Who' column, but annotations
        # like film screenings are not artist names. Keep those bills title-only.
        artists = [] if re.search(r"[():]|\bTBA\b|fler band", bill, re.I) else [a.strip() for a in bill.split(",") if a.strip()]
        identifier = source["id"] + ":" + hashlib.sha256((name_key(place) + day + name_key(bill)).encode()).hexdigest()[:20]
        if identifier in seen:
            raise ValueError("Repeated BrewPunk listing")
        seen.add(identifier)
        gig = calendar_event(source, source["indexUrl"], bill, day, None, "listed", now, ["Punk"], venue)
        gig.update(id=identifier, sourceIds=[identifier], artists=artists, styleEvidence="punk_calendar",
                   listingNote="Listed by BrewPunk's independent punk calendar. Time and current line-up need checking with the venue.")
        events.append(gig)
    return events


def collect_geronimos(source, now, get=fetch):
    html = get(source["indexUrl"])
    settings = dict(re.findall(r'(id|end_date|offset|current_month_divider|atts|ajax_url):\s*"([^"]*)"', html[html.index('.mecListView('):]))
    if settings.get("ajax_url") != source["ajaxUrl"]:
        raise ValueError("Geronimo calendar endpoint changed")
    links, cursors = set(), set()
    for page_number in range(20):
        tree = CalendarHTML(html).root
        cards = list(tree.find("article", "mec-event-article"))
        if not cards and page_number == 0:
            raise ValueError("Geronimo calendar changed")
        for card in cards:
            anchor = one_element(one_element(card, cls="mec-event-title"), "a")
            link, title = anchor.attrs["href"], anchor.text()
            if not link.startswith(source["eventPrefix"]):
                raise ValueError("Unexpected Geronimo event link")
            # Ignore quiz, bingo and DJ listings even if their description says music.
            if not re.search(r"\blive\b|\bkonsert\b", title, re.I) or re.search(r"\b(?:DJ|quiz|bingo|disco)\b", title, re.I):
                continue
            if link in links:
                raise ValueError("Repeated Geronimo concert in calendar")
            links.add(link)
        cursor = (settings["end_date"], str(settings["offset"]))
        if cursor in cursors:
            raise ValueError("Geronimo pagination repeated")
        cursors.add(cursor)
        data = urlencode({"action": "mec_list_load_more", "mec_start_date": settings["end_date"],
                          "mec_offset": settings["offset"], "current_month_divider": settings["current_month_divider"],
                          "apply_sf_date": 0}) + "&" + settings["atts"]
        result = json.loads(get(source["ajaxUrl"], data=data.encode(), headers={"Content-Type": "application/x-www-form-urlencoded"}))
        if not isinstance(result, dict) or not isinstance(result.get("html"), str) or not str(result.get("count", "")).isdigit():
            raise ValueError("Geronimo pagination schema changed")
        if int(result["count"]) == 0:
            break
        html = result["html"]
        if len(list(CalendarHTML(html).root.find("article", "mec-event-article"))) != int(result["count"]):
            raise ValueError("Geronimo pagination returned incomplete cards")
        settings.update({k: result[k] for k in ("end_date", "offset", "current_month_divider")})
    else:
        raise ValueError("Geronimo pagination limit exceeded")
    events = []
    for url in sorted(links):
        tree = CalendarHTML(get(url)).root
        date_text = one_element(tree, cls="mec-start-date-label").text().strip()
        date_parts = re.fullmatch(r"(\w+)\s+(\d{1,2})\s+(\d{4})", date_text)
        if not date_parts:
            raise ValueError("Geronimo event date changed")
        month, day, year = date_parts.groups()
        day = f"{int(year):04d}-{SWEDISH_MONTHS[month[:3].lower()]:02d}-{int(day):02d}"
        title = one_element(tree, cls="mec-single-title").text()
        body = one_element(tree, cls="mec-single-event-description").text()
        doors = re.search(r"\bDoors\s*:\s*(\d{1,2})[.:](\d{2})", body, re.I)
        local_time, kind = (f"{int(doors[1]):02d}:{doors[2]}", "doors") if doors else (None, "listed")
        title = title.split("•")[0].strip()
        styles = [label for label, pattern in source.get("stylePatterns", {}).items() if re.search(pattern, body, re.I)]
        gig = calendar_event(source, url, title, day, local_time, kind, now, styles)
        gig["styleEvidence"] = "description"
        events.append(gig)
    return events


def collect_larrys(source, now, get=fetch):
    tree = CalendarHTML(get(source["indexUrl"])).root
    grouped = {}
    for anchor in tree.find("a"):
        href = anchor.attrs.get("href", "")
        text = " ".join(anchor.text().split())
        if href.startswith("/en/events/") and text:
            if text not in grouped.setdefault(href, []):
                grouped[href].append(text)
    if not grouped or len(grouped) > 250:
        raise ValueError("Larry's Corner upcoming calendar changed")
    events = []
    date_pattern = r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{1,2}) ([A-Za-z]+) (\d{4})(?:\s*•\s*(\d{1,2})[.:](\d{2})(am|pm))?"
    months = {m: n for n, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], 1)}
    for href, parts in grouped.items():
        url = urljoin(source["indexUrl"], href)
        text = " ".join(parts)
        match = re.match(date_pattern, text)
        if not match:
            raise ValueError("Larry's Corner event date changed")
        d, month, year, hour, minute, period = match.groups()
        date = f"{int(year):04d}-{months[month]:02d}-{int(d):02d}"
        clock = f"{int(hour) % 12 + (12 if period == 'pm' else 0):02d}:{minute}" if hour else None
        title = text[match.end():].strip()
        detail = CalendarHTML(get(url)).root
        # The programme also includes poetry and visual art. Only affirmative
        # music wording in the event's own paragraphs/title qualifies here.
        description = " ".join(n.text() for n in detail.find("p"))
        if not re.search(source["musicPattern"], title + " " + description, re.I):
            continue
        if re.search(r"\b(?:poetry reading|poesi|vernissage|art exhibition)\b", title, re.I):
            continue
        styles = [label for label, pattern in source.get("stylePatterns", {}).items() if re.search(pattern, description, re.I)]
        gig = calendar_event(source, url, title, date, clock, "listed", now, styles)
        gig["styleEvidence"] = "description"
        events.append(gig)
    return events


def collect_katalin(source, now, get=fetch):
    """Discover upcoming public calendar pages, then batch-read their WP metadata.

    Do not scan years of archived posts or treat a post's publication date as a gig date.
    Artist identities are not exposed, so keep artists empty rather than invent a lineup.
    """
    base = source["indexUrl"]
    base_parts = urlparse(base)
    pending, visited, slugs = {base}, set(), set()
    while pending:
        url = min(pending)
        pending.remove(url)
        if url in visited:
            continue
        if len(visited) >= 30:
            raise ValueError("Katalin calendar pagination limit reached")
        visited.add(url)
        page = Page(get(url))
        for link in page.links:
            absolute = urljoin(base, link)
            parsed = urlparse(absolute)
            if parsed.scheme != "https" or parsed.netloc != base_parts.netloc:
                continue
            if parsed.path.rstrip("/") == base_parts.path.rstrip("/"):
                tab = parse_qs(parsed.query).get("tab", [""])[0]
                if tab.isdigit() and 1 <= int(tab) <= 30:
                    next_url = base + "?tab=" + str(int(tab))
                    if next_url not in visited:
                        pending.add(next_url)
                elif tab:
                    raise ValueError("Unexpected Katalin calendar pagination")
            elif parsed.path.startswith(base_parts.path):
                slug = parsed.path[len(base_parts.path):].strip("/")
                if slug and "/" not in slug:
                    slugs.add(unquote(slug))
    if not slugs or len(slugs) > 450:
        raise ValueError("Katalin upcoming calendar changed")
    api = source["apiUrl"]
    genres = json.loads(get(api + "/genre?per_page=100&_fields=id,name"))
    if not isinstance(genres, list) or not genres or len(genres) >= 100:
        raise ValueError("Unexpected Katalin genre taxonomy")
    genre_names = {g["id"]: plain_text(g["name"]) for g in genres}
    allowed = {name_key(g) for g in source["musicGenres"]}
    ordered, events = sorted(slugs), []
    for offset in range(0, len(ordered), 40):
        wanted = ordered[offset:offset + 40]
        params = {"slug": ",".join(wanted), "per_page": 100,
                  "_fields": "id,slug,link,title,genre,acf.date_of_event,acf.time,acf.book_a_ticket,acf.ticket_status"}
        rows = json.loads(get(api + "/events?" + urlencode(params)))
        if not isinstance(rows, list) or {r["slug"] for r in rows} != set(wanted):
            raise ValueError("Katalin event metadata is incomplete")
        for raw in rows:
            styles = [genre_names[g] for g in raw["genre"]]
            if not any(name_key(g) in allowed for g in styles):
                continue
            fields = raw["acf"]
            day = datetime.strptime(fields["date_of_event"], "%Y%m%d").date().isoformat()
            local_time = fields.get("time") or None
            local_time = datetime.strptime(local_time, "%H:%M:%S" if len(local_time) == 8 else "%H:%M").strftime("%H:%M") if local_time else None
            instant = datetime.fromisoformat(day + "T" + local_time).replace(tzinfo=ZoneInfo("Europe/Stockholm")) if local_time else None
            identifier = source["id"] + ":" + str(raw["id"])
            ticket = fields.get("book_a_ticket")
            events.append({"id": identifier, "sourceIds": [identifier], "providers": [source["id"]],
                           "title": plain_text(raw["title"]["rendered"]), "artists": [], "styles": styles,
                           "venue": source["venue"], "localDate": day, "localTime": local_time,
                           "timeKind": "listed", "timeZone": "Europe/Stockholm",
                           "dateTime": instant.astimezone(timezone.utc).isoformat() if instant else None,
                           "status": status_name(fields.get("ticket_status", "")), "url": raw["link"],
                           "ticketUrl": ticket if safe_url(ticket) else None, "lastVerifiedAt": now})
    return events


def normalize_tickster(raw, now):
    venue = raw.get("venue") or {}
    geo = venue.get("geo") or {}
    start = raw.get("startUtc") or raw.get("start")
    instant = datetime.fromisoformat(start.replace("Z", "+00:00")) if start else None
    # The documented field is UTC even if an upstream value omits its offset.
    if instant and not instant.tzinfo:
        instant = instant.replace(tzinfo=timezone.utc)
    local = instant.astimezone(ZoneInfo("Europe/Stockholm")) if instant else None
    identifier = "tickster:" + raw["id"]
    artists = list(dict.fromkeys([a for a in (raw.get("performers") or []) if isinstance(a, str) and a.strip()] +
                                [a["name"] for a in (raw.get("spotifyArtists") or []) if a.get("name")]))
    tags = [t for t in (raw.get("tags") or []) if isinstance(t, str)]
    # Only musical style tags: organizer, location and artist tags are not styles.
    musical = {"rock", "pop", "indie", "metal", "hardrock", "punk", "jazz", "blues", "soul", "reggae", "ska",
               "country", "americana", "folk", "folkmusik", "hip hop", "hiphop", "r b", "electronic", "elektroniskt", "klassisk", "klassiskt"}
    return {"id": identifier, "sourceIds": [identifier], "providers": ["tickster"],
            "title": raw["name"], "artists": artists, "styles": [t for t in tags if name_key(t) in musical],
            "venue": {"name": venue.get("name") or "Venue TBA", "city": venue.get("city") or "",
                      "lat": number_or_none(geo.get("latitude"), 90), "lon": number_or_none(geo.get("longitude"), 180)},
            "localDate": local.date().isoformat() if local else None, "localTime": local.strftime("%H:%M") if local else None,
            "timeKind": "listed", "timeZone": "Europe/Stockholm", "dateTime": instant.isoformat() if instant else None,
            "status": status_name(raw.get("state") or raw.get("eventState", "")), "url": raw.get("infoUrl") or raw["infoUri"],
            "ticketUrl": next((url for url in (raw.get("shopUrl"), raw.get("shopUri")) if safe_url(url)), None), "lastVerifiedAt": now}


def collect_tickster(config, api_key, now, get=fetch, get_binary=fetch_binary):
    """Use Tickster's once-daily dump: two requests instead of one per event."""
    metadata_url = "https://api.tickster.com/sv/api/0.4/events/dump/upcoming?" + urlencode({"key": api_key})
    metadata = json.loads(get(metadata_url))
    dump_url = metadata.get("uri")
    parsed_dump_url = urlparse(str(dump_url or ""))
    # Tickster still returns its S3 signed URL as HTTP. Upgrade only its documented
    # dump host before downloading so event data and the temporary signature use TLS.
    if parsed_dump_url.scheme == "http" and parsed_dump_url.hostname == "event-api-dumps.s3-eu-west-1.amazonaws.com":
        dump_url = parsed_dump_url._replace(scheme="https").geturl()
    if not isinstance(metadata.get("id"), str) or not metadata["id"] or not safe_url(dump_url):
        raise ValueError("Unexpected Tickster dump metadata")
    packed = get_binary(dump_url)
    try:
        content = gzip.decompress(packed) if packed[:2] == b"\x1f\x8b" else packed
        if len(content) > 120_000_000:
            raise ValueError("Tickster dump is unexpectedly large")
        data = json.loads(content.decode("utf-8"))
    except (gzip.BadGzipFile, UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("Unexpected Tickster dump encoding") from None
    rows, venues = data.get("events"), data.get("venues")
    if (not isinstance(rows, list) or not isinstance(venues, list) or
            (data.get("count") is not None and data.get("count") != len(rows))):
        raise ValueError("Unexpected Tickster dump schema")
    options = config.get("tickster", {})
    if len(rows) > options.get("maxDumpEvents", 100_000):
        raise ValueError("Tickster dump event bound exceeded")
    venue_by_id = {venue.get("id"): venue for venue in venues if isinstance(venue, dict) and venue.get("id")}
    cities = {name_key(city) for city in config["cities"]}
    music_tags = {name_key(tag) for tag in options.get("musicTags", ["musik", "konsert"])}
    events = []
    for raw in rows:
        if not isinstance(raw, dict) or raw.get("hierarchyType") not in ("event", "production-child"):
            continue
        venue = venue_by_id.get(raw.get("venueId"), {})
        tags = {name_key(tag) for tag in (raw.get("tags") or []) if isinstance(tag, str)}
        if (str(venue.get("country") or "").upper() != "SE" or
                name_key(venue.get("city")) not in cities or not tags & music_tags):
            continue
        event = dict(raw)
        event["venue"] = venue
        events.append(normalize_tickster(event, now))
    return events


def number_or_none(value, maximum):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
        return number if abs(number) <= maximum else None
    except (TypeError, ValueError):
        return None


def normalize_ticketmaster(raw, now):
    dates = raw.get("dates", {})
    start = dates.get("start", {})
    venue = next(iter(raw.get("_embedded", {}).get("venues", [])), {})
    attractions = raw.get("_embedded", {}).get("attractions", [])
    location = venue.get("location", {})
    event_id = "ticketmaster:" + raw["id"]
    styles = {item.get(level, {}).get("name") for item in raw.get("classifications", []) for level in ("genre", "subGenre")}
    lowest_price = cheapest_offer(raw.get("priceRanges", []), ("min",))
    return {
        "id": event_id, "sourceIds": [event_id], "providers": ["ticketmaster"],
        "title": raw["name"], "artists": [a["name"] for a in attractions if a.get("name")],
        "styles": sorted(s for s in styles if s and s.lower() != "undefined"),
        "venue": {"name": venue.get("name", "Venue TBA"), "city": venue.get("city", {}).get("name", ""),
                  "lat": number_or_none(location.get("latitude"), 90), "lon": number_or_none(location.get("longitude"), 180)},
        "localDate": None if start.get("dateTBA") or start.get("dateTBD") else start.get("localDate"),
        "localTime": None if start.get("timeTBA") or start.get("noSpecificTime") else (start.get("localTime") or "")[:5] or None,
        "timeKind": "listed", "timeZone": dates.get("timezone") or venue.get("timezone") or "Europe/Stockholm",
        "dateTime": start.get("dateTime"), "status": status_name(dates.get("status", {}).get("code", "")),
        "url": raw["url"], "lastVerifiedAt": now,
        **({"ticketPrice": lowest_price} if lowest_price else {}),
    }


def collect_ticketmaster(config, api_key, now, get=fetch):
    rows = {}
    beginning = datetime.fromisoformat(now).astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end = beginning + timedelta(days=config["horizonDays"])

    def query(city, start=None, finish=None, unknown=None, page=0):
        params = {"apikey": api_key, "countryCode": "SE", "city": city, "classificationName": "music", "size": 200, "page": page, "sort": "date,asc", "locale": "*"}
        if start is not None:
            params.update(startDateTime=start.strftime("%Y-%m-%dT%H:%M:%SZ"), endDateTime=finish.strftime("%Y-%m-%dT%H:%M:%SZ"))
        if unknown:
            params[unknown] = "only"
        return json.loads(get("https://app.ticketmaster.com/discovery/v2/events.json?" + urlencode(params)))

    def window(city, start=None, finish=None, unknown=None):
        data = query(city, start, finish, unknown)
        if "page" not in data:
            raise ValueError("Unexpected Ticketmaster response")
        total = data["page"].get("totalElements", 0)
        if total > 1000:
            if start is None or finish - start < timedelta(hours=2):
                raise ValueError("Ticketmaster result limit reached; narrow coverage before publishing")
            middle = start + (finish - start) / 2
            window(city, start, middle)
            window(city, middle, finish)
            return
        pages = data["page"].get("totalPages", 0)
        for page_number in range(max(pages, 1)):
            current = data if page_number == 0 else query(city, start, finish, unknown, page_number)
            for raw in current.get("_embedded", {}).get("events", []):
                # A VIP/parking product is not another performance. Keep ordinary
                # festival passes as events; cross-source merging stays conservative.
                if re.search(r"\b(vip packages?|parking|parkering|upsell)\b", raw.get("name", ""), re.I):
                    continue
                event = normalize_ticketmaster(raw, now)
                rows[event["id"]] = event

    for city in config["cities"]:
        cursor = beginning
        while cursor < end:
            finish = min(cursor + timedelta(days=28), end)
            window(city, cursor, finish)
            cursor = finish
        for flag in ("includeTBA", "includeTBD"):
            window(city, unknown=flag)
    return enrich_ticketmaster_storefront_prices(list(rows.values()))


def deduplicate(events, previous=()):
    old_ids = {alias: event["id"] for event in previous for alias in event.get("sourceIds", [event["id"]])}
    result, fingerprints, performances = {}, {}, {}
    for event in events:
        event = dict(event)
        source_ids = event.get("sourceIds", [event["id"]])
        event["id"] = next((old_ids[a] for a in source_ids if a in old_ids), event["id"])
        fingerprint = None
        if event["artists"] and event["localDate"] and event["localTime"]:
            fingerprint = (tuple(sorted(name_key(a) for a in event["artists"])), name_key(event["venue"]["name"]), name_key(event["venue"]["city"]), event["localDate"], event["localTime"], event["timeKind"])
        performance = (name_key(event["title"]), name_key(event["venue"]["name"]), name_key(event["venue"]["city"]), event["localDate"]) if event["localDate"] else None
        # Never combine separate source records from the same provider merely on
        # a fingerprint (festival products can share artist/venue/date/time).
        candidate = fingerprints.get(fingerprint) if fingerprint else None
        performance_candidate = performances.get(performance) if performance else None
        # A venue's title-only/doors record and a provider's artist/show record
        # describe the same performance. Keep separately identified products
        # when both sources already provide artist lineups.
        if not candidate and performance_candidate and (not performance_candidate["artists"] or not event["artists"]):
            candidate = performance_candidate
        target = result.get(event["id"])
        if not target and candidate and not set(candidate["providers"]) & set(event["providers"]):
            target = candidate
        if target:
            merged_ids = sorted(set(target["sourceIds"] + source_ids))
            merged_providers = sorted(set(target["providers"] + event["providers"]))
            merged_styles = sorted(set(target["styles"] + event["styles"]))
            merged_artists = list(dict.fromkeys(target["artists"] + event["artists"]))
            prices = [price for price in (target.get("ticketPrice"), event.get("ticketPrice")) if price]
            if event.get("lastVerifiedAt", "") > target.get("lastVerifiedAt", ""):
                canonical_id = target["id"]
                target.update(event)
                target["id"] = canonical_id
            target.update(sourceIds=merged_ids, providers=merged_providers, styles=merged_styles, artists=merged_artists)
            if prices and len({price["currency"] for price in prices}) == 1:
                target["ticketPrice"] = min(prices, key=lambda price: price["amount"])
        else:
            result[event["id"]] = event
            if fingerprint:
                fingerprints[fingerprint] = event
            if performance:
                performances[performance] = event
    return list(result.values())


def validate(events):
    seen = set()
    for event in events:
        if not event.get("id") or event["id"] in seen or not event.get("title") or not safe_url(event.get("url")):
            raise ValueError("Invalid event identity or source URL")
        seen.add(event["id"])
        if event["localDate"]:
            datetime.strptime(event["localDate"], "%Y-%m-%d")
        if event["localTime"]:
            datetime.strptime(event["localTime"], "%H:%M")
        price = event.get("ticketPrice")
        if price is not None and ticket_price(price.get("amount") if isinstance(price, dict) else None,
                                               price.get("currency") if isinstance(price, dict) else None) != price:
            raise ValueError("Invalid ticket price")
        if not isinstance(event["artists"], list) or any(not isinstance(a, str) or not a.strip() for a in event["artists"]) or not isinstance(event["venue"].get("city"), str):
            raise ValueError("Invalid event artist or venue data")


def refresh(config, previous, now, venue_collector=collect_venue, ticketmaster_collector=collect_ticketmaster, tickster_collector=collect_tickster):
    sources, events = [], []
    old_sources = {s["id"]: s for s in previous.get("sources", [])}
    jobs = [(s["id"], s["name"], lambda s=s: venue_collector(s, now)) for s in config["venueSources"]]
    api_key = os.environ.get("TICKETMASTER_API_KEY", "").strip()
    jobs.append(("ticketmaster", "Ticketmaster Sweden", (lambda: ticketmaster_collector(config, api_key, now)) if api_key else None))
    tickster_key = os.environ.get("TICKSTER_API_KEY", "").strip()
    jobs.append(("tickster", "Tickster Sweden", (lambda: tickster_collector(config, tickster_key, now)) if tickster_key else None))
    for source_id, name, collect in jobs:
        entry = {"id": source_id, "name": name, "status": "not_configured", "lastSuccess": old_sources.get(source_id, {}).get("lastSuccess")}
        if collect:
            try:
                rows = collect()
                validate(rows)
                events.extend(rows)
                entry.update(status="ok", lastSuccess=now, eventCount=len(rows))
            except Exception as error:
                # Do not log exception strings: some HTTP libraries include API keys.
                entry.update(status="error", error="Source refresh failed (" + type(error).__name__ + "); previous events retained")
        if entry["status"] != "ok":
            events.extend(e for e in previous.get("events", []) if source_id in e.get("providers", []) and (not e.get("lastVerifiedAt") or datetime.fromisoformat(now) - datetime.fromisoformat(e["lastVerifiedAt"]) <= timedelta(days=7)))
        sources.append(entry)
    if not any(s["status"] == "ok" for s in sources):
        raise RuntimeError("No source could be refreshed. The existing snapshot was not replaced.")
    # Source dates are Swedish local dates. Keeping a show through its local day
    # is intentional; no invented end time is used to hide it prematurely.
    day = datetime.fromisoformat(now).astimezone(ZoneInfo("Europe/Stockholm")).date()
    last_day = (day + timedelta(days=config["horizonDays"])).isoformat()
    events = [e for e in deduplicate(events, previous.get("events", [])) if not e["localDate"] or day.isoformat() <= e["localDate"] <= last_day]
    validate(events)
    return {"schemaVersion": 1, "generatedAt": now, "coverage": {"cities": config["cities"], "horizonDays": config["horizonDays"], "complete": False, "gaps": config.get("coverageGaps", []), "note": "Public venue music calendars and Ticketmaster/Tickster city searches when connected. Coverage is partial; ambiguous or untagged events and other venues/providers may be missing."}, "sources": sources, "events": sorted(events, key=lambda e: (e["localDate"] or "9999", e["title"]))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "concerts.json")
    parser.add_argument("--previous-url", help="Optional published snapshot to use for failure recovery")
    parser.add_argument("--check-ticketmaster", action="store_true", help="Check Ticketmaster credentials without changing the snapshot")
    parser.add_argument("--check-tickster", action="store_true", help="Check Tickster credentials without changing the snapshot")
    parser.add_argument("--require-ticketmaster", action="store_true", help="Do not replace the snapshot unless Ticketmaster refresh succeeds")
    parser.add_argument("--require-tickster", action="store_true", help="Do not replace the snapshot unless Tickster refresh succeeds")
    args = parser.parse_args()
    try:
        ticketmaster_mode = load_ticketmaster_key(ROOT)
        tickster_mode = load_tickster_key(ROOT)
    except RuntimeError as error:
        print(str(error))
        return 1
    if args.check_ticketmaster:
        key = os.environ.get("TICKETMASTER_API_KEY", "").strip()
        if not key:
            print("No Ticketmaster key available. Run scripts/connect-ticketmaster.ps1.")
            return 1
        try:
            probe = json.loads(fetch("https://app.ticketmaster.com/discovery/v2/events.json?" + urlencode({"apikey": key, "countryCode": "SE", "classificationName": "music", "size": 1})))
            if not isinstance(probe.get("page"), dict):
                raise ValueError("Unexpected API response")
        except Exception:
            print("Ticketmaster key check failed. Verify the Consumer Key and internet connection. No key was printed or saved.")
            return 1
        print("Ticketmaster key accepted.")
        return 0
    if args.check_tickster:
        key = os.environ.get("TICKSTER_API_KEY", "").strip()
        if not key:
            print("No Tickster key available. Run scripts/connect-tickster.ps1.")
            return 1
        try:
            probe = json.loads(fetch("https://event.api.tickster.com/api/v1.0/sv/events?" + urlencode({"take": 1}), headers={"X-API-KEY": key}))
            if not isinstance(probe.get("totalItems"), int) or not isinstance(probe.get("items"), (list, type(None))):
                raise ValueError("Unexpected API response")
        except Exception:
            print("Tickster key check failed. Verify the API key and internet connection. No key was printed or saved.")
            return 1
        print("Tickster key accepted.")
        return 0
    if ticketmaster_mode == "absent":
        print("Ticketmaster key missing: run scripts/connect-ticketmaster.ps1 for persistent local setup. GitHub Actions needs the TICKETMASTER_API_KEY secret.", flush=True)
        if args.require_ticketmaster:
            print("Required Ticketmaster refresh is not configured. Existing snapshot unchanged.")
            return 1
    else:
        print("Ticketmaster key loaded from " + ("encrypted local storage." if ticketmaster_mode == "encrypted_local" else "environment."), flush=True)
    if tickster_mode == "absent":
        print("Tickster key missing: run scripts/connect-tickster.ps1 for persistent local setup. GitHub Actions needs the TICKSTER_API_KEY secret.", flush=True)
        if args.require_tickster:
            print("Required Tickster refresh is not configured. Existing snapshot unchanged.")
            return 1
    else:
        print("Tickster key loaded from " + ("encrypted local storage." if tickster_mode == "encrypted_local" else "environment."), flush=True)
    config = json.loads((ROOT / "data/concert-sources.json").read_text(encoding="utf-8"))
    previous = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else {}
    if args.previous_url:
        if not safe_url(args.previous_url):
            parser.error("Previous snapshot must be an HTTPS URL")
        try:
            published = json.loads(fetch(args.previous_url))
            if published.get("schemaVersion") != 1 or not isinstance(published.get("sources"), list):
                raise ValueError("Invalid previous snapshot")
            validate(published["events"])
            previous = published
        except Exception:
            print("Published snapshot unavailable; using the local snapshot for recovery.")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        result = refresh(config, previous, now)
        if args.require_ticketmaster and not any(s["id"] == "ticketmaster" and s["status"] == "ok" for s in result["sources"]):
            raise RuntimeError("Required Ticketmaster refresh failed")
        if args.require_tickster and not any(s["id"] == "tickster" and s["status"] == "ok" for s in result["sources"]):
            raise RuntimeError("Required Tickster refresh failed")
    except Exception as error:
        print("Refresh failed; existing data unchanged (" + type(error).__name__ + ").")
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.output)
    print(f"Wrote {len(result['events'])} real events to {args.output.name}.")
    for source in result["sources"]:
        print(source["name"] + ": " + source["status"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
