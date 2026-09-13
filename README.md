# Magic Compass

A small GitHub Pages app for nearby beer and concerts that fit your taste. No framework, runtime backend, ads or account is required.

## Try the app locally

From this folder, run:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open [the local app](http://localhost:8765). Use an HTTP server instead of opening `index.html` as a file, because the app fetches `concerts.json`. Stop the server with Ctrl+C. GPS and compass behavior still needs testing on the iPhone over HTTPS; desktop testing cannot verify physical direction.

- **Beer now:** the existing bottle, curated places and nearest-open/earliest-opening selection.
- **Concerts:** opens in a discovery-first planning view with city filters and chronological recommendations. Open a specific concert only when you want its full details, guitar compass and nearby-beer actions. Browsing does not request location; **Point to venue** starts navigation.
- **Menu / Tune your taste:** favourite artists, style suggestions, free text, cities and busy venues to watch. Artist 👍/👎 affects that artist. **Hide this gig** only hides that event and offers undo.
- **Concert feed:** **For you**, **All concerts**, **My plans** and **Busy places** are separate, bounded views. Every view shows dates and listed times, stays strictly chronological and expands eight rows at a time. Style matches show the actual matching style, such as **Punk** or **Reggae**.
- **Planning and calendar:** **+ Plan** saves a concert locally. **My calendar** opens a day-by-day agenda of every announced date, showing planned concerts by default with optional all-concert and busy-place views.
- **Ticket prices:** when a provider publishes a price range, concert details show the cheapest listed per-ticket price beside the ticket link. Prices are read from venue pages, Ticketmaster's selectable inventory and Tickster storefront products. Ticketmaster prices include its displayed per-ticket service fee; order-level fees that depend on checkout choices are not included. Events without reliable price data remain unlabeled.
- **Beer before:** currently shows curated pubs within 3 km of the venue that are open **now**, with map directions. It does not forecast opening on the gig date.
- Preferences stay in browser local storage; export/import a backup from the menu. Spotify import is visible in preferences; its button becomes available once the owner configures a Client ID. Each invited visitor signs into their own account (walkthrough below).

## Real concert data: what works now

Install the collector's timezone database once with `python -m pip install -r requirements.txt`, then run `python scripts/fetch_concerts.py`. Python 3.11+ is required. The app itself still has no runtime dependencies. The source configuration is in `data/concert-sources.json`.

| Source | Current implementation and verification |
| --- | --- |
| [Hovet](https://hovetarena.se/evenemang/musik-show/) | Live, no key. Four gigs verified again on 8 September 2026. |
| [Katalin, Uppsala](https://www.katalin.com/events/) | Live, no key. Added 94 upcoming music records on 8 September 2026. |
| [Kollektivet Livet, Stockholm](https://kollektivetlivet.se/evenemang-biljetter/) | Live, no key. 100 upcoming concert listings verified on 9 September 2026. |
| [Slakthusen: Hus 7, Slaktkyrkan, Kapellet](https://slakthusen.se/) | Live, no key. 43 upcoming concerts verified on 9 September 2026: 25 at Hus 7, 17 at Slaktkyrkan, 1 at Kapellet. |
| [BrewPunk](https://brewpunk.se/live-shows/) | Independent editorial punk calendar. Includes Kafé 44 and selected smaller Stockholm/Uppsala/Skövde venues; date-only bills keep their time unknown. |
| [Strawberry Arena](https://strawberryarena.se/evenemang/) | Official all-events calendar. Music/show entries join the concert feed; sport and other large events become configurable **Busy places** alerts. Multiple dated showings are kept separately. |
| [Kafé 44 through Nu på gång](https://nupagang.se/sv/venue/kafe-44-stockholm/) | Supplementary venue feed with original Bandsintown links. Two additional upcoming gigs checked on 9 September. |
| [Geronimo's FGT](https://www.geronimosfgt.se/shows-events-live-music/) | Direct public calendar; seven live shows checked. Follows Load More; excludes DJ, quiz, disco and bingo listings. |
| [Larry's Corner](https://larryscorner.nu/en/events) | Direct current website at `.nu`; 23 identifiable music listings checked. Poetry/art/ambiguous descriptions are not assumed to be concerts. |
| [Ticketmaster Sweden](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Working. The encrypted local key was successfully checked again on 12 September 2026, and the scheduled GitHub workflow is also refreshing successfully. |
| [Tickster Sweden](https://developer.tickster.com/documentation/eventdump) | Working. The first authenticated import succeeded on 12 September 2026 with 259 source records from Tickster's once-daily Event Dump API. |

The latest snapshot has **723 upcoming concert records** plus **18 Strawberry Arena busy-place alerts**, including 524 concerts in Stockholm, 193 in Uppsala, four in Skövde and two in Falköping, as of 12 September 2026. Tickster contributes to 257 final concert records after four cross-source merges. Coverage remains partial: conservative merging can leave cross-provider duplicates where line-ups, venue names or times differ.

Kollektivet Livet follows the public calendar's offset pages and imports only events explicitly tagged **Konsert**. It reads the card's full event date and the event page's doors time, genre tags and ticket link. Slakthusen follows the public calendar pagination, then reads full event dates from programme fields, not WordPress publication dates. It includes configured concert rooms and explicit live-music wording, excluding wrestling, comedy, quizzes and ambiguous items. Slakthusen genres are words mentioned in the title/description, labelled **Style mention** with a check-the-description explanation; these can refer to influences or earlier projects. Neither adapter invents artist identities from prose or splits titles into assumed line-ups. Full-title favourite matches still work; multi-band titles may need style matching or browsing **All concerts**.

The new venue coordinates come from map links on the venues' own pages: [Stadsgårdsterminalen](https://stadsgardsterminalen.com/kontakt/), [Hus 7](https://slakthusen.se/sylvies-head-hus-7/), [Slaktkyrkan](https://slakthusen.se/helt-off/), [Kapellet](https://slakthusen.se/chuck-ragan-kapellet/), [Skövde Kulturhus](https://www.skovde.se/uppleva-gora/boka-lokal-och-anlaggning/motes-och-konferenslokaler) and [Strawberry Arena](https://strawberryarena.se/besok-arenan/hitta-till-arenan/). Room categories can be stale: if an explicit room in the title agrees with the labelled programme venue, those fields take precedence over the category.

**Ticketmaster status:** the earlier authenticated run was real, its encrypted local key is available, and a fresh credential check succeeded on 12 September 2026. The successful scheduled runs also establish that `TICKETMASTER_API_KEY` is available to GitHub Actions. Source details distinguish **using saved listings · live refresh not connected**, **latest refresh failed**, and a successful fresh check.

The original Hovet import contains:

| Artist | Date | Venue |
| --- | --- | --- |
| Amon Amarth | 24 October 2026 | Hovet, Stockholm |
| Fontaines D.C. | 5 November 2026 | Hovet, Stockholm |
| Good Charlotte | 8 November 2026 | Hovet, Stockholm |
| Weezer | 30 May 2027 | Hovet, Stockholm |

These are real source-linked records, not UI demo events. `concerts.json` includes generation time, source health, event status and verification times. The collector distinguishes labelled doors from showtime and never creates a midnight time for date-only events. Venue coordinates come from Hovet's [directions page](https://hovetarena.se/besok-arenan/hitta-till-arenan/).

Katalin collection follows the upcoming calendar's pagination, then reads only those events' public WordPress metadata in batches. It uses the event date, not the post publication date, and includes only configured music genres; stand-up, lectures and ambiguous categories are excluded. The venue's own [map link](https://maps.app.goo.gl/E2k2n47qSQVMwUGg7) supplies coordinates. Katalin does not expose a structured line-up, so artist lists remain empty. An exact whole-title match to a favourite is labelled **Title match — check the line-up**; names embedded in tribute titles or descriptions are not assumed to be performers. Genre matches still work.

An empty city view means **no matches in current coverage**, not that there are no concerts there. The app's **Check for updates** button only downloads the latest deployed `concerts.json`; it cannot start GitHub Actions or call either ticket API. The scheduled/manual GitHub workflow is what contacts the sources, builds a new snapshot and publishes it. All sources are bounded to the configured horizon and use Swedish local dates and daylight-saving rules.

## Connect Ticketmaster next

**The repeated “live refresh not connected” message came from a temporary terminal key.** The user confirmed the key was entered for just one run; it was not saved. Closing that terminal removed it. Changing a label cannot establish a new authenticated refresh.

For persistent setup on this Windows computer, in VS Code choose **Terminal → New Terminal** in this repository and run:

```powershell
.\scripts\connect-ticketmaster.ps1
```

Paste the **Consumer Key** at the hidden prompt and press Enter. The script validates it with Ticketmaster, then saves a Windows-encrypted SecureString in the ignored `.local/ticketmaster-key.xml` and refreshes the local snapshot. The normal Python collector now automatically loads this credential on future runs under the same Windows account. Environment variables take precedence. The encrypted file is never packaged into the public site; copying it to another computer/account will not configure that environment. The script never prints the key. Add `-SetupOnly` to save/check without starting the full refresh, then use `python scripts/fetch_concerts.py --require-ticketmaster` later.

Expect **Ticketmaster key accepted**, then **Ticketmaster Sweden: ok** after the full refresh. Reload the local app to see **checked** and a new date. The phone's hosted site changes only after the updated site/snapshot is deployed. Real authentication still requires the user to enter the key once; a dummy-key encryption test does not establish Ticketmaster access.

For automatic daily refresh, also save the same Consumer Key in the repository's **Settings → Secrets and variables → Actions → New repository secret**, named exactly **TICKETMASTER_API_KEY**. The Windows encrypted file cannot configure GitHub's Linux runner. The workflow now requires a successful Ticketmaster refresh: a missing key or failed Ticketmaster request stops publication and leaves the previous site intact, rather than silently publishing a snapshot with disconnected Ticketmaster. Codex has not configured a remote secret or deployed this change.

The earlier one-session setup below remains available for temporary testing; it does not persist a key.

Your saved snapshot shows that Ticketmaster has already worked. Keep its key available in each environment where you want collection to run; the steps below also cover setting up another machine.

1. Register in the [Ticketmaster Developer Portal](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) and obtain a **Discovery API consumer key** for this hobby app.
2. In this GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret **`TICKETMASTER_API_KEY`** and paste the consumer key as its value. Keep it out of source files and chat.
4. Once these changes are pushed and you're ready to enable automation, use the workflow below. Ticketmaster collection starts automatically when the secret exists.

If your Ticketmaster app already shows **Approved**, with **Public APIs Enabled**, the account setup is done. On its **Credentials** tab, use the copy icon beside **Consumer Key**. The Discovery collector does not use **Consumer Secret** or **Callback URL**, so leave those alone. [Discovery authentication](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)

To update the app you're previewing locally, use the PowerShell commands below in a new terminal in this repository and paste the Consumer Key when prompted. The existing preview server can keep running. When the collector finishes, look for **`Ticketmaster Sweden: ok`**, then use **Check for updates** in Concerts. A GitHub Actions secret is only available to GitHub workflows; adding it there does not configure your local terminal. For the GitHub workflow, a run with **Publish** unchecked fetches/tests and uploads an artifact without updating the live site.

The collector searches music in Stockholm, Uppsala, Falköping and Skövde over the next 365 days. Edit `data/concert-sources.json` to expand collection. Changing cities in the app filters known events; it does not change server-side collection. Date windows split automatically to respect the API's deep-paging cap; unknown-date events are also queried. Requests are paced below two per second, with bounded retries. [Discovery API documentation](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)

For a local authenticated refresh in PowerShell, enter the key without adding it to command history:

```powershell
$concertApiKey = Read-Host 'Ticketmaster consumer key' -AsSecureString
$env:TICKETMASTER_API_KEY = [System.Net.NetworkCredential]::new('', $concertApiKey).Password
python scripts/fetch_concerts.py
Remove-Item Env:TICKETMASTER_API_KEY
```

The `tzdata` package in `requirements.txt` provides Swedish timezone rules on Windows. An isolated environment with it installed is already available locally at `.local/collector-venv/Scripts/python.exe`; that executable can replace `python` in collector commands. API keys are used only by the collector, not by browser JavaScript. `.env` files are ignored, but this collector does not automatically load them.

## Add Tickster

Tickster has supplied the API key. Keep it out of source files, command history and chat. The local key was accepted and stored successfully on 12 September 2026.

For persistent setup on this Windows computer, open a PowerShell terminal in VS Code and run:

```powershell
.\scripts\connect-tickster.ps1 -SetupOnly
```

Paste the key at the hidden prompt. The script validates it, then stores it as `.local/tickster-key.xml`, encrypted for the current Windows account and ignored by Git. It never prints the key. After **Tickster key accepted**, run the full local collection with:

```powershell
.\.local\collector-venv\Scripts\python.exe scripts\fetch_concerts.py --require-ticketmaster --require-tickster
```

For the daily hosted refresh, add the same value in the repository's **Settings → Secrets and variables → Actions → New repository secret**, with the exact name **`TICKSTER_API_KEY`**. The workflow requires both authenticated providers to succeed before it can publish, so a missing or rejected key leaves the previous live site intact.

Look for **Tickster Sweden: ok** and check the resulting event counts and source links. The adapter retrieves Tickster's documented once-daily compressed event dump in two requests, then locally selects individual performances in the configured cities carrying the observed `musik` or `konsert` tags. This preserves performer, style, venue and time details without exhausting the per-hour request quota. Production/collection containers and untagged events are excluded. The first live run found 259 source records: 158 in Stockholm and 101 in Uppsala; after horizon filtering and deduplication, 257 final records remained. [Event Dump API documentation](https://developer.tickster.com/documentation/eventdump)

## Enable daily refresh on GitHub Pages when ready

The local changes have not been pushed, deployed or activated. `.github/workflows/concerts.yml` is prepared for the existing repository.

1. After reviewing and pushing the changes to `main`, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
2. Open **Actions → Refresh concerts and publish Pages → Run workflow**.
3. Leave **Publish** unchecked for a fetch/test run that only uploads the public site artifact. Check **Publish** when you want that run to update the live site.

The schedule will publish daily at 05:23 UTC once this workflow is present on the default branch and Pages is configured. It uses the current published snapshot for failure recovery, then fetches and validates data and explicitly deploys a Pages artifact. It does not repeatedly commit vendor data to `main`. If the site address changes, update the workflow's `--previous-url`.

If one source fails, its recent previous records are retained for up to seven days during otherwise successful refreshes, with the failure recorded. If every enabled source fails, the collector exits unsuccessfully and the existing deployment stays untouched. That older deployment may persist longer, so the app visibly marks old data. Check source links before travelling. Schedules can be delayed or disabled after repository inactivity; the app shows when the data was last generated. [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

`scripts/package_site.py` stages an explicit allowlist of public app files, excluding credentials, personal preferences, tests and collector tooling. GitHub Pages is configured to deploy that artifact, because a `GITHUB_TOKEN` commit alone does not trigger a Pages build. [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Optional Spotify setup

**Start with the [click-by-click Spotify walkthrough](docs/spotify-setup.md).** It separates your one-time app registration from each visitor's sign-in and gives exact field values, success checks and troubleshooting.

The flow is implemented: **Concerts → Tune your taste → Connect Spotify → sign in to your own Spotify account → consent → review artists → Add selected artists**. Registering Magic Compass under your developer account identifies the app; it does not make visitors import your music. Visitors do not need developer accounts or API keys.

The connection section is visible, with a disabled button until a valid public Client ID is configured. Development-mode apps say **invited testers only**. Nothing contacts Spotify until the user starts sign-in. Declining returns to the artist/style form. Imports preserve explicit dislikes and hidden gigs, and merge only selected artists into favourites. Tokens are used for this one import and are not saved; reconnect to import again. Users can remove imported favourites in the menu and revoke the app at [Spotify account apps](https://www.spotify.com/account/apps/).

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app named **Magic Compass**, and select **Web API** if asked. Website: `https://honkstonk.github.io/`.
2. In the app settings, register these exact redirect URIs:
   - `https://honkstonk.github.io/index.html`
   - `http://127.0.0.1:8765/index.html` for local testing.
3. Copy **Client ID** into the `clientId` value in `spotify-config.json`. This is public configuration and can be committed. **Do not use Client Secret**; the browser uses OAuth PKCE with a random, short-lived, single-use state/verifier. [Spotify PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
4. Add permitted test accounts in **Settings → Users Management**. Open the local app at `http://127.0.0.1:8765/index.html`, then use the menu's Spotify option. Spotify rejects `localhost` callback addresses; begin and finish in the same browser tab/origin. Local preferences belong to that origin, so switching from `localhost` to `127.0.0.1` uses separate browser storage. [Redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)

Spotify currently requires Premium for the development-mode app owner and limits an app to five allowlisted users. A public consent button does not let unlimited visitors bypass that limit. Extended access requires an eligible organization and at least 250,000 monthly active users, among other criteria; this hobby project does not meet those stated requirements. The `accessMode` configuration changes explanatory text only, not access rights. The import requests only `user-top-read`, fetching up to 50 artists for the chosen approximate four-week, six-month or one-year period. Spotify ranks these by listening affinity, not raw play counts. Artist genres are deprecated, so the importer does not rely on them. [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Top items](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

No Spotify Client ID/account was supplied, so real consent, API access and the iPhone Safari/installed-PWA return path remain unverified. Unit tests cover PKCE, state/expiry/replay checks, denial, 403/429 responses, no token storage and safe preference merging. The menu keeps manual artist/style entry available regardless of Spotify access.

## Further event coverage

Current priority is Stockholm's small punk, hardcore and indie gigs. Kollektivet Livet and Slakthusen are now direct sources. Kafé 44's [Scen 44 page](https://kafe44.org/scen-44/) points to Facebook for current dates; its static website does not provide a dated programme. Cyklopen's checked website did not expose a reliable upcoming concert feed. Both gaps are visible under **About the concert data**, with source links. Neither is counted as an imported feed. Tickster's first authenticated run and targeted Falköping/Skövde venues remain follow-ups. Multiple venues from one operator are not counted as independent nationwide providers.

Last.fm similarity can follow once event coverage is useful. Current matches are **Favourite**, **Title match**, the actual matched style name, or **Explore**, not inferred musical relationships or invented percentages. Descriptions still explain whether a style came from source tags, page wording or BrewPunk's curated calendar. This remains a noncommercial hobby project without ads or tracking.

## Checks and implementation notes

```powershell
python -m unittest discover -s tests -v
node --test tests/concerts.test.cjs tests/concerts-ui.test.cjs tests/spotify.test.cjs
python scripts/package_site.py
```

JavaScript tests need Node 22+; it is a development tool only. A verified portable Node executable was used locally under ignored `.local/node/`. Python collector tests, JavaScript rules/controller tests and syntax checks cover feedback separation, mode switching, overnight hours, date uncertainty, deduplication, rescheduling, failed refreshes and import validation. DOM doubles do not verify browser layout, native dialogs or physical compass direction. iPhone Safari/installed-PWA testing is still needed. No offline cache has been added to `sw.js`.

The original bottle image is unchanged. The concert needle uses the user-supplied `guitar.png`, displayed upright with its aspect ratio preserved. The shared destination compass has no N/E/S/W labels. Previous needle images are excluded from the Pages artifact; the old Lucide license remains in the source checkout.

The durable brief, user preferences and progress notes are in [docs/concert-plan.md](docs/concert-plan.md). Current instruction: work directly on `main`, preserve existing edits, and do not push or deploy without a later instruction.
