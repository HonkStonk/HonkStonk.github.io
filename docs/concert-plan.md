# Magic Compass: concert extension plan

Recorded: 2026-09-05. Updated: 2026-09-09. Status: Stockholm venue expansion and clearer Spotify/Ticketmaster status implemented locally; no push or deployment by Codex.

This document preserves the project brief and inspection findings for later Codex sessions. User requirements below are established; interface, sources, milestones and architecture below are recommendations unless explicitly marked otherwise. Update this document when the user supplies preferences or makes decisions. Test the update.

## Working constraints and repository baseline

- Extend this same Magic Compass / Beer Compass webapp. Preserve its simple, satisfying beer-bottle compass interaction and existing beer functionality.
- The first session was documentation only. On 2026-09-07 the user authorized the first concert UI and real-data fetching implementation. Do not push or deploy unless later requested.
- **Current branch instruction (user, 2026-09-07): work directly on the existing local `main` branch tracking `origin/main`. This supersedes the earlier feature-branch instruction.** Recheck Git status and preserve existing uncommitted work; never reset, overwrite or discard it.
- Repository: `C:\Work\soft\MagicCompass\HonkStonk.github.io`.
- Initial branch/status: `main`, tracking `origin/main`, with no reported ahead/behind difference and a clean working tree. This reflects local tracking information; no fetch was performed.
- Inspected HEAD: `0649799` (`and one more`). No commit, branch switch, push or deployment was performed for this plan.
- No `AGENTS.md` found in the repository, including hidden paths outside `.git`, or its ancestor directories through `C:\`. No repository-specific instructions were found. No `.openai/hosting.json`, package manifest, build configuration, test suite or `.github` workflow directory exists in the inspected checkout.
- GitHub Pages hosting and primary use on iPhone are supplied by the user. Live hosting settings and the installed iPhone app were not inspected.

## Source expansion and Spotify — 2026-09-08

### Follow-up completed on 2026-09-09

User confirmed the guitar and compass changes work. Main priority is now more small Stockholm punk, hardcore and indie gigs, specifically Kollektivet Livet and Kafé 44. Tickster's API-key request is submitted and awaiting approval; do not send the user through registration again. Spotify must connect each visitor's own account, with explicit step-by-step owner setup guidance. The user also reported Ticketmaster's misleading “not connected yet” label despite existing imported listings.

- Added direct public-calendar collectors for **Kollektivet Livet** and **Slakthusen**, covering Hus 7, Slaktkyrkan and Kapellet. No new API credentials or Python dependencies. Bounded pagination, schema checks and existing per-source failure retention apply. Only explicit concerts/live-music listings are included; no fabricated dates, showtimes or performer identities. Livet's terminal empty calendar still has a next link, and its mobile summary can duplicate the desktop one; both are handled and tested.
- Slakthusen uses explicit event dates rather than BlogPosting dates. An explicit programme room agreeing with the title overrides a stale room category. Genres found in event prose use **Style mention** and explain the limitation; they are not presented as authoritative performer genres. Artist lists remain empty where no structured line-up exists. This limits favourite matching for multi-band titles; style matches and Other gigs remain available.
- Live refresh started 2026-09-08T22:07:34Z (9 September in Sweden) succeeded for all four direct venue sources. Snapshot: **435 upcoming records**, Stockholm 337, Uppsala 93, Skövde 3, Falköping 2. New sources: Livet 100, Slakthusen 43 (Hus 7 25, Slaktkyrkan 17, Kapellet 1). Three older records expired between snapshots. Hovet 4, Katalin 92 and retained Ticketmaster 196 complete the total. Records are not guaranteed unique across providers.
- **Kafé 44 / Scen 44 remains a coverage gap**: its own website directs readers to Facebook for current programme dates. No reliable dated feed was obtained. Cyklopen also remains unimported. The app now exposes these gaps with programme links; neither is claimed as a working collector.
- **Ticketmaster status fixed:** `not_configured` means the latest collector run lacked a key; it never disproved the previous authenticated success. The UI derives counts from the actual snapshot and now says **using 196 saved listings · live refresh not connected**, with the original last-check date. Fresh checks, failed refreshes with retained data, and never-connected sources are distinguished. Secrets in GitHub Actions are not automatically available locally.
- **Spotify:** visible preference section, disabled until public Client ID exists; configured development mode says invited testers only. No Client ID supplied; no live consent test done. Each visitor's OAuth flow imports their own top artists. [spotify-setup.md](spotify-setup.md) gives explicit owner and visitor steps. Current Spotify rules block arbitrary public users for a new hobby app: owner Premium, five invited accounts; extended access requires an eligible organization and at least 250k MAUs. `accessMode` changes UI wording only, not permissions. This limitation must be explained before asking the user to spend time registering.
- Verification: live collector succeeded; regression checks cover calendar pagination/duplicates, genre filtering, explicit venue corrections, date/time/DST semantics, retained-source status, Spotify gating and safe gap links. Browser visual QA could not run because the computer-use runtime reported no available browser. iPhone/PWA Spotify consent remains unverified. Work stays local on main; no commit, push or deployment by Codex.

The older implementation notes below are retained as history; this follow-up supersedes their counts, hidden Spotify UI and region-priority statements.

Latest user direction: use the newly supplied `guitar.png`; remove N/E/S/W from both destination compasses; expand event sources as the main priority; prepare optional Spotify listening-based artist import. Work remains directly on `main`. Initial status this turn was user deletions of `sg-guitar.jpg` and `sg-guitar.png`, plus untracked `guitar.png`; those deletions are preserved. No other uncommitted changes were present.

Implemented:

- The shared compass now has no cardinal-letter elements/styles, and uses `guitar.png` in concert mode. Original bottle, heading math and beer selection/opening-hours code are unchanged. Public packaging includes the new image and removes only retired images from the generated staging folder.
- **Katalin, Uppsala:** live public-calendar adapter. Follows upcoming `?tab=` pagination and batch-reads the corresponding public WordPress event fields. Filters configured music genres; does not crawl historical archives or confuse post publication date with event date. Extracts explicit local times, ticket links and genre labels. Coordinates verified through the map linked by the venue: 59.8601379, 17.6452262. No structured performer list is exposed, so `artists` is empty; the UI can make an explicitly labelled whole-title match to a favourite, without interpreting promotional text or tribute titles as artist identities.
- **Ticketmaster:** the user's committed snapshot already contained 197 records with successful source status, verified 2026-09-07T22:49:21Z. This supersedes the earlier statement that no authenticated import had been seen. No key is available in the present agent terminal; recent records are retained with original timestamps. No credentials were inspected or printed.
- **Tickster:** adapter against the [published v1.0 OpenAPI schema](https://event.api.tickster.com/swagger/v1/swagger.json). Uses `X-API-KEY`, city searches for observed `musik`/`konsert` tags, `take`/`skip` pagination, detail requests for performers/coordinates/UTC times, and skips production/collection containers. Tags do not guarantee complete music coverage. Bounded requests and all-or-source failure retention. Workflow reads `TICKSTER_API_KEY` in addition to Ticketmaster's secret. **Authenticated access and actual resulting coverage remain unverified.** The [key request link](https://developer.tickster.com/register) returned 403 to the automated check; user should try their browser and request access for the hobby app.
- Collector now uses IANA Swedish timezone rules, including DST and local-day boundaries. `requirements.txt` pins `tzdata==2026.3`, verified available from PyPI. This is needed on Windows; installed in the ignored local virtual environment `.local/collector-venv/`. GitHub workflow installs requirements. Global Python environment was not modified.
- **Spotify:** `spotify.js` implements opt-in Authorization Code with PKCE, single-use state and a 15-minute pending-session limit, one top-artists request with `user-top-read` and a selected approximate 4-week/6-month/1-year range. Top artists reflect Spotify's affinity ranking, not exact play counts. Artist genres are deprecated and not used. Tokens are not persisted; consent denial/API failure returns to manual preferences. Review checkboxes merge chosen names into favourites without overriding dislikes or hidden events. Current manual form edits are saved before redirect, as explained in the UI. Client-ID configuration is public in `spotify-config.json`, currently empty; the connect section is hidden until configured. No actual Spotify consent or iPhone/PWA return has been verified.

Live source check at 2026-09-08T21:13:34Z: Hovet 4 fresh records, Katalin 94 fresh music records, 197 recent Ticketmaster records retained, Tickster not configured. Expanded snapshot: **295 records**, distributed across Stockholm 195, Uppsala 95, Skövde 3, Falköping 2. These counts reflect records, not guaranteed unique performances; conservative merging can leave duplicates across providers when venue names, line-ups or time semantics differ. Do not count Hovet and Katalin as nationwide ticket providers.

Validation: Python adapter tests cover source pagination/incompleteness, genre filtering, Swedish midnight/DST, nullable empty results, source failure retention and secret redaction; JavaScript tests cover title matching, consent opt-in, PKCE/state/expiry/replay, API errors and preference merging, alongside existing beer/concert rules. Real Katalin fetching succeeded. Browser rendering and physical iPhone behavior were not tested.

Next user setup (full steps in README):

1. Request Tickster public Event API access; store the approved key as `TICKSTER_API_KEY` in the environment used for collection. Validate its first live run and granted rate limit before claiming coverage.
2. In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create a Web API app. Register `https://honkstonk.github.io/index.html` and local `http://127.0.0.1:8765/index.html`. Put only its public Client ID in `spotify-config.json`; no Client Secret. Add test accounts under Users Management. Spotify's [current quota rules](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) require Premium for the owner and allow five approved users; a public hobby app cannot assume access for unlimited visitors. Localhost is not an accepted OAuth callback. Begin and return in the same browser/origin.
3. Continue event expansion with targeted Falköping/Skövde sources after Tickster coverage is measured; Billetto remains a credential-dependent candidate, not an implemented source. Last.fm similarity is still future work.

