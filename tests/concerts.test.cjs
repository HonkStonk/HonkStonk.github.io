const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const C = require('../concerts-core.js');
const now = new Date('2026-09-07T12:00:00Z');
const gig = overrides => ({ id: 'venue:1', title: 'Amon Amarth', artists: ['Amon Amarth'], styles: ['Metal'], venue: { name: 'Hovet', city: 'Stockholm', lat: 59.29, lon: 18.08 }, localDate: '2027-05-10', localTime: null, status: 'scheduled', url: 'https://example.com/gig', ...overrides });

test('genre words in event prose are labelled as mentions, separate from source genre tags', () => {
    const prefs = { ...C.defaultPreferences(), favourites: [], styles: ['Punk'] };
    const event = gig({ artists: [], title: 'Local gig', styles: ['Punk'], styleEvidence: 'description' });
    assert.equal(C.match(event, prefs).label, 'Style mention');
    assert.match(C.match(event, prefs).reason, /event page mentions Punk/);
    assert.equal(C.match({ ...event, styleEvidence: undefined }, prefs).label, 'Style match');
});

test('event hiding never changes artist taste or hides a different date', () => {
    const prefs = C.defaultPreferences();
    const before = JSON.stringify(prefs.favourites);
    prefs.hiddenEvents.push('venue:1');
    assert.equal(C.eligible(gig(), prefs, '', now), false);
    assert.equal(C.eligible(gig({ id: 'venue:2' }), prefs, '', now), true);
    assert.equal(C.match(gig(), prefs).tier, 2);
    assert.equal(JSON.stringify(prefs.favourites), before);
});
test('must-see favourites survive a short calendar window', () => {
    const prefs = C.defaultPreferences();
    assert.equal(C.inCalendarRange(gig(), prefs, '30', now), true);
    assert.equal(C.inCalendarRange(gig({ artists: ['Other artist'] }), prefs, '30', now), false);
});
test('venue titles match only an entire favourite name when no lineup exists', () => {
    const prefs = C.defaultPreferences();
    assert.equal(C.match(gig({ artists: [] }), prefs).label, 'Title match');
    assert.equal(C.inCalendarRange(gig({ artists: [] }), prefs, '30', now), true);
    assert.equal(C.match(gig({ artists: [], title: 'A tribute to Amon Amarth' }), prefs).tier, 0);
    assert.equal(C.match(gig({ artists: ['Tribute Band'] }), prefs).tier, 0);
    prefs.favourites = [];
    prefs.dislikedArtists = ['Amon Amarth'];
    assert.equal(C.match(gig({ artists: [] }), prefs).tier, -1);
});
test('feedback is explicit and matching does not mistake a support dislike for a favourite veto', () => {
    const prefs = C.defaultPreferences();
    prefs.dislikedArtists = ['Support act'];
    assert.equal(C.match(gig({ artists: ['Support act'] }), prefs).tier, -1);
    assert.equal(C.match(gig({ artists: ['Amon Amarth', 'Support act'] }), prefs).tier, 2);
    prefs.styles = ['Metal'];
    assert.equal(C.match(gig({ artists: ['Other artist'], styles: ['Melodic death metal'] }), prefs).tier, 1);
});
test('artist aliases and punctuation are normalized without substring identity guesses', () => {
    const prefs = C.defaultPreferences();
    assert.equal(C.match(gig({ artists: ['The Cardigans'] }), prefs).tier, 2);
    assert.equal(C.match(gig({ artists: ['Eek A Mouse'] }), prefs).tier, 2);
    assert.equal(C.match(gig({ artists: ['Amon Amarth tribute'] }), prefs).tier, 0);
});
test('backup round trip, invalid imports and preference conflicts', () => {
    const prefs = C.defaultPreferences();
    assert.deepEqual(C.validatePreferences(JSON.parse(JSON.stringify(prefs))), prefs);
    assert.throws(() => C.validatePreferences({ ...prefs, cities: [] }));
    assert.throws(() => C.validatePreferences({ ...prefs, favourites: 'Amon Amarth' }));
    assert.throws(() => C.validatePreferences({ ...prefs, dislikedArtists: ['Amon Amarth'] }));
});
test('missing coordinates and unknown dates are not fabricated', () => {
    assert.equal(C.coordinates({ lat: null, lon: null }), false);
    assert.equal(C.coordinates({ lat: 100, lon: 18 }), false);
    assert.equal(C.eligible(gig({ localDate: null }), C.defaultPreferences(), '', now), true);
    assert.equal(C.validDate('2026-02-30'), false);
    assert.equal(C.today(new Date('2026-09-07T23:30:00Z')), '2026-09-08');
});
test('snapshot rejects malicious URLs and duplicate event identity; actual fetched snapshot validates', () => {
    const data = { schemaVersion: 1, generatedAt: now.toISOString(), sources: [], events: [gig()] };
    assert.equal(C.validateSnapshot(data), data);
    assert.throws(() => C.validateSnapshot({ ...data, events: [gig({ url: 'javascript:alert(1)' })] }));
    assert.throws(() => C.validateSnapshot({ ...data, events: [gig(), gig()] }));
    C.validateSnapshot(JSON.parse(fs.readFileSync(path.join(root, 'concerts.json'), 'utf8')));
});

