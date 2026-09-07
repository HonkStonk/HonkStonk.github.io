"""Fetch public concert facts into a static snapshot. Python 3.11+, standard library only.

No user preferences or credentials are included in the output. Venue adapters use
explicitly configured public calendars; Ticketmaster uses TICKETMASTER_API_KEY.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "MagicCompass/0.1 (personal concert calendar; https://honkstonk.github.io/)"


def name_key(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def safe_url(value):
    parsed = urlparse(str(value or ""))
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def fetch(url):
    """Bounded retries and response sizes; never print URLs containing credentials."""
    for attempt in range(3):
        time.sleep(0.55)  # Below both published Ticketmaster per-second limits.
        try:
            with urlopen(Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/html"}), timeout=25) as response:
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
        if not isinstance(event["artists"], list) or not isinstance(event["venue"].get("city"), str):
            raise ValueError("Invalid event artist or venue data")


def refresh(config, previous, now, venue_collector=collect_venue, ticketmaster_collector=collect_ticketmaster):
    sources, events = [], []
    old_sources = {s["id"]: s for s in previous.get("sources", [])}
    jobs = [(s["id"], s["name"], lambda s=s: venue_collector(s, now)) for s in config["venueSources"]]
    api_key = os.environ.get("TICKETMASTER_API_KEY", "").strip()
    jobs.append(("ticketmaster", "Ticketmaster Sweden", (lambda: ticketmaster_collector(config, api_key, now)) if api_key else None))
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
    day = now[:10]
    events = [e for e in deduplicate(events, previous.get("events", [])) if not e["localDate"] or e["localDate"] >= day]
    validate(events)
    return {"schemaVersion": 1, "generatedAt": now, "coverage": {"cities": config["cities"], "horizonDays": config["horizonDays"], "complete": False, "note": "Hovet music calendar; Ticketmaster city searches when connected. Other venues and providers are not yet covered."}, "sources": sources, "events": sorted(events, key=lambda e: (e["localDate"] or "9999", e["title"]))}


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