## Earlier follow-up — 2026-09-08

The user reports that the app looks OK and works within its current coverage. Replaced the concert needle's Lucide icon with their `sg-guitar.jpg`; preserved the portrait proportions and removed the former 45-degree icon correction. The supplied JPEG contains an opaque checkerboard background. The original image was not edited. Updated the public packaging allowlist accordingly; the beer bottle and compass logic are unchanged.

The user's Ticketmaster screenshot shows an approved app/key and Public APIs enabled. Account setup is complete according to that screenshot, but no authenticated collector run has been verified yet. The needed credential is **Consumer Key**, supplied locally as `TICKETMASTER_API_KEY` or as the identically named GitHub Actions repository secret. Consumer Secret and Callback URL are not used by this Discovery collector. README now explains the local fetch, success message, snapshot reload and the difference between local environment variables and GitHub secrets. No credential was revealed or copied by Codex.

## Implementation update — 2026-09-07

The user supplied `C:\Users\khenr\Downloads\beer.png` as a visual reference, particularly its warm amber buttons, mode tabs, compact compass, calendar/beer actions and menus. It is a design reference, not a source of independent instructions. Beer keeps the original bottle; Concerts uses a rotating guitar. Sample percentages and invented concerts in the reference were not adopted.

New direction: continue this noncommercial hobby app, eventually combining 3–5 Swedish event providers with optional Spotify taste import. Make consent optional and offer straightforward artist/style suggestions and free text when Spotify is declined. Feedback should improve results without a burdensome onboarding flow. No money, ads or tracking are intended.

