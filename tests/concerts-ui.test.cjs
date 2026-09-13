// Controller integration tests with a small DOM double. These do not claim to
// test browser rendering, native permissions, or real iPhone sensors.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.style = {}; this.hidden = false; this.value = ''; this._text = ''; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ''; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, callback) { this['on' + type] = callback; }
    click() { return this.onclick?.({ preventDefault() {} }); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    scrollIntoView() {}
    querySelectorAll(selector) { return this.children.filter(c => c instanceof Element && selector === '[aria-pressed="true"]' && c.getAttribute('aria-pressed') === 'true'); }
}

async function app({ offline = false, spotify = false, spotifyConfig = { clientId: 'a'.repeat(32) }, gaps = [], sources = [] } = {}) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element()]));
    elements.get('connectSpotify').disabled = true;
    elements.get('calendarScope').value = 'plans';
    elements.get('spotifyRange').value = 'medium_term';
    const document = {
        getElementById(id) { assert.ok(elements.has(id), 'HTML contains #' + id); return elements.get(id); },
        createElement: tag => new Element(tag),
        createTextNode: text => String(text), querySelectorAll: () => []
    };
    const saved = new Map();
    const session = new Map();
    // Fixed test records keep scheduled tests independent of touring calendars.
    const snapshot = { schemaVersion: 1, generatedAt: '2026-09-07T12:00:00Z', coverage: { gaps }, sources, events: [
        { id: 'test:amon', providers: ['ticketmaster'], title: 'Amon Amarth', artists: ['Amon Amarth'], styles: ['Metal'], localDate: '2027-05-10', localTime: '18:30', timeKind: 'start', status: 'scheduled', url: 'https://example.com/amon', ticketUrl: 'https://tickets.example.com/amon', ticketPrice: { amount: 495, currency: 'SEK' }, venue: { name: 'Hovet', city: 'Stockholm', lat: 59.29, lon: 18.08 } },
        { id: 'test:match', providers: ['arena'], title: 'AIK – Mjällby', artists: [], styles: [], purpose: 'venue_alert', eventCategory: 'Sport', localDate: '2026-09-16', localTime: '19:00', timeKind: 'listed', status: 'scheduled', url: 'https://example.com/match', venue: { name: 'Strawberry Arena', city: 'Solna', lat: 59.37, lon: 18 } },
        { id: 'test:other', title: 'Another band', artists: ['Another band'], styles: ['Indie'], localDate: '2026-09-20', localTime: null, timeKind: 'listed', status: 'scheduled', url: 'https://example.com/other', venue: { name: 'Hovet', city: 'Stockholm', lat: 59.29, lon: 18.08 } }
    ] };
    let geolocationStarts = 0;
    class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-07T12:00:00Z'])); } static now() { return new Date('2026-09-07T12:00:00Z').getTime(); } }
    const context = vm.createContext({
        document, console: { log() {}, warn() {}, error() {} }, Date: FixedDate, URL, URLSearchParams, Blob, AbortController,
        TextEncoder, btoa, crypto: require('node:crypto').webcrypto,
        location: { href: 'https://example.com/index.html', assign(url) { this.href = url; } }, history: { replaceState() {} },
        sessionStorage: { getItem: k => session.get(k) || null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
        addEventListener() {}, removeEventListener() {},
        setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
        localStorage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) },
        navigator: { geolocation: { watchPosition() { geolocationStarts++; return 1; }, clearWatch() {} } },
        fetch: async url => { if (offline) throw new Error('offline'); return { ok: true, json: async () => url === './spotify-config.json' ? spotifyConfig : snapshot }; }
    });
    context.window = context;
    for (const file of ['script.js', 'concerts-core.js', ...(spotify ? ['spotify.js'] : []), 'concerts.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    await new Promise(resolve => setImmediate(resolve));
    return { context, elements, saved, get geolocationStarts() { return geolocationStarts; } };
}

test('Spotify configuration gates sign-in and explains the invited-user restriction', async () => {
    const absent = await app({ spotify: true, spotifyConfig: { clientId: '' } });
    assert.equal(absent.elements.get('connectSpotify').disabled, true);
    assert.equal(absent.elements.get('connectSpotify').onclick, undefined);
    const invited = await app({ spotify: true });
    assert.equal(invited.elements.get('connectSpotify').disabled, false);
    assert.match(invited.elements.get('spotifyAvailability').textContent, /invited testers only/);
});

test('coverage gaps render safely without breaking the concert snapshot', async () => {
    const { elements } = await app({ gaps: [
        { name: 'Scen 44', note: 'Not imported yet.', url: 'https://example.com/programme' },
        { name: '<script>no</script>', note: 'Unavailable', url: 'javascript:alert(1)' }
    ] });
    const details = elements.get('sourceDetails');
    assert.match(details.textContent, /Scen 44: Not imported yet/);
    assert.equal(details.children[0].children[0].href, 'https://example.com/programme');
    assert.equal(details.children[1].children.length, 0);
    assert.match(elements.get('dataStatus').textContent, /concerts/);
});

test('previous Ticketmaster success with saved listings is distinguished from never connected', async () => {
    for (const status of ['not_configured', 'error', 'ok']) {
        const { elements } = await app({ sources: [
            { id: 'ticketmaster', name: 'Ticketmaster Sweden', status, lastSuccess: '2026-09-07T12:00:00Z' },
            { id: 'tickster', name: 'Tickster Sweden', status: 'not_configured', lastSuccess: null }
        ] });
        const rows = elements.get('sourceDetails').children;
        assert.match(rows[0].textContent, status === 'ok' ? /checked · 1 listings/ : /using 1 saved listings/);
        if (status === 'not_configured') assert.match(rows[0].textContent, /live refresh not connected/);
        if (status === 'error') assert.match(rows[0].textContent, /latest refresh failed/);
        assert.match(rows[0].textContent, /last checked/);
        assert.doesNotMatch(rows[0].textContent, /not connected yet/);
        assert.match(rows[1].textContent, /not connected yet/);
    }
});

test('Spotify remains opt-in and saves edited choices before redirecting for consent', async () => {
    const { context, elements, saved } = await app({ spotify: true });
    assert.equal(context.location.href, 'https://example.com/index.html');
    elements.get('preferencesButton').click();
    elements.get('favouriteArtists').value = 'New favourite';
    await elements.get('connectSpotify').click();
    assert.equal(new URL(context.location.href).origin, 'https://accounts.spotify.com');
    const prefs = JSON.parse(saved.get('magic-compass.preferences.v1'));
    assert.deepEqual(prefs.favourites, ['New favourite']);
    assert.equal(elements.get('spotifyReviewDialog').open, undefined);
});

test('concerts open in planning mode and a chosen gig opens navigation without asking for location', async () => {
    const state = await app();
    const e = id => state.elements.get(id);
    e('concertMode').click();
    assert.equal(e('concertTitle').textContent, 'Amon Amarth');
    assert.equal(e('gigMatch').textContent, 'Favourite');
    assert.equal(state.geolocationStarts, 0);
    assert.equal(e('compassNeedle').hidden, true);
    assert.equal(e('concertPlanner').hidden, false);
    assert.match(e('gigList').children[0].textContent, /18:30/);
    assert.equal(e('compassDisplay').hidden, true);
    assert.equal(e('guitarNeedle').hidden, true);
    e('gigList').children[0].children[0].click();
    assert.match(e('eventTicketPrice').textContent, /495/);
    assert.equal(e('eventSourceLink').href, 'https://tickets.example.com/amon');
    assert.equal(e('concertPlanner').hidden, true);
    assert.equal(e('concertDetail').hidden, false);
    assert.equal(e('guitarNeedle').hidden, false);
    e('pointToGig').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.geolocationStarts, 1);
    state.context.handleLocationUpdate({ coords: { latitude: 59.2363, longitude: 17.9824 } });
    state.context.handleOrientationUpdate({ webkitCompassHeading: 90, alpha: null, absolute: false });
    assert.match(e('guitarNeedle').style.transform, /^rotate\(/);
    assert.equal(e('concertTitle').textContent, 'Amon Amarth');
    e('backToConcerts').click();
    assert.equal(e('concertPlanner').hidden, false);
    assert.equal(e('compassDisplay').hidden, true);
    e('gigList').children[0].children[0].click();
    e('beerMode').click();
    assert.equal(e('compassNeedle').hidden, false);
    assert.equal(e('guitarNeedle').hidden, true);
    assert.match(e('distanceText').textContent, /^Distance: [\d.]+ km/);
});
test('planning a concert saves it and the calendar includes every announced date', async () => {
    const { elements, saved } = await app();
    elements.get('concertMode').click();
    elements.get('gigList').children[0].children[1].click();
    const prefs = JSON.parse(saved.get('magic-compass.preferences.v1'));
    assert.ok(prefs.plannedEvents.includes('test:amon'));
    assert.match(elements.get('calendarCount').textContent, /1 concert planned/);
    elements.get('plannedGigsView').click();
    assert.match(elements.get('gigList').textContent, /Amon Amarth/);
    assert.match(elements.get('gigList').textContent, /18:30/);
    elements.get('calendarButton').click();
    assert.match(elements.get('calendarList').textContent, /Amon Amarth/);
    assert.match(elements.get('calendarList').textContent, /2027/);
});
test('concert feeds are chronological and venue alerts remain a separate view', async () => {
    const { elements } = await app();
    elements.get('concertMode').click();
    assert.equal(elements.get('gigList').children[0].textContent.includes('Amon Amarth'), true);
    elements.get('allGigsView').click();
    assert.equal(elements.get('gigList').children[0].textContent.includes('Another band'), true);
    assert.match(elements.get('gigList').children[0].textContent, /TBA/);
    elements.get('venueAlertsView').click();
    assert.equal(elements.get('gigList').children.length, 1);
    assert.match(elements.get('gigList').children[0].textContent, /AIK – Mjällby/);
    assert.match(elements.get('gigList').children[0].textContent, /19:00/);
    assert.match(elements.get('feedSummary').textContent, /1 events at watched places/);
});
test('hiding and restoring a gig preserves artist feedback', async () => {
    const { elements, saved } = await app();
    elements.get('concertMode').click();
    elements.get('gigList').children[0].children[0].click();
    elements.get('hideEventButton').click();
    const prefs = JSON.parse(saved.values().next().value);
    assert.ok(prefs.favourites.includes('Amon Amarth'));
    assert.ok(prefs.hiddenEvents.length);
    assert.notEqual(elements.get('concertTitle').textContent, 'Amon Amarth');
    elements.get('restoreHidden').click();
    assert.match(elements.get('gigList').textContent, /Amon Amarth/);
});
test('artist skip is an explicit separate action and updates recommendations', async () => {
    const { elements, saved } = await app();
    elements.get('concertMode').click();
    elements.get('gigList').children[0].children[0].click();
    const feedbackRow = elements.get('artistFeedback').children[0];
    feedbackRow.children[2].click();
    const prefs = JSON.parse(saved.values().next().value);
    assert.ok(prefs.dislikedArtists.includes('Amon Amarth'));
    assert.ok(!prefs.favourites.includes('Amon Amarth'));
    assert.deepEqual(prefs.hiddenEvents, []);
    assert.notEqual(elements.get('concertTitle').textContent, 'Amon Amarth');
});
test('an invalid import keeps existing preferences and reports the error', async () => {
    const { elements, saved } = await app();
    elements.get('restoreHidden').click();
    const before = saved.values().next().value;
    elements.get('importFile').files = [{ size: 20, text: async () => '{"version":99}' }];
    await elements.get('importFile').onchange();
    assert.equal(saved.values().next().value, before);
    assert.match(elements.get('preferencesError').textContent, /not supported/);
});
test('offline concert loading does not break beer mode', async () => {
    const { context, elements } = await app({ offline: true });
    elements.get('concertMode').click();
    assert.match(elements.get('dataStatus').textContent, /Could not load/);
    assert.equal(elements.get('pointToGig').disabled, true);
    elements.get('beerMode').click();
    context.handleLocationUpdate({ coords: { latitude: 59.2363, longitude: 17.9824 } });
    assert.match(elements.get('distanceText').textContent, /^Distance: [\d.]+ km/);
});
