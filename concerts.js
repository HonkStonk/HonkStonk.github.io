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
    let detailMode = false;
    let selectedId = null;
    let cityFilter = '';
    let feedMode = 'matches';
    let feedLimit = 8;
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
    function syncConcertView() {
        $('concertPlanner').hidden = !active || detailMode;
        for (const id of ['concertIntro', 'concertDetail', 'guitarNeedle']) $(id).hidden = !active || !detailMode;
        $('compassDisplay').hidden = active && !detailMode;
    }
    function switchMode(concerts) {
        active = concerts;
        if (active) detailMode = false;
        $('beerMode').setAttribute('aria-pressed', String(!active));
        $('concertMode').setAttribute('aria-pressed', String(active));
        for (const id of ['beerIntro', 'startCompass', 'infoDisplay', 'compassNeedle']) $(id).hidden = active;
        syncConcertView();
        if (active) render();
        compass.refresh();
    }
    function showPlanner() {
        detailMode = false;
        syncConcertView();
        render();
        $('concertPlanner').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function openEvent(id) {
        selectedId = id;
        detailMode = true;
        if ($('calendarDialog').open) $('calendarDialog').close();
        syncConcertView();
        render();
        $('concertIntro').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    function compareEvents(a, b) {
        return (a.localDate || '9999-99-99').localeCompare(b.localDate || '9999-99-99')
            || (a.localTime || '99:99').localeCompare(b.localTime || '99:99')
            || a.title.localeCompare(b.title);
    }
    function available(city = cityFilter) {
        return (snapshot?.events || []).filter(event => C.eligible(event, preferences, city)).sort(compareEvents);
    }
    function venueAlerts() {
        return (snapshot?.events || []).filter(event => C.venueAlertEligible(event, preferences)).sort(compareEvents);
    }
    function isPlanned(event) {
        return [event.id, ...(event.sourceIds || [])].some(id => preferences.plannedEvents.includes(id));
    }
    function plannedConcerts(city = cityFilter) {
        return available(city).filter(isPlanned);
    }
    function togglePlan(event) {
        const previous = [...preferences.plannedEvents];
        const identities = [event.id, ...(event.sourceIds || [])];
        const next = isPlanned(event)
            ? previous.filter(id => !identities.includes(id))
            : [...new Set([...previous, ...identities])];
        savePreferences({ ...preferences, plannedEvents: next });
        notify(isPlanned(event) ? 'Added to My plans.' : 'Removed from My plans.', () => savePreferences({ ...preferences, plannedEvents: previous }));
    }
    function eventRow(event, alert = false, inCalendar = false) {
        const row = node('div', null, 'gig-row' + (alert ? ' venue-alert' : '') + (inCalendar ? ' calendar-row' : ''));
        const main = node(alert ? 'a' : 'button', null, 'gig-row-main');
        if (!alert) main.type = 'button';
        main.setAttribute('aria-label', (alert ? 'Open details for ' : 'View and navigate to ') + event.title + ', ' + dateLabel(event) + ', ' + event.venue.name + ', ' + event.venue.city);
        const date = node('span', null, 'gig-date');
        if (inCalendar) {
            date.className = 'gig-time';
            date.textContent = event.localTime || 'TBA';
        } else if (event.localDate) {
            const parsed = new Date(event.localDate + 'T12:00:00Z');
            date.append(new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(parsed), node('strong', event.localDate.slice(8)));
            if (alert) date.append(node('span', event.localTime || 'TBA', 'gig-alert-time'));
        } else date.append('DATE', node('strong', '?'));
        const content = node('span');
        content.append(node('span', event.title, 'gig-name'), node('span', event.venue.city + ' · ' + event.venue.name + (event.localDate ? ' · ' + event.localDate.slice(0, 4) : ''), 'gig-meta'));
        if (event.status === 'rescheduled' || event.status === 'postponed') content.append(node('span', event.status === 'rescheduled' ? 'Rescheduled — check event page' : 'Postponed — check event page', 'gig-meta'));
        main.append(date, content, node('span', alert ? 'Avoid area' : C.match(event, preferences).label, 'gig-match'));
        if (alert) {
            main.href = C.safeURL(event.url);
            main.target = '_blank'; main.rel = 'noopener noreferrer';
            row.append(main);
        } else {
            main.onclick = () => openEvent(event.id);
            const plan = node('button', isPlanned(event) ? '✓ Planned' : '+ Plan', 'plan-toggle');
            plan.type = 'button';
            plan.setAttribute('aria-label', (isPlanned(event) ? 'Remove ' : 'Add ') + event.title + (isPlanned(event) ? ' from My plans' : ' to My plans'));
            plan.setAttribute('aria-pressed', String(isPlanned(event)));
            plan.onclick = () => togglePlan(event);
            row.append(main, plan);
        }
        return row;
    }
    function renderList(container, events, empty, alert = false) {
        container.replaceChildren(...events.map(event => eventRow(event, alert)));
        if (!events.length) container.append(node('p', empty, 'empty-state'));
    }
    function renderRegions() {
        $('regionFilters').hidden = feedMode === 'alerts';
        $('regionFilters').replaceChildren();
        for (const city of ['', ...preferences.cities]) {
            const button = node('button', city || 'All places', 'chip');
            button.setAttribute('aria-pressed', String(city === cityFilter));
            button.onclick = () => { cityFilter = city; selectedId = null; feedLimit = 8; render(); };
            $('regionFilters').append(button);
        }
    }
    function renderCalendar() {
        const scope = $('calendarScope').value;
        const candidates = scope === 'plans' ? plannedConcerts('') : scope === 'alerts' ? venueAlerts() : available('');
        const events = candidates.sort(compareEvents);
        const agenda = $('calendarList');
        agenda.replaceChildren();
        for (const event of events) {
            const groupKey = event.localDate || 'unknown';
            let group = Array.from(agenda.children).find(child => child.dataset?.date === groupKey);
            if (!group) {
                group = node('section', null, 'calendar-day'); group.dataset.date = groupKey;
                const heading = node('h3');
                if (event.localDate) {
                    const date = new Date(event.localDate + 'T12:00:00Z');
                    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(date);
                    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
                    heading.append(node('strong', event.localDate.slice(8)), weekday + ' · ' + month);
                } else heading.textContent = 'Date to be announced';
                group.append(heading); agenda.append(group);
            }
            group.append(eventRow(event, event.purpose === 'venue_alert', true));
        }
        if (!events.length) agenda.append(node('p', scope === 'plans' ? 'Nothing planned yet. Add concerts from the discovery list.' : 'No announced events.', 'empty-state'));
    }
    function renderFeed(events, matches) {
        const alerts = venueAlerts();
        const plans = events.filter(isPlanned);
        const choices = feedMode === 'matches' ? matches : feedMode === 'all' ? events : feedMode === 'planned' ? plans : alerts;
        $('forYouView').setAttribute('aria-pressed', String(feedMode === 'matches'));
        $('allGigsView').setAttribute('aria-pressed', String(feedMode === 'all'));
        $('plannedGigsView').setAttribute('aria-pressed', String(feedMode === 'planned'));
        $('venueAlertsView').setAttribute('aria-pressed', String(feedMode === 'alerts'));
        $('feedSummary').textContent = feedMode === 'matches' ? matches.length + ' taste matches · soonest first'
            : feedMode === 'all' ? events.length + ' concerts · soonest first'
            : feedMode === 'planned' ? plans.length + ' concerts you plan to attend'
            : alerts.length + ' events at watched places · tap one for details';
        const visible = choices.slice(0, feedLimit);
        renderList($('gigList'), visible, feedMode === 'matches' ? 'No taste matches here yet. Try All concerts or tune your taste.' : feedMode === 'all' ? 'No concerts in this view.' : feedMode === 'planned' ? 'Nothing planned yet. Add a concert from For you or All concerts.' : 'No upcoming busy events at your watched places.', feedMode === 'alerts');
        $('showMoreGigs').hidden = visible.length >= choices.length;
        $('showMoreGigs').textContent = 'Show ' + Math.min(8, choices.length - visible.length) + ' more';
        const totalPlans = plannedConcerts('').length;
        $('calendarCount').textContent = totalPlans ? totalPlans + (totalPlans === 1 ? ' concert planned' : ' concerts planned') : 'Nothing planned yet';
    }
    function render() {
        const events = available();
        const matches = events.filter(event => C.match(event, preferences).tier > 0);
        if (!events.some(event => event.id === selectedId)) selectedId = matches[0]?.id || null;
        const event = selected();
        $('concertTitle').textContent = event ? event.title : 'Your next gig is out there.';
        $('concertSubtitle').textContent = event ? event.venue.city + ' · ' + dateLabel(event) : 'Try a few more artists or styles.';
        $('matchReason').textContent = event ? C.match(event, preferences).reason + (typeof event.listingNote === 'string' ? ' · ' + event.listingNote : '') : 'LET YOUR TASTE LEAD';
        $('gigMatch').textContent = event ? C.match(event, preferences).label : 'No match yet';
        $('planSelectedButton').textContent = event && isPlanned(event) ? '✓ In my plans' : '＋ Add to my plans';
        $('planSelectedButton').setAttribute('aria-pressed', String(!!event && isPlanned(event)));
        $('planSelectedButton').disabled = !event;
        $('pointToGig').disabled = !event || !C.coordinates(event.venue) || event.status === 'postponed';
        $('beerBeforeButton').disabled = !event || !C.coordinates(event.venue);
        $('selectedEventActions').hidden = !event;
        if (event) $('eventSourceLink').href = C.safeURL(event.url);
        $('artistFeedback').replaceChildren();
        const artists = event?.artists || [];
        let feedbackTarget = $('artistFeedback');
        if (artists.length > 4) {
            const details = node('details', null, 'artist-feedback-more');
            details.append(node('summary', 'Rate ' + artists.length + ' artists'));
            $('artistFeedback').append(details);
            feedbackTarget = details;
        }
        for (const artist of artists) {
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
            feedbackTarget.append(row);
        }
        renderRegions();
        renderFeed(events, matches);
        renderCalendar();
        updateNavigation(compass.getPosition(), compass.getHeading());
    }
    function updateNavigation(position, heading) {
        if (!active || !detailMode) return;
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
            const concertCount = snapshot.events.filter(event => event.purpose !== 'venue_alert').length;
            const alertCount = snapshot.events.length - concertCount;
            $('dataStatus').textContent = (old ? 'Older event data · ' : 'Updated ') + updated + ' · ' + concertCount + ' concerts' + (alertCount ? ' + ' + alertCount + ' busy-place alerts' : '') + '. Coverage is still growing.';
            $('sourceDetails').replaceChildren();
            for (const source of snapshot.sources) {
                const text = typeof source.name === 'string' ? source.name : 'Concert source';
                const count = snapshot.events.filter(event => event.providers?.includes(source.id)).length;
                const state = source.status === 'ok' ? 'checked · ' + count + ' listings'
                    : count ? 'using ' + count + ' saved listings · ' + (source.status === 'not_configured' ? 'live refresh not connected' : 'latest refresh failed')
                    : source.status === 'not_configured' ? (source.lastSuccess ? 'no current listings · live refresh not connected' : 'not connected yet')
                    : 'no current listings · update unavailable';
                const paragraph = node('p', text + ': ' + state + (source.lastSuccess ? ' · last checked ' + new Date(source.lastSuccess).toLocaleDateString('en-GB') : '') + '.');
                $('sourceDetails').append(paragraph);
            }
            for (const gap of Array.isArray(snapshot.coverage?.gaps) ? snapshot.coverage.gaps : []) {
                if (typeof gap.name !== 'string' || typeof gap.note !== 'string') continue;
                const paragraph = node('p', gap.name + ': ' + gap.note + ' ');
                if (C.safeURL(gap.url)) {
                    const link = node('a', 'Venue programme ↗');
                    link.href = gap.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
                    paragraph.append(link);
                }
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
        $('watchedVenues').value = preferences.watchedVenues.join('\n');
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
    function preferencesFromForm() {
        return C.validatePreferences({ ...preferences,
                favourites: C.splitList($('favouriteArtists').value),
                dislikedArtists: C.splitList($('dislikedArtists').value),
                cities: C.splitList($('preferredCities').value),
                watchedVenues: C.splitList($('watchedVenues').value),
                styles: [...new Set([...Array.from($('styleOptions').querySelectorAll('[aria-pressed="true"]')).map(button => button.textContent), ...C.splitList($('customStyles').value)])]
        });
    }
    $('preferencesForm').onsubmit = event => {
        event.preventDefault();
        try {
            const next = preferencesFromForm();
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
        const previousPlans = [...preferences.plannedEvents];
        const identities = [event.id, ...(event.sourceIds || [])];
        detailMode = false;
        savePreferences({ ...preferences, hiddenEvents: [...new Set([...previous, ...identities])], plannedEvents: previousPlans.filter(id => !identities.includes(id)) });
        syncConcertView();
        notify('Gig hidden. Your artist preferences are unchanged.', () => savePreferences({ ...preferences, hiddenEvents: previous, plannedEvents: previousPlans }));
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
    $('calendarScope').onchange = renderCalendar;
    $('forYouView').onclick = () => { feedMode = 'matches'; feedLimit = 8; render(); };
    $('allGigsView').onclick = () => { feedMode = 'all'; feedLimit = 8; render(); };
    $('plannedGigsView').onclick = () => { feedMode = 'planned'; feedLimit = 8; render(); };
    $('venueAlertsView').onclick = () => { feedMode = 'alerts'; feedLimit = 8; render(); };
    $('showMoreGigs').onclick = () => { feedLimit += 8; render(); };
    $('backToConcerts').onclick = showPlanner;
    $('planSelectedButton').onclick = () => { const event = selected(); if (event) togglePlan(event); };
    $('pointToGig').onclick = () => { sensorMessage = ''; locationMessage = ''; compass.start(); };
    $('refreshConcerts').onclick = loadConcerts;
    document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
    window.Concerts = {
        isActive: () => active && detailMode,
        updateNavigation,
        sensorStatus(message, sticky = false) { sensorMessage = sticky ? message : ''; if (active && detailMode) $('gigNavigationStatus').textContent = message; },
        locationError(error) { locationMessage = error.code === 1 ? 'Location permission denied. You can still browse gigs.' : 'Location is unavailable. Try again outside.'; if (active && detailMode) $('gigNavigationStatus').textContent = locationMessage; }
    };
    window.SpotifyImport?.init({
        getPreferences: () => preferences, savePreferences, openPreferences, notify,
        beforeConnect: () => savePreferences(preferencesFromForm()), showConcerts: () => switchMode(true)
    });
    loadConcerts();
    if (storageNotice) notify(storageNotice);
})();