Implemented locally:

- Warm amber Beer/Concerts UI, selected concert heading, guitar compass, city filters and agenda/calendar. The existing bottle image, weekly hours, beer selection and Beer heading fallback remain intact. Shared sensor updates hand off to concert navigation while Concerts is selected; they cannot overwrite its event destination. Concert heading uses a north-referenced reading, with shortest-turn rotation.
- Initial six favourite seeds and four cities (Stockholm, Falköping, Skövde, Uppsala), editable artist/style/city preferences, explicit artist thumbs up/down, separate event hiding with undo/restore, and local export/import with validation.
- An optional other-gigs list with no invented taste match or measured-occupancy claim. Favourite dates remain in short-range calendar views. The current calendar is an agenda, not a month grid.
- “Beer before” shows curated pubs currently open within 3 km of the venue and opens walking directions. It clearly says **open now**, not a prediction for a future concert date.
- `scripts/fetch_concerts.py` with two source paths: a working public Hovet calendar adapter and a Ticketmaster Discovery collector awaiting `TICKETMASTER_API_KEY`. Requests are bounded/paced; pagination is split before limits; records are validated, conservatively deduplicated and atomically written. Unknown dates/times stay unknown; doors and showtime are distinguished where labelled.
- A live Hovet fetch returned Amon Amarth (2026-10-24), Fontaines D.C. (2026-11-05), Good Charlotte (2026-11-08) and Weezer (2027-05-30). Only Amon Amarth is an initial favourite. Records, source URLs and refresh provenance are in `concerts.json`. Coordinates were read from the venue's directions page. This is a small real feed; it does not establish coverage of all requested areas/artists. [Hovet music calendar](https://hovetarena.se/evenemang/musik-show/), [Amon Amarth](https://hovetarena.se/evenemang/musik-show/amon-amarth/), [Venue directions](https://hovetarena.se/besok-arenan/hitta-till-arenan/)
- A prepared GitHub workflow tests, refreshes and stages a public-file allowlist, with manual artifact-only/publish options and a daily 05:23 UTC publishing schedule. It is not active remotely: no changes have been pushed or deployed. README explains how to add the API secret and enable Pages when ready. The workflow uses deployment artifacts, not daily source commits.
- Manifest display name/theme aligned with Magic Compass and the new colours; service-worker registration made relative. `sw.js` still provides no offline cache.

