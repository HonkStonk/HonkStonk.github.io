/* Shared, dependency-free concert and preference rules. Also used by the tests. */
(function (root, factory) {
    const core = factory();
    if (typeof module === 'object' && module.exports) module.exports = core;
    else root.ConcertCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const defaultPreferences = () => ({
        version: 1,
        favourites: ['Dina Ögon', 'Amon Amarth', 'Cardigans', 'Eek-a-mouse', 'Asta Kask', 'Kardborrebandet'],
        dislikedArtists: [], styles: [],
        cities: ['Stockholm', 'Falköping', 'Skövde', 'Uppsala'], hiddenEvents: [],
        watchedVenues: ['Strawberry Arena'], plannedEvents: []
    });
    function key(value) {
        const name = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return name === 'the cardigans' ? 'cardigans' : name;
    }
    function splitList(text) {
        return [...new Map(text.split(/[,\n]/).map(x => x.trim()).filter(Boolean).map(x => [key(x), x])).values()];
    }
    function validatePreferences(value) {
        if (!value || value.version !== 1) throw new Error('This backup format is not supported.');
        const result = { version: 1 };
        for (const name of ['favourites', 'dislikedArtists', 'styles', 'cities', 'hiddenEvents', 'watchedVenues', 'plannedEvents']) {
            const items = value[name] == null && name === 'watchedVenues' ? ['Strawberry Arena'] : value[name] == null && name === 'plannedEvents' ? [] : value[name];
            if (!Array.isArray(items) || items.length > (['hiddenEvents', 'plannedEvents'].includes(name) ? 5000 : 200) || items.some(x => typeof x !== 'string' || !x.trim() || x.length > 300)) {
                throw new Error('Please use a valid Magic Compass preference backup.');
            }
            result[name] = [...new Set(items.map(x => x.trim()))];
        }
        if (!result.cities.length) throw new Error('Add at least one city.');
        if (result.favourites.some(a => result.dislikedArtists.some(b => key(a) === key(b)))) throw new Error('An artist is in both your favourites and skip list. Choose one.');
        return result;
    }
    function safeURL(value) {
        try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
    }
    function coordinates(venue) {
        return !!venue && typeof venue.lat === 'number' && typeof venue.lon === 'number' && Number.isFinite(venue.lat) && Number.isFinite(venue.lon) && Math.abs(venue.lat) <= 90 && Math.abs(venue.lon) <= 180;
    }
    function validDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const time = Date.parse(value + 'T12:00:00Z');
        return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
    }
    function validateSnapshot(data) {
        if (!data || data.schemaVersion !== 1 || !Array.isArray(data.events) || !Array.isArray(data.sources) || !Number.isFinite(Date.parse(data.generatedAt))) throw new Error('The concert update could not be read.');
        const ids = new Set();
        for (const event of data.events) {
            if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id) || typeof event.title !== 'string' || !event.title || !event.venue || typeof event.venue.name !== 'string' || typeof event.venue.city !== 'string' || !Array.isArray(event.artists) || event.artists.some(x => typeof x !== 'string') || !Array.isArray(event.styles) || event.styles.some(x => typeof x !== 'string') || !safeURL(event.url) || (event.localDate !== null && !validDate(event.localDate)) || (event.localTime != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.localTime)) || (event.sourceIds != null && (!Array.isArray(event.sourceIds) || event.sourceIds.some(x => typeof x !== 'string')))) throw new Error('The concert update contains an invalid event.');
            ids.add(event.id);
        }
        return data;
    }
    function today(now = new Date()) {
        return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    }
    function match(event, prefs) {
        const favourite = event.artists.find(a => prefs.favourites.some(b => key(a) === key(b)));
        if (favourite) return { tier: 2, label: 'Favourite', reason: 'You love ' + favourite };
        if (event.artists.some(a => prefs.dislikedArtists.some(b => key(a) === key(b)))) return { tier: -1, label: 'Skipped artist', reason: 'In your artist skip list' };
        // Some venue calendars expose only a title. Match a whole title, never
        // names mentioned inside tribute nights or promotional descriptions.
        if (!event.artists.length) {
            const titleFavourite = prefs.favourites.find(a => key(a) === key(event.title));
            if (titleFavourite) return { tier: 2, label: 'Title match', reason: 'Event title matches ' + titleFavourite + ' — check the line-up' };
            if (prefs.dislikedArtists.some(a => key(a) === key(event.title))) return { tier: -1, label: 'Skipped artist', reason: 'Event title matches your artist skip list' };
        }
        const style = prefs.styles.find(s => event.styles.some(t => key(t) === key(s) || (' ' + key(t) + ' ').includes(' ' + key(s) + ' ')));
        if (style) return event.styleEvidence === 'description'
            ? { tier: 1, label: style, reason: 'The event page mentions ' + style + ' — check the description' }
            : event.styleEvidence === 'punk_calendar'
            ? { tier: 1, label: style, reason: 'Selected by BrewPunk’s independent punk-gig calendar' }
            : { tier: 1, label: style, reason: 'Your taste: ' + style };
        return { tier: 0, label: 'Explore', reason: 'Another gig in your places' };
    }
    function isHidden(event, prefs) {
        return [event.id, ...(event.sourceIds || [])].some(id => prefs.hiddenEvents.includes(id));
    }
    function eligible(event, prefs, city = '', now = new Date()) {
        return event.purpose !== 'venue_alert' && (!event.localDate || event.localDate >= today(now)) && event.status !== 'cancelled' && !isHidden(event, prefs) && prefs.cities.some(c => key(c) === key(event.venue.city)) && (!city || key(city) === key(event.venue.city)) && match(event, prefs).tier >= 0;
    }
    function venueAlertEligible(event, prefs, now = new Date()) {
        return event.purpose === 'venue_alert' && (!event.localDate || event.localDate >= today(now)) && event.status !== 'cancelled' && !isHidden(event, prefs) && prefs.watchedVenues.some(venue => key(venue) === key(event.venue.name));
    }
    function inCalendarRange(event, prefs, days, now = new Date()) {
        if (days === 'all' || !event.localDate) return true;
        const end = new Date(today(now) + 'T12:00:00Z');
        end.setUTCDate(end.getUTCDate() + Number(days));
        return event.localDate <= end.toISOString().slice(0, 10);
    }
    return { defaultPreferences, key, splitList, validatePreferences, safeURL, coordinates, validDate, validateSnapshot, today, match, isHidden, eligible, venueAlertEligible, inCalendarRange };
});
