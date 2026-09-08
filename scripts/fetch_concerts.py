"""Fetch public concert facts into a static snapshot. Python 3.11+; see requirements.txt.

No user preferences or credentials are included in the output. Venue adapters use
explicitly configured public calendars; Ticketmaster uses TICKETMASTER_API_KEY.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from html import unescape
import json
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse, parse_qs, unquote, quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "MagicCompass/0.1 (personal concert calendar; https://honkstonk.github.io/)"


def name_key(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def safe_url(value):
    parsed = urlparse(str(value or ""))
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def fetch(url, headers=None):
    """Bounded retries and response sizes; never print URLs containing credentials."""
    for attempt in range(3):
        time.sleep(0.55)  # Below both published Ticketmaster per-second limits.
        try:
            with urlopen(Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/html", **(headers or {})}), timeout=25) as response:
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
    offers = offers[0] if isinstance(offers, list) and offers else offers
    ticket_url = offers.get("url") if isinstance(offers, dict) else None
    return {
        "id": event_id, "sourceIds": [event_id], "providers": [source["id"]],
        "title": raw["name"], "artists": artists,
        "styles": sorted({style for artist in artists for style in source.get("artistStyles", {}).get(name_key(artist), [])}),
        "venue": source["venue"], "localDate": local_date, "localTime": local_time,
        "timeKind": time_kind, "timeZone": "Europe/Stockholm", "dateTime": date_time,
        "status": status_name(raw.get("eventStatus", "")), "url": url,
        "ticketUrl": ticket_url if safe_url(ticket_url) else None, "lastVerifiedAt": now,
    }


def collect_venue(source, now, get=fetch):
    if source.get("adapter") == "katalin":
        return collect_katalin(source, now, get)
    if source.get("adapter") == "kollektivet_livet":
        return collect_livet(source, now, get)
    if source.get("adapter") == "slakthusen":
        return collect_slakthusen(source, now, get)
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
    start = raw.get("startUtc")
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
            "status": status_name(raw.get("state", "")), "url": raw["infoUrl"],
            "ticketUrl": raw.get("shopUrl") if safe_url(raw.get("shopUrl")) else None, "lastVerifiedAt": now}


def collect_tickster(config, api_key, now, get=fetch):
    """Tickster's documented v1.0 search/detail API; live access requires a key."""
    base = "https://event.api.tickster.com/api/v1.0/sv/events"
    headers = {"X-API-KEY": api_key}
    candidates = {}
    options = config.get("tickster", {})
    for city in config["cities"]:
        for tag in options.get("musicTags", ["musik", "konsert"]):
            skip, seen = 0, set()
            for _ in range(20):
                params = {"query": "city:" + city + " tagged:" + tag, "take": 100, "skip": skip}
                data = json.loads(get(base + "?" + urlencode(params), headers=headers))
                if data.get("totalItems") == 0 and data.get("items") is None:
                    data["items"] = []  # The published schema permits null collections.
                if not isinstance(data.get("totalItems"), int) or not isinstance(data.get("items"), list):
                    raise ValueError("Unexpected Tickster search schema")
                rows = data["items"]
                if (not rows and skip < data["totalItems"]) or any(r["id"] in seen for r in rows):
                    raise ValueError("Incomplete or repeated Tickster page")
                for row in rows:
                    seen.add(row["id"])
                    if row.get("eventHierarchyType") not in ("event", "production-child"):
                        continue  # A collection/production is not an individual performance.
                    venue = row.get("venue") or {}
                    if venue.get("country") != "SE" or name_key(venue.get("city")) != name_key(city):
                        continue
                    candidates[row["id"]] = row
                skip += len(rows)
                if skip >= data["totalItems"]:
                    break
            else:
                raise ValueError("Tickster pagination limit reached")
    if len(candidates) > options.get("maxDetails", 600):
        raise ValueError("Tickster detail request budget exceeded; narrow collection")
    events = []
    for identifier in sorted(candidates):
        raw = json.loads(get(base + "/" + quote(identifier, safe=""), headers=headers))
        if raw.get("id") != identifier:
            raise ValueError("Unexpected Tickster event identity")
        events.append(normalize_tickster(raw, now))
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
    return list(rows.values())


def deduplicate(events, previous=()):
    old_ids = {alias: event["id"] for event in previous for alias in event.get("sourceIds", [event["id"]])}
    result, fingerprints = {}, {}
    for event in events:
        event = dict(event)
        source_ids = event.get("sourceIds", [event["id"]])
        event["id"] = next((old_ids[a] for a in source_ids if a in old_ids), event["id"])
        fingerprint = None
        if event["artists"] and event["localDate"] and event["localTime"]:
            fingerprint = (tuple(sorted(name_key(a) for a in event["artists"])), name_key(event["venue"]["name"]), name_key(event["venue"]["city"]), event["localDate"], event["localTime"], event["timeKind"])
        # Never combine separate source records from the same provider merely on
        # a fingerprint (festival products can share artist/venue/date/time).
        candidate = fingerprints.get(fingerprint) if fingerprint else None
        target = result.get(event["id"])
        if not target and candidate and not set(candidate["providers"]) & set(event["providers"]):
            target = candidate
        if target:
            merged_ids = sorted(set(target["sourceIds"] + source_ids))
            merged_providers = sorted(set(target["providers"] + event["providers"]))
            merged_styles = sorted(set(target["styles"] + event["styles"]))
            if event.get("lastVerifiedAt", "") > target.get("lastVerifiedAt", ""):
                canonical_id = target["id"]
                target.update(event)
                target["id"] = canonical_id
            target.update(sourceIds=merged_ids, providers=merged_providers, styles=merged_styles)
        else:
            result[event["id"]] = event
            if fingerprint:
                fingerprints[fingerprint] = event
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
    args = parser.parse_args()
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
