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

async function app({ offline = false } = {}) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element()]));
    elements.get('calendarRange').value = 'all';
    const document = {
        getElementById(id) { assert.ok(elements.has(id), 'HTML contains #' + id); return elements.get(id); },
        createElement: tag => new Element(tag),
        createTextNode: text => String(text), querySelectorAll: () => []
    };
    const saved = new Map();
    // Fixed test records keep scheduled tests independent of touring calendars.
    const snapshot = { schemaVersion: 1, generatedAt: '2026-09-07T12:00:00Z', sources: [], events: [
        { id: 'test:amon', title: 'Amon Amarth', artists: ['Amon Amarth'], styles: ['Metal'], localDate: '2026-10-24', localTime: '18:30', timeKind: 'start', status: 'scheduled', url: 'https://example.com/amon', venue: { name: 'Hovet', city: 'Stockholm', lat: 59.29, lon: 18.08 } },
        { id: 'test:other', title: 'Another band', artists: ['Another band'], styles: ['Indie'], localDate: '2027-05-30', localTime: null, timeKind: 'listed', status: 'scheduled', url: 'https://example.com/other', venue: { name: 'Hovet', city: 'Stockholm', lat: 59.29, lon: 18.08 } }
    ] };
    let geolocationStarts = 0;
    class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-07T12:00:00Z'])); } static now() { return new Date('2026-09-07T12:00:00Z').getTime(); } }
    const context = vm.createContext({
        document, console: { log() {}, warn() {}, error() {} }, Date: FixedDate, URL, Blob, AbortController,
        addEventListener() {}, removeEventListener() {},
        setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
        localStorage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) },
        navigator: { geolocation: { watchPosition() { geolocationStarts++; return 1; }, clearWatch() {} } },
        fetch: async () => { if (offline) throw new Error('offline'); return { ok: true, json: async () => snapshot }; }
    });
    context.window = context;
    for (const file of ['script.js', 'concerts-core.js', 'concerts.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    await new Promise(resolve => setImmediate(resolve));
    return { context, elements, saved, get geolocationStarts() { return geolocationStarts; } };
}

test('concert view loads a real favourite without asking for location; bottle and guitar switch', async () => {
    const state = await app();
    const e = id => state.elements.get(id);
    e('concertMode').click();
    assert.equal(e('concertTitle').textContent, 'Amon Amarth');
    assert.equal(e('gigMatch').textContent, 'Favourite');
    assert.equal(state.geolocationStarts, 0);
    assert.equal(e('compassNeedle').hidden, true);
    assert.equal(e('guitarNeedle').hidden, false);
    e('pointToGig').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.geolocationStarts, 1);
    state.context.handleLocationUpdate({ coords: { latitude: 59.2363, longitude: 17.9824 } });
    state.context.handleOrientationUpdate({ webkitCompassHeading: 90, alpha: null, absolute: false });
    assert.match(e('guitarNeedle').style.transform, /^rotate\(/);
    assert.equal(e('concertTitle').textContent, 'Amon Amarth');
    e('beerMode').click();
    assert.equal(e('compassNeedle').hidden, false);
    assert.equal(e('guitarNeedle').hidden, true);
    assert.match(e('distanceText').textContent, /^Distance: [\d.]+ km/);
});
test('hiding and restoring a gig preserves artist feedback', async () => {
    const { elements, saved } = await app();
    elements.get('concertMode').click();
    elements.get('hideEventButton').click();
    const prefs = JSON.parse(saved.values().next().value);
    assert.ok(prefs.favourites.includes('Amon Amarth'));
    assert.ok(prefs.hiddenEvents.length);
    assert.notEqual(elements.get('concertTitle').textContent, 'Amon Amarth');
    elements.get('restoreHidden').click();
    assert.equal(elements.get('concertTitle').textContent, 'Amon Amarth');
});
test('artist skip is an explicit separate action and updates recommendations', async () => {
    const { elements, saved } = await app();
    elements.get('concertMode').click();
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
