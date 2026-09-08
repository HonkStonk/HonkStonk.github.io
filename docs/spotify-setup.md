# Spotify: what you set up and what each visitor does

Checked against Spotify's documentation on 9 September 2026.

The intended experience is: **Tune your taste → Connect Spotify → sign in to your own Spotify account → agree → review artists → Add selected artists**. Each visitor imports their own listening taste. Registering Magic Compass under the owner's Spotify developer account identifies the app; it does not make visitors use the owner's music account.

## The restriction to understand before doing any setup

**We can test this with a small invited group. We cannot currently offer it to arbitrary visitors using a new hobby-app registration.** Spotify's development mode requires Premium for the app owner and permits five allowlisted accounts. Public access requires extended quota approval; Spotify currently accepts organizations with an established service and at least 250,000 monthly active users, among other requirements. This hobby project does not meet those stated requirements. A button, a different login flow, a backend, or setting a configuration flag cannot remove that restriction. [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

All visitors can still use concerts and manually save favourite artists and styles. None of the steps below is needed to get the new Stockholm event sources working.

## Your one-time setup, if you want the invited-user version

1. On your computer, open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Sign in with the account that will own the Magic Compass registration. That account needs Premium. This is your setup task; your visitors will not do it.
2. Click **Create app**. If you already created Magic Compass, open it and go to **Settings** instead. Use these values where requested:

   | Field | Value |
   | --- | --- |
   | App name | `Magic Compass` |
   | Description | `A noncommercial concert finder. Users optionally import their own top artists to choose favourites and discover nearby gigs.` |
   | Website | `https://honkstonk.github.io/` |
   | API / SDK | **Web API** |

3. Under **Redirect URIs**, enter `https://honkstonk.github.io/index.html` and click **Add**. Add `http://127.0.0.1:8765/index.html` as a second entry, then save. These addresses are where Spotify sends the visitor back after consent. Copy them exactly, including `index.html`; do not substitute `localhost`. [Spotify app setup](https://developer.spotify.com/documentation/web-api/concepts/apps), [redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
4. Find **Client ID** in the app's settings. Copy it. Open [spotify-config.json](../spotify-config.json) in this repository and paste it between the empty quotes after `clientId`. Leave `accessMode` as `development`:

   ```json
   {
     "clientId": "PASTE_THE_CLIENT_ID_HERE",
     "accessMode": "development"
   }
   ```

   The Client ID is public and identifies Magic Compass. It is safe to commit. **Do not copy Client Secret.** This app has no Client Secret field and uses Spotify's browser-safe PKCE flow. If you want Codex to do this edit, provide only the public Client ID. [PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
5. In the same Spotify app, open **Settings → Users Management → Add new user**. Enter the name and Spotify login email of each test account, including the account you will use to test. Save each entry. Spotify's published limit is five accounts. Adding someone does not import their data or consent on their behalf. They must still sign in and agree themselves. An unlisted account may get through login but fail at import with a 403 response. [Users Management instructions](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
6. In a terminal opened in this repository, run `python -m http.server 8765 --bind 127.0.0.1`. If the preview server is already running on that port, keep it running. Open **http://127.0.0.1:8765/index.html** on that computer, reload, choose **Concerts → Tune your taste**, and confirm that **Connect Spotify** is enabled. The note will say it is for invited testers.
7. Click **Connect Spotify** and complete the visitor steps below. This is the first real end-to-end test. Until a Client ID is configured and this succeeds, unit tests do not establish that Spotify has granted live access.
8. After the local test works, the changed app files need to be pushed and deployed through the repository's existing Pages process before the iPhone/live site gets the button. Codex has not pushed or deployed these changes. A Client ID saved locally does not update the public site.

`accessMode` only changes the explanatory text in preferences. Set it to `extended` only after Spotify actually approves that mode. It does not grant access.

## What an invited visitor does

1. Open Magic Compass, choose **Concerts**, then **Tune your taste** (the menu opens the same preferences).
2. Choose a listening window: roughly four weeks, six months, or one year.
3. Press **Connect Spotify**. The app saves the current manual preferences before leaving for sign-in.
4. Spotify opens its own sign-in/consent page. The visitor signs into **their own account** and checks that it is the intended account if the browser was already signed into Spotify. Magic Compass does not receive their password.
5. The visitor agrees to read their top artists. Spotify returns them to Magic Compass in the same browser. Declining leaves manual preferences available.
6. Magic Compass shows a checklist of the returned artists. The visitor unchecks any they do not want and presses **Add selected artists**. Those names join their favourites on that browser/device. Existing dislikes remain respected.

Visitors never need a developer account, API key, Client ID, terminal, or repository settings. The owner performs registration once; each visitor performs sign-in and consent separately. This imports top artists once per connection, rather than continuously syncing a Spotify account. It uses Spotify's listening-affinity ranking, not exact play counts. [Top artists endpoint](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

## If a step fails

| What you see | What to do |
| --- | --- |
| Disabled Connect Spotify button | Check that `spotify-config.json` contains the 32-character Client ID and reload the same local/live version you edited. |
| Invalid redirect URI | In Spotify Settings, compare the registered address with the address used above; HTTPS for the live site, `127.0.0.1` for local testing. |
| Login succeeds but import says access unavailable | Verify that the exact signed-in account is in Users Management and that the owner has Premium. Login alone does not prove API access. |
| Sign-in expired / different browser | Restart Connect Spotify from the same browser tab; do not transfer the callback to another browser or device. |
| Spotify asks you to try later | Wait and reconnect later. The app keeps manual favourites available. |
| It works locally but not on the iPhone | First check deployment and the HTTPS redirect entry. Then test in Safari. Returning to an installed PWA still needs a real-device check. |

Imported favourites stay in local browser storage. Spotify access/refresh tokens are not saved. To stop using imported favourites, remove the names in preferences; to revoke Spotify permission, use [Spotify account apps](https://www.spotify.com/account/apps/).
