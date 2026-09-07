(function () {
    'use strict';
    const C = window.ConcertCore;
    const compass = window.BeerCompass;
    const $ = id => document.getElementById(id);
    const storageKey = 'magic-compass.preferences.v1';
    let preferences = C.defaultPreferences();
    let storageNotice = '';
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) preferences = C.validatePreferences(JSON.parse(saved));
    } catch { storageNotice = 'Your saved preferences could not be read. You can import a backup in the menu.'; }
    let snapshot = null;
    let active = false;
    let selectedId = null;
    let cityFilter = '';
    let loading = false;
    let sensorMessage = '';
    let locationMessage = '';
    let lastPositionSeen = null;
    let rotation = 0;
    let toastTimer;
    const selected = () => snapshot?.events.find(event => event.id === selectedId) || null;
    const node = (tag, text, className) => {
        const result = document.createElement(tag);
        if (text != null) result.textContent = text;
        if (className) result.className = className;
        return result;
    };
    function notify(message, undo) {
        const toast = $('toast');
        clearTimeout(toastTimer);
        toast.replaceChildren(document.createTextNode(message));
        if (undo) {
            const button = node('button', 'Undo');
            button.onclick = () => { undo(); toast.hidden = true; };
            toast.append(button);
        }
        toast.hidden = false;
        toastTimer = setTimeout(() => { toast.hidden = true; }, undo ? 15000 : 6500);
    }
    function savePreferences(next) {
        preferences = C.validatePreferences(next);
        try { localStorage.setItem(storageKey, JSON.stringify(preferences)); }
        catch { notify('Storage is unavailable. Export a backup to keep these changes.'); }
        render();
    }
    function openDialog(id) { $(id).showModal(); }
    function switchMode(concerts) {
        active = concerts;
        $('beerMode').setAttribute('aria-pressed', String(!active));
        $('concertMode').setAttribute('aria-pressed', String(active));
        for (const id of ['beerIntro', 'startCompass', 'infoDisplay', 'compassNeedle']) $(id).hidden = active;
        for (const id of ['concertIntro', 'concertView', 'guitarNeedle']) $(id).hidden = !active;
        if (active) render();
        compass.refresh();
    }
    function dateLabel(event, withTime = true) {
        if (!event.localDate) return 'Date to be announced';
        const date = new Date(event.localDate + 'T12:00:00Z');
        let label = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
        if (withTime) label += event.localTime ? ' · ' + (event.timeKind === 'doors' ? 'Doors ' : event.timeKind === 'listed' ? 'Listed time ' : '') + event.localTime : ' · Time TBA';
        return label;
    }
    function distance(event) {
        const position = compass.getPosition();
        return position && C.coordinates(event.venue) ? compass.distance(position.coords.latitude, position.coords.longitude, event.venue.lat, event.venue.lon) : Infinity;
    }
    function available() {
        return (snapshot?.events || []).filter(event => C.eligible(event, preferences, cityFilter)).sort((a, b) => {
            const taste = C.match(b, preferences).tier - C.match(a, preferences).tier;
            const travel = distance(a) - distance(b);
            return taste || (Number.isFinite(travel) ? travel : 0) || (a.localDate || '9999').localeCompare(b.localDate || '9999');
        });
    }
    function eventRow(event) {
        const row = node('button', null, 'gig-row');
        row.type = 'button';
        row.setAttribute('aria-pressed', String(event.id === selectedId));
        row.setAttribute('aria-label', event.title + ', ' + dateLabel(event) + ', ' + event.venue.name + ', ' + event.venue.city);
        const date = node('span', null, 'gig-date');
        if (event.localDate) {
            const parsed = new Date(event.localDate + 'T12:00:00Z');
            date.append(new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(parsed), node('strong', event.localDate.slice(8)));
        } else date.append('DATE', node('strong', '?'));
        const content = node('span');
        content.append(node('span', event.title, 'gig-name'), node('span', event.venue.city + ' · ' + event.venue.name + (event.localDate ? ' · ' + event.localDate.slice(0, 4) : ''), 'gig-meta'));
        if (event.status === 'rescheduled' || event.status === 'postponed') content.append(node('span', event.status === 'rescheduled' ? 'Rescheduled — check event page' : 'Postponed — check event page', 'gig-meta'));
        row.append(date, content, node('span', C.match(event, preferences).label, 'gig-match'));
        row.onclick = () => {
            selectedId = event.id;
            $('calendarDialog').close();
            render();
            $('concertIntro').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        return row;
    }
    function renderList(container, events, empty) {
        container.replaceChildren(...events.map(eventRow));
        if (!events.length) container.append(node('p', empty, 'empty-state'));
    }
    function renderRegions() {
        $('regionFilters').replaceChildren();
        for (const city of ['', ...preferences.cities]) {
            const button = node('button', city || 'All places', 'chip');
            button.setAttribute('aria-pressed', String(city === cityFilter));
            button.onclick = () => { cityFilter = city; selectedId = null; render(); };
            $('regionFilters').append(button);
        }
    }
    function renderCalendar() {
        const events = available().filter(event => C.match(event, preferences).tier > 0 && C.inCalendarRange(event, preferences, $('calendarRange').value));
        events.sort((a, b) => (a.localDate || '9999').localeCompare(b.localDate || '9999'));
        renderList($('calendarList'), events, 'No matching gigs in this view yet. Try more artists or styles.');
    }
    function render() {
        const events = available();
        const matches = events.filter(event => C.match(event, preferences).tier > 0);
        if (!events.some(event => event.id === selectedId)) selectedId = matches[0]?.id || null;
        const event = selected();
        $('concertTitle').textContent = event ? event.title : 'Your next gig is out there.';
        $('concertSubtitle').textContent = event ? event.venue.city + ' · ' + dateLabel(event) : 'Try a few more artists or styles.';
        $('matchReason').textContent = event ? C.match(event, preferences).reason : 'LET YOUR TASTE LEAD';
        $('gigMatch').textContent = event ? C.match(event, preferences).label : 'No match yet';
        $('pointToGig').disabled = !event || !C.coordinates(event.venue) || event.status === 'postponed';
        $('beerBeforeButton').disabled = !event || !C.coordinates(event.venue);
        $('selectedEventActions').hidden = !event;
        if (event) $('eventSourceLink').href = C.safeURL(event.url);
        $('artistFeedback').replaceChildren();
        for (const artist of event?.artists || []) {
            const row = node('div');
            row.append(node('span', artist));
            for (const [field, other, symbol, label] of [['favourites', 'dislikedArtists', '👍', 'Like'], ['dislikedArtists', 'favourites', '👎', 'Skip']]) {
                const button = node('button', symbol);
                const pressed = preferences[field].some(a => C.key(a) === C.key(artist));
                button.setAttribute('aria-label', label + ' artist ' + artist);
                button.setAttribute('aria-pressed', String(pressed));
                button.onclick = () => {
                    const previous = { favourites: [...preferences.favourites], dislikedArtists: [...preferences.dislikedArtists] };
                    const values = preferences[field].filter(a => C.key(a) !== C.key(artist));
                    if (!pressed) values.push(artist);
                    savePreferences({ ...preferences, [field]: values, [other]: preferences[other].filter(a => C.key(a) !== C.key(artist)) });
                    notify(artist + (pressed ? ' preference cleared.' : field === 'favourites' ? ' added to favourites.' : ' added to your skip list.'), () => savePreferences({ ...preferences, ...previous }));
                };
                row.append(button);
            }
            $('artistFeedback').append(row);
        }
        renderRegions();
        renderList($('gigList'), matches, snapshot ? 'No favourite or style matches in the current sources for these places yet. Add a style, explore other gigs, or check back after an update.' : 'Concert data is not available yet. Beer mode still works.');
        renderList($('otherGigList'), events.filter(event => C.match(event, preferences).tier === 0), 'No other gigs in the current sources for these places.');
        renderCalendar();
        updateNavigation(compass.getPosition(), compass.getHeading());
    }
    function updateNavigation(position, heading) {
        if (!active) return;
        const event = selected();
        if (position && position !== lastPositionSeen) { locationMessage = ''; lastPositionSeen = position; }
        $('gigDistance').textContent = !event ? '—' : !C.coordinates(event.venue) ? 'Venue unmapped' : position ? distance(event).toFixed(1) + ' km' : 'Location off';
        let message = !event ? 'Choose a gig to point to its venue.' : !C.coordinates(event.venue) ? 'Venue coordinates are not available. Use the event link.' : !position ? 'Tap “Point to venue” to enable your compass.' : !Number.isFinite(heading) ? 'Location found. Waiting for a compass heading…' : 'Pointing to ' + event.venue.name;
        if (event?.status === 'postponed') message = 'This gig is postponed. Check the event page before travelling.';
        if (event && position && C.coordinates(event.venue) && Number.isFinite(heading)) {
            const target = compass.bearing(position.coords.latitude, position.coords.longitude, event.venue.lat, event.venue.lon) - heading;
            // Follow the shortest turn across north, rather than spinning 359 degrees.
            rotation += ((target - rotation + 540) % 360 + 360) % 360 - 180;
            $('guitarNeedle').style.transform = 'rotate(' + rotation + 'deg)';
        } else if (!event) { rotation = 0; $('guitarNeedle').style.transform = 'rotate(0deg)'; }
        $('gigNavigationStatus').textContent = locationMessage || sensorMessage || message;
    }
    async function loadConcerts() {
        if (loading) return;
        loading = true;
        $('refreshConcerts').disabled = true;
        $('dataStatus').textContent = 'Checking concert updates…';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('./concerts.json', { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error('Unavailable');
            const next = C.validateSnapshot(await response.json());
            snapshot = next;
            const updated = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/Stockholm' }).format(new Date(snapshot.generatedAt));
            const old = Date.now() - Date.parse(snapshot.generatedAt) > 48 * 60 * 60 * 1000;
            $('dataStatus').textContent = (old ? 'Older concert data · ' : 'Updated ') + updated + ' · ' + snapshot.events.length + ' gigs in current sources. Coverage is still growing.';
            $('sourceDetails').replaceChildren();
            for (const source of snapshot.sources) {
                const text = typeof source.name === 'string' ? source.name : 'Concert source';
                const state = source.status === 'ok' ? 'checked' : source.status === 'not_configured' ? 'not connected yet' : 'update unavailable';
                const paragraph = node('p', text + ': ' + state + (source.lastSuccess ? ' · ' + new Date(source.lastSuccess).toLocaleDateString('en-GB') : '') + '.');
                $('sourceDetails').append(paragraph);
            }
            render();
        } catch {
            $('dataStatus').textContent = snapshot ? 'Could not check for updates. Keeping the last loaded gigs; check event links for changes.' : 'Could not load concerts. Check your connection and try again. Beer mode is available.';
            if (!snapshot) render();
        } finally { clearTimeout(timer); loading = false; $('refreshConcerts').disabled = false; }
    }
    const styles = ['Indie', 'Rock', 'Metal', 'Punk', 'Reggae', 'Soul', 'Jazz', 'Folk', 'Pop', 'Electronic'];
    function openPreferences() {
        $('favouriteArtists').value = preferences.favourites.join('\n');
        $('dislikedArtists').value = preferences.dislikedArtists.join('\n');
        $('preferredCities').value = preferences.cities.join(', ');
        $('customStyles').value = preferences.styles.filter(s => !styles.some(t => C.key(t) === C.key(s))).join(', ');
        $('styleOptions').replaceChildren();
        for (const style of styles) {
            const button = node('button', style, 'chip');
            button.type = 'button';
            button.setAttribute('aria-pressed', String(preferences.styles.some(s => C.key(s) === C.key(style))));
            button.onclick = () => button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
            $('styleOptions').append(button);
        }
        $('preferencesError').textContent = '';
        $('restoreHidden').textContent = 'Restore hidden gigs (' + preferences.hiddenEvents.length + ')';
        openDialog('preferencesDialog');
    }
    $('preferencesForm').onsubmit = event => {
        event.preventDefault();
        try {
            const next = { ...preferences,
                favourites: C.splitList($('favouriteArtists').value),
                dislikedArtists: C.splitList($('dislikedArtists').value),
                cities: C.splitList($('preferredCities').value),
                styles: [...new Set([...Array.from($('styleOptions').querySelectorAll('[aria-pressed="true"]')).map(button => button.textContent), ...C.splitList($('customStyles').value)])]
            };
            C.validatePreferences(next);
            cityFilter = '';
            savePreferences(next);
            $('preferencesDialog').close();
            switchMode(true);
        } catch (error) { $('preferencesError').textContent = error.message; }
    };
    $('hideEventButton').onclick = () => {
        const event = selected();
        if (!event) return;
        const previous = [...preferences.hiddenEvents];
        savePreferences({ ...preferences, hiddenEvents: [...new Set([...previous, event.id, ...(event.sourceIds || [])])] });
        notify('Gig hidden. Your artist preferences are unchanged.', () => savePreferences({ ...preferences, hiddenEvents: previous }));
    };
    $('restoreHidden').onclick = () => { savePreferences({ ...preferences, hiddenEvents: [] }); $('restoreHidden').textContent = 'Restore hidden gigs (0)'; notify('Hidden gigs restored.'); };
    $('exportPreferences').onclick = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' }));
        const link = node('a'); link.href = url; link.download = 'magic-compass-preferences.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    $('importPreferences').onclick = () => $('importFile').click();
    $('importFile').onchange = async () => {
        const file = $('importFile').files[0];
        if (!file) return;
        try {
            if (file.size > 1000000) throw new Error('This file is too large to be a preference backup.');
            const next = C.validatePreferences(JSON.parse(await file.text()));
            cityFilter = '';
            savePreferences(next);
            $('preferencesDialog').close();
            openPreferences();
            notify('Preferences restored from backup.');
        } catch (error) { $('preferencesError').textContent = error instanceof SyntaxError ? 'This is not a valid JSON backup.' : error.message; }
        $('importFile').value = '';
    };
    $('beerBeforeButton').onclick = () => {
        const event = selected();
        if (!event || !C.coordinates(event.venue)) return;
        $('beerBeforeContext').textContent = 'Pubs within 3 km of ' + event.venue.name + ', open now according to your curated weekly hours. This does not predict opening on the concert date.';
        const shops = compass.nearbyBeer(event.venue.lat, event.venue.lon);
        $('beerBeforeList').replaceChildren();
        for (const shop of shops) {
            const item = node('div', null, 'beer-place');
            const map = node('a', 'Directions ↗');
            map.href = 'https://maps.apple.com/?daddr=' + shop.lat + ',' + shop.lon + '&dirflg=w';
            map.target = '_blank'; map.rel = 'noopener noreferrer';
            item.append(node('strong', shop.name), node('p', shop.distance.toFixed(1) + ' km from venue · open now'), map);
            $('beerBeforeList').append(item);
        }
        if (!shops.length) $('beerBeforeList').append(node('p', 'No currently open pubs from your list within 3 km. The curated list mainly covers Stockholm.', 'empty-state'));
        openDialog('beerBeforeDialog');
    };
    $('beerMode').onclick = () => switchMode(false);
    $('concertMode').onclick = () => switchMode(true);
    $('preferencesButton').onclick = openPreferences;
    $('tuneTasteButton').onclick = openPreferences;
    $('calendarButton').onclick = () => { renderCalendar(); openDialog('calendarDialog'); };
    $('calendarRange').onchange = renderCalendar;
    $('pointToGig').onclick = () => { sensorMessage = ''; locationMessage = ''; compass.start(); };
    $('refreshConcerts').onclick = loadConcerts;
    document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
    window.Concerts = {
        isActive: () => active,
        updateNavigation,
        sensorStatus(message, sticky = false) { sensorMessage = sticky ? message : ''; if (active) $('gigNavigationStatus').textContent = message; },
        locationError(error) { locationMessage = error.code === 1 ? 'Location permission denied. You can still browse gigs.' : 'Location is unavailable. Try again outside.'; if (active) $('gigNavigationStatus').textContent = locationMessage; }
    };
    loadConcerts();
    if (storageNotice) notify(storageNotice);
})();