Validation: 12 Python collector tests and 15 JavaScript rules/controller tests passed, along with syntax checks. The live fetch succeeded without credentials. Browser rendering and iPhone hardware behavior have not been tested; controller tests use DOM/sensor doubles. The existing beer file was also exercised for opening/closing boundaries, midnight, mode switching and heading updates.

Remaining work: authenticated Ticketmaster run and comparison with known venue gigs; broader region/venue coverage; Tickster and Billetto adapters; optional Spotify PKCE import and Last.fm similarity; improved forecasting for beer before a future gig; offline handling and iPhone testing. See README for the verified access requirements and activation instructions. No third-party accounts were created and no API keys were supplied or stored.

The repository was clean at the start of this implementation, at HEAD `21fb312` (`test`). Its existing planning-document wording was preserved where not superseded. The sections below retain the initial inspection/proposal for historical context; code line numbers and statements of what did not yet exist describe the 2026-09-05 baseline.

## Carried-over user brief

The existing PWA points a beer bottle toward nearby places from a curated list that are currently open and sell beer. Its simplicity and compass feel matter.

The desired extension is a concert calendar and concert compass, allowing the user to know when favourite bands and related artists play in chosen regions of Sweden without checking Facebook, Instagram, TikTok or numerous ticket websites.

Established requirements:

1. Music taste matters most, followed by location/travel distance and timing.
2. Major favourites must remain visible even when concerts are months away.
3. Support favourite artists and styles, artist likes/dislikes, and separately hiding individual events. Disliking a date must never teach the app that the artist is disliked.
4. Suggest related artists and explain why they match.
5. Let explicit feedback improve recommendations.
6. Optionally show other concerts as context for potentially busy venues or areas. These are possible crowd warnings, never measured occupancy.
7. Keep the existing beer functionality working.

Ideas discussed previously, explicitly not final design decisions:

- Beer and Concerts modes sharing the compass.
- A concert calendar with an agenda view.
- Selecting an event points the compass toward its venue.
- “Beer before this gig” finds suitable beer places near the venue.
- Initially store preferences locally, with export/import for backup.
- A scheduled GitHub Action retrieves, normalizes and deduplicates events, then publishes `concerts.json` for the PWA.
- Investigate Ticketmaster Discovery API access and actual Swedish coverage; add targeted venue sources where needed.
- Last.fm artist similarity and optional Spotify import are possibilities.
- No fixed ranking percentages have been agreed.

Requested first step: inspect applicable instructions, Git status, app, manifest, service worker, opening hours and compass; save this brief and findings; recommend a small milestone covering data and interface; ask only the questions needed next, especially artists and regions.

## User preferences supplied during this session

Initial artists, preserving the user's spelling:

- Dina Ögon
- Amon Amarth
- Cardigans
- Eek-a-mouse
- Asta Kask
- Kardborrebandet

The user wants to see these artists and similar acts. Treat all six as explicitly liked/favourite seeds. No relative priority or separate must-see designation was supplied. Resolve provider IDs and aliases during the data audit; do not silently map an ambiguous name to a different act. No explicit genre labels or dislikes were supplied, so style preferences should remain editable and initially unset rather than inferred as definitive.

Initial cities/areas of interest:

- Stockholm
- Falköping / Skövde (include both cities)
- Uppsala

More places may be added later. These are destination interests, not a declared home location, county boundary or travel radius. Home base, surrounding-area radius and normal-versus-must-see travel tolerance remain unspecified; they are not needed to begin city-based coverage checks.

The user reiterated the intended preference inputs: a manually entered favourite list, optional Spotify top artists across its approximate four-week/six-month/one-year affinity windows, related artists from Last.fm, and subsequent thumbs-up/down feedback. Preserve all four possibilities. The API claims are checked below; this does not make either external service a prerequisite for the first milestone.

## Verified repository findings

