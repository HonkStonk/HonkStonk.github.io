# Magic Compass

A small GitHub Pages app for nearby beer and concerts that fit your taste. No framework, runtime backend, ads or account is required.

## Try the app locally

From this folder, run:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open [the local app](http://localhost:8765). Use an HTTP server instead of opening `index.html` as a file, because the app fetches `concerts.json`. Stop the server with Ctrl+C. GPS and compass behavior still needs testing on the iPhone over HTTPS; desktop testing cannot verify physical direction.

- **Beer now:** the existing bottle, curated places and nearest-open/earliest-opening selection.
- **Concerts:** guitar compass, favourite/style matches, city filters, agenda and source links. Browsing does not request location. Tap **Point to venue** to start navigation; hold the phone flat.
- **Menu / Tune your taste:** favourite artists, style suggestions, free text and cities. Artist 👍/👎 affects that artist. **Hide this gig** only hides that event and offers undo.
- **Calendar:** favourite concerts remain visible outside the selected short date window.
- **Beer before:** currently shows curated pubs within 3 km of the venue that are open **now**, with map directions. It does not forecast opening on the gig date.
- Preferences stay in browser local storage; export/import a backup from the menu. There is no Spotify connection yet.

## Real concert data: what works now

`python scripts/fetch_concerts.py` retrieves the public [Hovet music calendar](https://hovetarena.se/evenemang/musik-show/) and each event's structured MusicEvent metadata. No key is needed for that source. The first live run on 7 September 2026 returned:

| Artist | Date | Venue |
| --- | --- | --- |
| Amon Amarth | 24 October 2026 | Hovet, Stockholm |
| Fontaines D.C. | 5 November 2026 | Hovet, Stockholm |
| Good Charlotte | 8 November 2026 | Hovet, Stockholm |
| Weezer | 30 May 2027 | Hovet, Stockholm |

These are real source-linked records, not UI demo events. `concerts.json` includes generation time, source health, event status and verification times. The collector distinguishes labelled doors from showtime and never creates a midnight time for date-only events. Venue coordinates come from Hovet's [directions page](https://hovetarena.se/besok-arenan/hitta-till-arenan/).

Only Hovet is connected without a key. An empty Uppsala, Falköping or Skövde view means **no matches in current coverage**, not that there are no concerts there. The app's update button reloads the published snapshot; it does not run a scraper from the phone.

## Connect Ticketmaster next

The collector is implemented, but an authenticated live request has not been tested because no project key was supplied.

1. Register in the [Ticketmaster Developer Portal](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) and obtain a **Discovery API consumer key** for this hobby app.
2. In this GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret **`TICKETMASTER_API_KEY`** and paste the consumer key as its value. Keep it out of source files and chat.
4. Once these changes are pushed and you're ready to enable automation, use the workflow below. Ticketmaster collection starts automatically when the secret exists.

The collector searches music in Stockholm, Uppsala, Falköping and Skövde over the next 365 days. Edit `data/concert-sources.json` to expand collection. Changing cities in the app filters known events; it does not change server-side collection. Date windows split automatically to respect the API's deep-paging cap; unknown-date events are also queried. Requests are paced below two per second, with bounded retries. [Discovery API documentation](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)

For a local authenticated refresh in PowerShell, enter the key without adding it to command history:

```powershell
$concertApiKey = Read-Host 'Ticketmaster consumer key' -AsSecureString
$env:TICKETMASTER_API_KEY = [System.Net.NetworkCredential]::new('', $concertApiKey).Password
python scripts/fetch_concerts.py
Remove-Item Env:TICKETMASTER_API_KEY
```

No Python packages are required. The key is used only by the collector, not by browser JavaScript. `.env` files are ignored, but this collector does not automatically load them.

## Enable daily refresh on GitHub Pages when ready

The local changes have not been pushed, deployed or activated. `.github/workflows/concerts.yml` is prepared for the existing repository.

1. After reviewing and pushing the changes to `main`, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
2. Open **Actions → Refresh concerts and publish Pages → Run workflow**.
3. Leave **Publish** unchecked for a fetch/test run that only uploads the public site artifact. Check **Publish** when you want that run to update the live site.

The schedule will publish daily at 05:23 UTC once this workflow is present on the default branch and Pages is configured. It uses the current published snapshot for failure recovery, then fetches and validates data and explicitly deploys a Pages artifact. It does not repeatedly commit vendor data to `main`. If the site address changes, update the workflow's `--previous-url`.

If one source fails, its recent previous records are retained for up to seven days during otherwise successful refreshes, with the failure recorded. If every enabled source fails, the collector exits unsuccessfully and the existing deployment stays untouched. That older deployment may persist longer, so the app visibly marks old data. Check source links before travelling. Schedules can be delayed or disabled after repository inactivity; the app shows when the data was last generated. [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

`scripts/package_site.py` stages an explicit allowlist of public app files, excluding credentials, personal preferences, tests and collector tooling. GitHub Pages is configured to deploy that artifact, because a `GITHUB_TOKEN` commit alone does not trigger a Pages build. [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Next sources and Spotify

The next broad-provider candidates are [Tickster](https://developer.tickster.com/documentation/events/1.0) (API key required; [key request](https://developer.tickster.com/register)) and [Billetto public event search](https://api.billetto.com/reference/list-public-events) (documents `Api-Keypair` credentials). Their adapters and authenticated Swedish coverage checks are not implemented yet. Hovet's Amon Amarth ticket link goes to AXS, illustrating why a venue supplement can find a gig outside Ticketmaster. Three providers plus targeted venues are a practical expansion path; complete national coverage is not claimed.

Spotify remains optional. The intended flow is **Connect Spotify → Spotify consent → review suggested artists → add chosen favourites**. **Not now** or denied consent returns directly to the existing artist/style questions. Imports must not overwrite explicit dislikes or event hiding. Spotify's documented browser flow uses OAuth with PKCE; a browser app must never contain a client secret. Before implementation, the app owner will need a Spotify developer app, its public client ID and a registered HTTPS callback URL. [Spotify PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)

Spotify currently requires a Premium account for a development-mode app owner and restricts it to five allowlisted users. The top-artists import would request only `user-top-read`, with the documented approximate four-week, six-month and one-year ranges. Account access has not been tested. [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Top items](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

Last.fm similarity can follow once event coverage is useful. Current matches are **Favourite**, **Style match** or **Explore**, not inferred musical relationships or invented percentages. This remains a noncommercial hobby project without ads or tracking.

## Checks and implementation notes

```powershell
python -m unittest discover -s tests -v
node --test tests/concerts.test.cjs tests/concerts-ui.test.cjs
python scripts/package_site.py
```

JavaScript tests need Node 22+; it is a development tool only. A verified portable Node executable was used locally under ignored `.local/node/`. Python collector tests, JavaScript rules/controller tests and syntax checks cover feedback separation, mode switching, overnight hours, date uncertainty, deduplication, rescheduling, failed refreshes and import validation. DOM doubles do not verify browser layout, native dialogs or physical compass direction. iPhone Safari/installed-PWA testing is still needed. No offline cache has been added to `sw.js`.

The original bottle image is unchanged. The guitar uses the [Lucide guitar icon](https://github.com/lucide-icons/lucide/blob/main/icons/guitar.svg), recoloured and aligned as a compass needle; its license is in `licenses/lucide.txt`.

The durable brief, user preferences and progress notes are in [docs/concert-plan.md](docs/concert-plan.md). Current instruction: work directly on `main`, preserve existing edits, and do not push or deploy without a later instruction.