function beerHarness() {
    const elements = new Map();
    const doc = { getElementById(id) { if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', addEventListener() {} }); return elements.get(id); } };
    const window = { addEventListener() {}, removeEventListener() {} };
    const context = vm.createContext({ document: doc, window, navigator: {}, console: { log() {}, warn() {}, error() {} }, Date, setInterval, clearInterval });
    vm.runInContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), context);
    return { context, window, elements };
}
test('opening-hours boundaries and overnight beer behavior remain intact', () => {
    const { context } = beerHarness();
    const check = (date, hours) => context.getShopStatus(date, hours);
    const weekly = { 0: null, 1: [10, 19], 2: [10, 19], 6: [10, 15] };
    assert.equal(check(new Date(2026, 8, 7, 10), weekly).status, 'open');
    assert.equal(check(new Date(2026, 8, 7, 19), weekly).status, 'closed');
    assert.equal(check(new Date(2026, 8, 6, 1), { 6: [20, 5], 0: null }).status, 'open');
    assert.equal(check(new Date(2026, 8, 6, 5), { 6: [20, 5], 0: null }).status, 'closed');
    assert.equal(check(new Date(2026, 8, 6, 0), { 6: [11, 0], 0: [13, 20] }).status, 'closed');
    assert.equal(check(new Date(2026, 8, 5, 23, 59), { 6: [11, 24], 0: null }).status, 'open');
});
test('concert sensor updates bypass automatic beer targeting, switching back restores it', () => {
    const { context, window, elements } = beerHarness();
    let captured;
    window.Concerts = { isActive: () => true, updateNavigation(position, heading) { captured = { position, heading }; } };
    const position = { coords: { latitude: 59.2363, longitude: 17.9824 } };
    context.handleLocationUpdate(position);
    context.handleOrientationUpdate({ webkitCompassHeading: 90, alpha: null, absolute: false });
    assert.equal(captured.position, position);
    assert.equal(captured.heading, 90);
    assert.equal(elements.get('distanceText').textContent, '');
    window.Concerts.isActive = () => false;
    context.updateDisplay();
    assert.match(elements.get('distanceText').textContent, /^Distance: [\d.]+ km/);
    assert.match(elements.get('compassNeedle').style.transform, /^rotate\(/);
});
test('relative alpha cannot become a concert heading; absolute alpha uses compass direction', () => {
    const { context, window } = beerHarness();
    context.handleOrientationUpdate({ alpha: 30, absolute: false });
    assert.equal(window.BeerCompass.getHeading(), null);
    context.handleOrientationUpdate({ alpha: 30, absolute: true });
    assert.equal(window.BeerCompass.getHeading(), 330);
});