| Area | Current implementation | Consequence for the extension |
| --- | --- | --- |
| Interface | `index.html` has a Beer Compass heading, one “Find Nearest Beer!” button, bottle image and distance/hours/status text. | Add a compact way into Concerts without making beer discovery take more steps. |
| Presentation | `style.css` uses a dark, centered layout, a 220px circular compass, and a bottle at 85% of its container. Rotation has a 0.2-second linear CSS transition. | Preserve this visual identity and validate motion on the actual iPhone. |
| App structure | Plain HTML/CSS and one 871-line `script.js`; no framework or build step. | A small vanilla-JavaScript addition is sufficient; no framework migration is indicated. |
| Beer data | `beerShops` contains 104 hard-coded entries, mostly around greater Stockholm plus one Uppsala entry. Includes Systembolaget and pubs/restaurants. | This describes current beer coverage, not the user's desired concert regions. There are no stable place IDs or explicit shop/pub type fields. |
| Manifest | Valid JSON; generic name “My Compass/GPS PWA”, short name “My PWA”, `start_url: "."`, standalone display, white theme/background and an empty icons array. | Branding and installation metadata are unfinished; they need not block a first concert slice. |
| Service worker | Registered at `/sw.js` from `script.js:854`. `sw.js` only logs installation and has an empty fetch listener. | There is no implemented offline cache or data-refresh strategy. Root-relative registration needs review if previewed under a subpath. |
| Preferences/data access | No local preference storage, external event fetching, concert data, backend or scheduled ingestion exists. | All concert capabilities are new work. |

### Opening hours and beer target selection

- `findTargetShop()` (`script.js:358`) requires a GPS position, calculates straight-line distances, and chooses the nearest currently open entry.
- If every entry is closed, it chooses the earliest next opening time across the list, then the nearest entry among those opening at that time. This fallback is part of current behavior and must be preserved.
- `getShopStatus()` (`script.js:437`) checks yesterday's overnight hours before today's hours, then searches forward for the next opening. Weekday keys are 0–6; values are `[openingHour, closingHour]` or `null`. Both closing at `0` and at `24` occur in the data.
- Opening is inclusive and closing is exclusive. Calculations use the device's local `Date` timezone. Hours are weekly, whole-hour schedules; there are no holiday exceptions, split shifts or real-time verification of the curated hours.
- `updateDisplay()` (`script.js:651`) recalculates the beer target, bearing and hours on each position update, each heading update and a one-minute timer. `updateOpeningHoursDisplay()` prefers the attached `statusInfo`; the present main update path regenerates it.
- Future concert times should explicitly use `Europe/Stockholm`; future “beer before” evaluation must use the intended visit time. Existing “open now” data alone cannot establish suitability for a future gig.

### Compass and permissions

- Helpers at `script.js:315` and `script.js:333` calculate haversine distance in kilometres and initial bearing. Needle rotation is `bearing - currentHeading`.
- The start button calls `DeviceOrientationEvent.requestPermission()` when available, directly from the user action, then starts high-accuracy `watchPosition` with a 20-second timeout and no accepted cached position.
- `handleOrientationUpdate()` (`script.js:721`) currently prefers `alpha` when `absolute === true`, then `webkitCompassHeading`, then any non-null `alpha`. It listens to both `deviceorientationabsolute` and `deviceorientation`.
- The relative-alpha fallback is not proof of a north-referenced heading. Actual heading direction, accuracy, screen rotation and the 359°/0° transition remain device-validation points, not newly confirmed bugs.
- Location permission denial stops tracking. Orientation denial still permits GPS use, although later display updates can replace the permission message with a waiting message.
- `stopTracking()` removes listeners/watch/timer. The visibility-change handling is commented out; there is no active background/resume policy.
- Simply assigning an event to `targetShop` will not work: every `updateDisplay()` immediately replaces it with a beer target. A later implementation should separate destination selection from shared sensor/needle rendering so heading updates cannot steal an explicitly selected concert destination.

### Verification performed and limits

Read all seven tracked files' text where applicable and inspected the bottle's HTML/CSS use. Parsed the manifest. Executed the existing JavaScript in an isolated V8 evaluation with DOM/browser stubs, without changing files or requesting device permissions.

Eight opening-hours checks passed: before opening, exact opening, exact closing, Sunday-to-Monday, yesterday's overnight interval, overnight closing boundary, and midnight expressed as 24 or 0. At a fixed Huddinge position, selection checks passed for Monday noon (nearest open: Systembolaget Huddinge C) and Monday 06:00 (none open; earliest opening then distance: Casa Bianca). Four cardinal-bearing checks returned 0°, 90°, 180° and 270°.

These are limited logic checks, not browser, sensor, DST or iPhone installation tests. No permanent test files were added. `node` was unavailable on this shell's PATH; the checks used the tool's JavaScript runtime. Real business hours and individual coordinates were not externally audited.

