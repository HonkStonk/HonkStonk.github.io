/* Optional, one-time Spotify top-artist import. No client secret or stored tokens. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SpotifyImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const pendingKey = 'magic-compass.spotify.pending.v1';
    const ranges = ['short_term', 'medium_term', 'long_term'];
    function validClientId(value) { return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value); }
    function createClient({ storage, crypto, fetch, now = Date.now }) {
        const random = size => Array.from(crypto.getRandomValues(new Uint8Array(size)), n => n.toString(16).padStart(2, '0')).join('');
        async function begin(clientId, redirectUri, range = 'medium_term') {
            const redirect = new URL(redirectUri);
            if (!validClientId(clientId) || !ranges.includes(range)) throw new Error('Spotify import is not configured correctly.');
            if (!(redirect.protocol === 'https:' || (redirect.protocol === 'http:' && redirect.hostname === '127.0.0.1')) || redirect.search || redirect.hash || redirect.username || redirect.password) {
                throw new Error('Open the app over HTTPS, or use http://127.0.0.1:8765/index.html for local Spotify testing.');
            }
            const verifier = random(32), state = random(24);
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
            const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            storage.setItem(pendingKey, JSON.stringify({ clientId, redirectUri, range, verifier, state, createdAt: now() }));
            const url = new URL('https://accounts.spotify.com/authorize');
            url.search = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
                scope: 'user-top-read', state, code_challenge_method: 'S256', code_challenge: challenge }).toString();
            return url.href;
        }
        async function finish(clientId, callback) {
            const url = new URL(callback), params = url.searchParams;
            if (!params.has('code') && !params.has('error')) return null;
            const saved = storage.getItem(pendingKey);
            storage.removeItem(pendingKey); // Single-use, including denial and failed callbacks.
            let pending;
            try { pending = JSON.parse(saved); } catch { /* Report the same expiry message. */ }
            const clean = new URL(url); clean.search = ''; clean.hash = '';
            if (!pending || pending.clientId !== clientId || pending.redirectUri !== clean.href ||
                !params.get('state') || pending.state !== params.get('state') || !ranges.includes(pending.range) ||
                !/^[a-f0-9]{64}$/.test(pending.verifier) || !Number.isFinite(pending.createdAt) ||
                now() - pending.createdAt > 15 * 60 * 1000 || now() < pending.createdAt) {
                throw new Error('Spotify sign-in expired or returned to a different browser. Please try again from this tab.');
            }
            if (params.has('error')) {
                if (params.get('error') === 'access_denied') return { cancelled: true };
                throw new Error('Spotify could not complete sign-in. You can still choose artists yourself.');
            }
            const signal = () => root.AbortSignal?.timeout ? root.AbortSignal.timeout(20000) : undefined;
            const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: signal(),
                body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId,
                    code: params.get('code'), redirect_uri: pending.redirectUri, code_verifier: pending.verifier }).toString()
            });
            if (!tokenResponse.ok) throw new Error('Spotify sign-in could not be completed. Please connect again.');
            const token = await tokenResponse.json();
            if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Spotify returned an invalid sign-in response.');
            const response = await fetch('https://api.spotify.com/v1/me/top/artists?' + new URLSearchParams({ time_range: pending.range, limit: '50' }), {
                headers: { Authorization: 'Bearer ' + token.access_token }, signal: signal()
            });
            if (response.status === 403) throw new Error('Spotify access is unavailable for this account. The app owner must have Premium and add testers in Spotify’s Users Management. You can choose artists yourself below.');
            if (response.status === 429) throw new Error('Spotify needs a break. Try importing later; your preferences are unchanged.');
            if (!response.ok) throw new Error('Could not read your Spotify artists. Try again later or enter artists yourself.');
            const data = await response.json();
            if (!Array.isArray(data.items) || data.items.length > 50 || data.items.some(a => !a || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 300 || !/^[a-zA-Z0-9]{22}$/.test(a.id))) {
                throw new Error('Spotify returned an unexpected artist list. Your preferences are unchanged.');
            }
            return { artists: data.items.map(a => ({ name: a.name.trim(), url: 'https://open.spotify.com/artist/' + a.id })), range: pending.range };
        }
        return { begin, finish };
    }
    function mergeArtists(preferences, names, core) {
        const skipped = new Set(preferences.dislikedArtists.map(core.key));
        const favourites = new Map(preferences.favourites.map(name => [core.key(name), name]));
        for (const name of names) if (!skipped.has(core.key(name)) && !favourites.has(core.key(name))) favourites.set(core.key(name), name);
        return core.validatePreferences({ ...preferences, favourites: [...favourites.values()] });
    }
    async function init({ getPreferences, savePreferences, beforeConnect, openPreferences, showConcerts, notify }) {
        const $ = id => document.getElementById(id), core = root.ConcertCore;
        const callback = root.location.href;
        const hasCallback = new URL(callback).searchParams.has('code') || new URL(callback).searchParams.has('error');
        // Remove the authorization response before loading configuration or other data.
        if (hasCallback) {
            const clean = new URL(callback); clean.search = ''; clean.hash = '';
            root.history.replaceState(null, '', clean.href);
        }
        try {
            const response = await root.fetch('./spotify-config.json', { cache: 'no-store' });
            const config = response.ok ? await response.json() : {};
            if (!validClientId(config.clientId)) {
                if (hasCallback) throw new Error('Spotify import has not been configured for this app yet.');
                return;
            }
            const client = createClient({ storage: root.sessionStorage, crypto: root.crypto, fetch: root.fetch.bind(root) });
            $('spotifySection').hidden = false;
            $('connectSpotify').disabled = false;
            $('spotifyAvailability').textContent = config.accessMode === 'extended'
                ? 'Optional. Connect your own Spotify account to choose artists for your favourites.'
                : 'Spotify import is currently available to invited testers only. Other visitors can add artists below.';
            $('connectSpotify').onclick = async () => {
                $('connectSpotify').disabled = true;
                $('spotifyStatus').textContent = '';
                try {
                    beforeConnect();
                    const redirect = new URL('./index.html', root.location.href).href;
                    root.location.assign(await client.begin(config.clientId, redirect, $('spotifyRange').value));
                } catch (error) {
                    $('spotifyStatus').textContent = error.message || 'Spotify could not open. Your choices are saved.';
                    $('connectSpotify').disabled = false;
                }
            };
            const result = await client.finish(config.clientId, callback);
            if (!result) return;
            showConcerts();
            if (result.cancelled) { openPreferences(); $('spotifyStatus').textContent = 'No problem. Choose a few artists or styles below instead.'; return; }
            const list = $('spotifyArtistList');
            const choices = [];
            for (const artist of result.artists) {
                const skipped = getPreferences().dislikedArtists.some(name => core.key(name) === core.key(artist.name));
                const row = document.createElement('div'); row.className = 'spotify-artist';
                const label = document.createElement('label');
                const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !skipped; checkbox.disabled = skipped;
                label.append(checkbox, document.createTextNode(artist.name + (skipped ? ' · In your skip list' : '')));
                const link = document.createElement('a'); link.href = artist.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Spotify ↗';
                link.setAttribute('aria-label', artist.name + ' on Spotify');
                row.append(label, link); list.append(row); choices.push({ name: artist.name, checkbox });
            }
            $('spotifyReviewStatus').textContent = result.artists.length ? 'Choose which artists to add. Your existing favourites and skip list stay with you.' : 'Spotify did not return any top artists yet. You can enter favourites in the menu instead.';
            $('saveSpotifyArtists').disabled = !result.artists.length;
            $('saveSpotifyArtists').onclick = () => {
                try {
                    savePreferences(mergeArtists(getPreferences(), choices.filter(c => c.checkbox.checked).map(c => c.name), core));
                    $('spotifyReviewDialog').close();
                    notify('Your selected Spotify artists are now in your favourites.');
                } catch (error) { $('spotifyReviewStatus').textContent = error.message; }
            };
            $('spotifyReviewDialog').addEventListener('close', () => { list.replaceChildren(); choices.length = 0; $('saveSpotifyArtists').onclick = null; }, { once: true });
            $('spotifyReviewDialog').showModal();
        } catch (error) {
            if (hasCallback) { showConcerts(); openPreferences(); notify(error.message || 'Spotify is unavailable. You can choose artists yourself.'); }
        }
    }
    return { createClient, mergeArtists, validClientId, init };
});
