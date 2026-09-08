const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto, createHash } = require('node:crypto');
const S = require('../spotify.js');
const C = require('../concerts-core.js');
const clientId = 'a'.repeat(32);
const redirectUri = 'https://example.com/index.html';

function client(fetch = async () => { throw new Error('Unexpected network request'); }) {
    const saved = new Map();
    let clock = 1000;
    const storage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
    const api = S.createClient({ storage, crypto: webcrypto, fetch, now: () => clock });
    return { api, saved, advance() { clock += 16 * 60 * 1000; } };
}
const callback = (auth, extra = 'code=one-use-code') => redirectUri + '?' + extra + '&state=' + new URL(auth).searchParams.get('state');

test('Spotify authorization uses a fresh S256 challenge and only top-artists scope', async () => {
    const { api, saved } = client();
    const auth = new URL(await api.begin(clientId, redirectUri));
    const pending = JSON.parse([...saved.values()][0]);
    assert.equal(auth.origin, 'https://accounts.spotify.com');
    assert.equal(auth.searchParams.get('scope'), 'user-top-read');
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(auth.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
    assert.equal(auth.searchParams.has('client_secret'), false);
    const second = new URL(await api.begin(clientId, redirectUri));
    assert.notEqual(second.searchParams.get('state'), auth.searchParams.get('state'));
    await assert.rejects(api.begin(clientId, 'http://localhost:8765/index.html'), /127.0.0.1/);
    await assert.rejects(api.begin(clientId, redirectUri, 'unsupported'), /configured/);
});

test('denied consent clears pending sign-in without fetching or importing anything', async () => {
    const { api, saved } = client();
    const auth = await api.begin(clientId, redirectUri);
    assert.deepEqual(await api.finish(clientId, callback(auth, 'error=access_denied')), { cancelled: true });
    assert.equal(saved.size, 0);
});

test('state, redirect, client ID, expiry and replay failures never exchange a code', async () => {
    for (const change of ['state', 'redirect', 'client', 'expiry']) {
        const { api, saved, advance } = client();
        const auth = await api.begin(clientId, redirectUri);
        let url = callback(auth), id = clientId;
        if (change === 'state') url = url.replace('state=', 'state=wrong');
        if (change === 'redirect') url = url.replace('example.com', 'other.example.com');
        if (change === 'client') id = 'b'.repeat(32);
        if (change === 'expiry') advance();
        await assert.rejects(api.finish(id, url), /expired/);
        assert.equal(saved.size, 0);
        await assert.rejects(api.finish(clientId, callback(auth)), /expired/);
    }
});

test('successful import uses the selected time range and keeps no tokens in storage', async () => {
    const calls = [];
    const { api, saved } = client(async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => calls.length === 1
            ? { access_token: 'private-access-token', refresh_token: 'private-refresh-token' }
            : { items: [{ id: 'z'.repeat(22), name: 'Dina Ögon' }] } };
    });
    const auth = await api.begin(clientId, redirectUri, 'long_term');
    const result = await api.finish(clientId, callback(auth));
    assert.equal(result.artists[0].name, 'Dina Ögon');
    assert.equal(result.artists[0].url, 'https://open.spotify.com/artist/' + 'z'.repeat(22));
    assert.match(calls[1].url, /time_range=long_term/);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer private-access-token');
    const exchange = new URLSearchParams(calls[0].options.body);
    assert.equal(exchange.get('redirect_uri'), redirectUri);
    assert.equal(exchange.get('code'), 'one-use-code');
    assert.equal(exchange.has('client_secret'), false);
    assert.equal(saved.size, 0);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
});

test('Spotify user restrictions and rate limits give actionable errors', async () => {
    for (const [status, message] of [[403, /Premium/], [429, /Try importing later/]]) {
        let requests = 0;
        const { api, saved } = client(async () => ++requests === 1
            ? { ok: true, json: async () => ({ access_token: 'test' }) } : { ok: false, status });
        const auth = await api.begin(clientId, redirectUri);
        await assert.rejects(api.finish(clientId, callback(auth)), message);
        assert.equal(saved.size, 0);
    }
});

test('imported favourites preserve explicit dislikes, event hiding, cities and prior favourites', () => {
    const prefs = C.defaultPreferences(); prefs.dislikedArtists = ['Skipped']; prefs.hiddenEvents = ['ticketmaster:123'];
    const original = JSON.stringify(prefs);
    const imported = S.mergeArtists(prefs, ['New artist', 'Skipped', 'DINA ÖGON', 'New artist'], C);
    assert.deepEqual(imported.favourites, [...prefs.favourites, 'New artist']);
    assert.deepEqual(imported.dislikedArtists, prefs.dislikedArtists);
    assert.deepEqual(imported.hiddenEvents, prefs.hiddenEvents);
    assert.deepEqual(imported.cities, prefs.cities);
    assert.equal(JSON.stringify(prefs), original);
    assert.throws(() => S.mergeArtists(prefs, Array.from({ length: 201 }, (_, n) => 'Artist ' + n), C));
});