## Data-source investigation

Checked official sources on 2026-09-05. Documentation establishes available interfaces, not completeness for this user's music taste.

### Ticketmaster: documented capabilities

- The Discovery manual lists Sweden (`SE`) as supported. [Discovery manual](https://developer.ticketmaster.com/products-and-docs/apis/discovery-manual/v2/)
- A developer account and API key are required. Ticketmaster says Discovery access is available after registration; no ticket-purchase integration is needed for event discovery. Account creation and access for this project have not been tested. [Getting started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
- Discovery v2 documents country, city, location/radius, date, classification, attraction and venue filters. Its schema includes event IDs/URLs, artists, venues/coordinates, dates/timezones and event status, but individual records may be incomplete. It documents a 1,000-result deep-paging restriction. [Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
- Official rate-limit pages disagree: the API reference says 5 requests/second; the FAQ says 2. Both state 5,000/day. Proposed collector: stay at or below 2/second, inspect actual quota headers, and back off on 429 responses. [API limits](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/), [FAQ](https://developer.ticketmaster.com/support/faq/)
- Bulk Discovery Feed access should not be assumed: its v2 documentation describes public key-based access, while the FAQ describes approved partners. Keep it outside the first milestone unless access is verified. [Discovery Feed](https://developer.ticketmaster.com/products-and-docs/apis/discovery-feed/), [FAQ](https://developer.ticketmaster.com/support/faq/)

### Swedish listings actually observed

Public Ticketmaster Sweden pages provide concrete examples across cities:

| Listing | Venue/city | Advertised date | Evidence |
| --- | --- | --- | --- |
| Megan Moroney | Cirkus, Stockholm | 2026-09-15 | [Event page](https://www.ticketmaster.se/event/megan-moroney-the-cloud-9-tour-biljetter/1295529769) |
| Glamorama | Park Lane, Göteborg | 2026-09-12 | [Event page](https://www.ticketmaster.se/event/glamorama-biljetter/2002143389) |
| Ida-Lova + Tjuvjakt | Sara kulturhus, Skellefteå | 2026-09-12 | [Event page](https://www.ticketmaster.se/event/ida-lova-tjuvjakt-biljetter/348096982) |

The music listing also showed Ella Mai and a separate Ella Mai VIP package at the same venue/date/time. That is a concrete reason to distinguish performances from ancillary ticket products during deduplication. [Swedish music listings](https://www.ticketmaster.se/category/musik/10001?page=1)

These are website observations, not authenticated Discovery responses, favourite-artist selections or evidence of complete Swedish coverage. No project API key was supplied and no authenticated API calls were made. Small independent venues, festival line-ups, support acts, missing coordinates and long-range dates remain unmeasured. No coverage percentage is justified yet.

### Access and publishing implications

Ticketmaster's published terms limit storage to reasonable service-related periods and require requested removals within 24 hours. They also require disclosure of visitor-data practices. The text does not establish a blanket 24-hour cache lifetime. Proposed implication: prefer a replaceable deployment snapshot with a defined retention/removal policy over accumulating vendor event payloads indefinitely in Git history; settle that policy before enabling publication. [General terms](https://developer.ticketmaster.com/support/terms-of-use/)

Keep a future API key in a GitHub Actions secret or local environment, out of browser code, generated JSON, logs and this document. The public event snapshot should not contain personal feedback or location. Source URLs should lead to the original event details/tickets.

### Similarity and import options

Last.fm documents `artist.getSimilar`, accepting artist name or MusicBrainz ID and an API key, without user-session authentication. It returns a similarity value. This could support an honest explanation such as “Last.fm relates this artist to [favourite].” It does not by itself establish Swedish gig coverage or a musical explanation such as shared instrumentation. Artist identity matching and usefulness for the user's taste remain untested. [Last.fm API](https://www.last.fm/api/show/artist.getSimilar)

Spotify's top-items endpoint documents artist affinity over approximately four weeks (`short_term`), six months (`medium_term`) and one year (`long_term`), confirming the time windows from the user's earlier discussion. It requires user OAuth authorization with `user-top-read`. [Spotify top-items API](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

Spotify currently documents a Premium requirement for a development-mode app's owner and a limit of five allowlisted authenticated users. No Spotify app, account eligibility or authenticated import was tested here. Manual entry can start immediately; optional Spotify import remains a follow-up with explicit user-selected additions, not an automatic overwrite of favourites or dislikes. [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

## Recommended first milestone: favourite gigs to venue compass

One small end-to-end slice: a repeatably generated, checked snapshot of real concerts for Stockholm, Falköping/Skövde and Uppsala, displayed in this app with the six supplied favourite seeds and venue targeting. Proposed scope below is not a final interface or implementation agreement.

### First establish useful data

1. Start with the six supplied artists and the three selected areas, including both Falköping and Skövde. Make artist/city lists expandable. Use city-based coverage initially; do not invent a home base, must-see hierarchy or exact travel radius.
2. With project API access available, retrieve Sweden music events in bounded date windows and resolve favourite artist identities. Suggested initial browsing horizon: 12 months; separately look for all available future must-see dates so a short browsing window does not erase them. Display the actual search horizon.
3. Split large queries before reaching the paging limit; record queried regions/windows and any incomplete results. Include unknown-date cases deliberately rather than silently omitting them when date filters are used.
4. Compare API results with a small named sample of official artist/venue calendars: aim for 10 known upcoming gigs across 3–5 relevant venues, or report the actual smaller sample available. Record each expected event, API match/miss, source URL, artist match, date and coordinate quality. Include a months-away favourite if one is announced. Do not manufacture examples when no favourite has an announced show.
5. If meaningful shows are missing, investigate one targeted official venue/calendar source, preferably a structured feed. Verify its access and reuse conditions before adding an adapter. A small manually maintained, source-linked supplement can bridge a gap, visibly marked with its verification date; it is not complete automated coverage.
6. Produce a normalized `concerts.json` using a repeatable local refresh command first. Validate before replacing the prior snapshot. Keep source/refresh errors distinct from a legitimate “no matching gigs” result. A demo-only fixture does not complete this milestone.

### Fit the current interface

- Keep Beer as the initial mode with the current button and bottle compass. Add a compact Beer / Concerts switch; no separate app or new navigation system is necessary.
- Concerts opens a phone-friendly agenda grouped by date/month. Put a compact “Favourites ahead” group above it, including must-see shows beyond the currently selected near-term window. Show artist, date/time, venue/city, source link and why it appears.
- Offer simple region/date controls, with favourite visibility independent of the agenda's short date filter. A chronological agenda is navigation; musical relevance determines matching groups, not a fixed weighted score. Initial relevance tiers can be must-see favourites, other liked artists and explicit style matches. Show location/distance and timing within those groups.
- “Point to venue” selects a stable concert destination and brings the existing compass into view with the event/venue label. Switching back to Beer restores automatic beer selection. Returning to Concerts retains the selected event where practical.
- Browsing requires no sensor permissions. Ask for sensors from a direct tap when starting compass navigation. With no GPS/heading, the event details and source link remain usable. With no verified venue coordinates, disable pointing and explain why.
- Start with straight-line distance, clearly labelled. It is not walking, driving or public-transport time. Use a chosen home base for planning when supplied; use current location for the active compass.
- Add explicit local artist feedback and “Hide this event,” with undo/restore, plus a small settings view for favourites/styles and preference export/import. Event hiding has no artist-learning side effect.

### Keep the first slice bounded

Defer a month-grid calendar, background notifications, Spotify import, automated artist-similarity expansion, crowd context and “beer before” until the real-data agenda and compass work. These remain intended follow-ups, not removed requirements. Style-match explanations in the first slice must be labelled as style matches; they must not masquerade as verified related-artist recommendations.

Daily ingestion is the next operational step after the coverage check and snapshot format settle. This first milestone can refresh manually; freshness must always be visible, and it is not yet an unattended discovery service.

### Acceptance checks for that milestone

- Real, source-linked gigs for the selected areas render, with an honest coverage/freshness note; API failure is distinguishable from no gigs.
- An available months-away favourite stays visible when the agenda is narrowed to near-term dates.
- Hiding one performance leaves the artist preference and the artist's other performances unchanged, including after refresh/import; artist dislike applies to that artist and is reversible.
- Preference export/import survives a round trip with schema validation. An invalid import does not replace existing preferences.
- Selecting a concert points toward its venue and remains selected through heading/GPS updates; returning to Beer still selects the nearest open entry or the existing earliest-opening fallback.
- Missing coordinates/times, cancellations/reschedules, duplicate ticket packages and malformed/failed data loads have explicit handling.
- Check on iPhone Safari and the installed PWA: permissions granted/denied, repeated starts, mode switches, heading wraparound, background/resume, small-screen layout and the existing bottle motion. Desktop stubs cannot establish compass feel.

## Proposed data and feedback boundaries

Keep these boundaries when implementing; exact property names remain provisional.

| Record | Minimum useful content |
| --- | --- |
| Snapshot | Schema version, generation time, per-source last successful fetch, coverage regions/date windows, completion/errors, events. |
| Event | Stable canonical ID; source IDs/URLs; title; artist IDs/names and known roles; venue ID/name/city/coordinates; local date/time and timezone; UTC instant when known; time/date uncertainty; status; last verified time. |
| Artist preference | Stable artist identity/aliases, must-see/favourite status and explicit like/dislike/neutral state. Resolve conflicting controls explicitly. |
| Style preference | User-selected style labels and likes/dislikes; no invented similarity precision. |
| Event feedback | Hidden event IDs and optional event-specific reason, stored separately from all artist/style preferences. |
| Region settings | Selected regions/cities and optional origin/distance preferences; no automatic public upload. |
| Related-artist evidence (later) | Seed favourite, suggested artist, source, similarity/tag evidence and retrieval time, sufficient to explain the suggestion. |

Deduplicate by source ID first. Cross-source matching should use resolved artists, venue and performance date/time, preserving source aliases. Do not merge distinct nights, matinee/evening shows, festival passes or VIP products just because names resemble each other. Preserve identity across reschedules where the source establishes continuity so feedback does not disappear. A missing event in one failed or partial fetch is not evidence of cancellation.

Unknown time stays unknown; never turn it into an invented midnight start. Distinguish doors and performance times when known. An event being sold out is different from being cancelled, and unavailable ticket inventory should not automatically erase a favourite.

Local explicit likes/dislikes can immediately change matching groups. Event hiding must never propagate through the artist similarity graph. Later similarity can be recomputed against locally liked seeds without claiming an opaque model has learned from date rejection. For multi-artist bills, show which artist matched; do not silently veto a favourite because a support act is disliked.

For initial backup, use a versioned JSON preference export. Browser-local preferences are not a backup and should not be assumed to sync between devices or browser/install contexts. No backend or account is necessary for this proposal.

## Follow-ups after the first milestone

- **Scheduled refresh:** a GitHub Action retrieves data, validates/deduplicates it and builds a complete deployable site snapshot containing `concerts.json`. Preserve the last good data on source failures within the agreed retention policy and display its age. Keep a manual refresh trigger and source diagnostics.
- **GitHub Pages integration:** check the repository's actual publishing configuration first. Commits made with `GITHUB_TOKEN` do not trigger a Pages build; do not assume an automated JSON commit updates the live app. An explicit Pages workflow is a documented option. [Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- **Scheduler reliability:** scheduled workflows run on the default branch, can be delayed/dropped, and public-repository schedules may disable after 60 days without repository activity. Use a visible last-success timestamp and documented recovery; freshness cannot depend on silent assumptions. [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- **Related artists:** evaluate Last.fm results against this user's taste, retain evidence and let likes/dislikes change suggestions. Add only useful venue sources based on observed misses.
- **Beer before this gig:** search curated places near the venue for the intended pre-show visit time, with a selectable compass destination. Decide which places are suitable for drinking on site; the current list mixes shops and pubs. Existing weekly hours are only a forecast for a future date, and coverage outside Stockholm is sparse.
- **Crowd context:** an optional separate layer of nearby events with dates and source links. Use wording such as “Other events nearby — this area may be busier.” Never claim live occupancy, guaranteed crowding or attendance inferred from tickets; do not assume an end time when none is supplied.
- **Offline and PWA polish:** define shell/data update behavior and stale-data labels before adding caching; review manifest branding/icons. A service worker being registered does not mean these capabilities already exist.

## Remaining unknowns and next-session handoff

The two initial questions about artists and regions were answered; their answers are recorded above. No further answer is needed to finish this planning step or begin a later coverage audit.

Still unspecified: a must-see hierarchy, explicit styles/dislikes, home base, travel tolerance and precise surrounding-area boundaries. Ask about these only when they affect the next concrete decision. Do not make the initial data check depend on a complete taste profile.

No ranking percentage or final interface has been chosen. Ticketmaster credentials and source-specific access can be addressed when the first actual data fetch is prepared; do not request secrets in chat or commit them.

Next session: read the implementation update above and any new repository instructions, recheck Git status, and continue directly on `main` while preserving the working tree. The next data step is an authenticated Ticketmaster fetch after the user supplies its key through local environment or GitHub Actions secrets, followed by a coverage audit for the recorded artists/cities. Publishing remains outside the current authorization.
