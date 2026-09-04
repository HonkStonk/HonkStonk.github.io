# Magic Compass: concert extension plan

Recorded: 2026-09-05. Status: initial inspection and proposal; no implementation approved or started in this session.

This document preserves the project brief and inspection findings for later Codex sessions. User requirements below are established; interface, sources, milestones and architecture below are recommendations unless explicitly marked otherwise. Update this document when the user supplies preferences or makes decisions.

## Working constraints and repository baseline

- Extend this same Magic Compass / Beer Compass webapp. Preserve its simple, satisfying beer-bottle compass interaction and existing beer functionality.
- This session is documentation only: inspect and write this plan; leave application code unchanged; do not push or deploy.
- For later implementation, first inspect Git status again, use a feature branch (suggested name: `feature/concerts`), and preserve any existing uncommitted work. Do not reset, overwrite or discard it.
- Repository: `C:\Work\soft\MagicCompass\HonkStonk.github.io`.
- Initial branch/status: `main`, tracking `origin/main`, with no reported ahead/behind difference and a clean working tree. This reflects local tracking information; no fetch was performed.
- Inspected HEAD: `0649799` (`and one more`). No commit, branch switch, push or deployment was performed for this plan.
- No `AGENTS.md` found in the repository, including hidden paths outside `.git`, or its ancestor directories through `C:\`. No repository-specific instructions were found. No `.openai/hosting.json`, package manifest, build configuration, test suite or `.github` workflow directory exists in the inspected checkout.
- GitHub Pages hosting and primary use on iPhone are supplied by the user. Live hosting settings and the installed iPhone app were not inspected.

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

Next session: read this document and any new repository instructions, recheck Git status, and use the recorded artists/cities to refine the coverage sample. If implementation is requested, create/use a feature branch while preserving existing work, then complete the data-to-agenda-to-compass slice. Publishing remains outside the authorization given for this planning session.
