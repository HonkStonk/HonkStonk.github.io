import json
import sys
import tempfile
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import fetch_concerts as fc
from collector_credentials import load_ticketmaster_key, load_tickster_key

NOW = '2026-09-09T00:00:00+00:00'
VENUE = {'name': 'Kafé 44', 'city': 'Stockholm', 'lat': None, 'lon': None}


class SmallVenueTests(unittest.TestCase):
    def test_nupagang_requires_complete_card_list_and_correct_venue(self):
        url = 'https://example.com/sv/event/123/'
        source = {'id': 'kafe44_nupagang', 'indexUrl': 'https://example.com/venue/', 'eventPrefix': 'https://example.com/sv/event/', 'venue': VENUE}
        listing = {'@type': 'ItemList', 'numberOfItems': 1, 'itemListElement': [{'url': url}]}
        raw = {'@type': 'Event', 'url': url, 'name': 'Band', 'startDate': '2026-10-08T18:00:00+02:00', 'location': {'name': 'Kafé 44', 'address': {'addressLocality': 'Stockholm'}}}
        def get(address):
            if address == source['indexUrl']:
                return '<script type="application/ld+json">' + json.dumps(listing) + '</script><article class="vote-card" data-kind="concert" data-share-url="' + url + '"></article>'
            return '<script type="application/ld+json">' + json.dumps(raw) + '</script>'
        gig = fc.collect_nupagang_venue(source, NOW, get)[0]
        self.assertEqual(gig['localDate'], '2026-10-08')
        self.assertEqual(gig['localTime'], '18:00')
        self.assertEqual(gig['artists'], [])
        raw['location']['name'] = 'Different venue'
        with self.assertRaises(ValueError): fc.collect_nupagang_venue(source, NOW, get)
        listing['numberOfItems'] = 2
        with self.assertRaises(ValueError): fc.collect_nupagang_venue(source, NOW, get)

    def brew(self, rows):
        source = {'id': 'brewpunk', 'indexUrl': 'https://example.com/shows/', 'venues': {'Kafé 44, Stockholm': VENUE}}
        html = '<table><tr><th>När</th><th>Vilka</th><th>Var</th></tr>' + ''.join('<tr>' + ''.join('<td>' + c + '</td>' for c in r) + '</tr>' for r in rows) + '</table>'
        return fc.collect_brewpunk(source, NOW, lambda url: html)

    def test_brew_normalizes_cafe_spelling_and_keeps_time_unknown(self):
        gigs = self.brew([['2026-09-10', 'Dis, Dissekerad, Yuppiecrusher', 'Kafe 44, Stockholm'], ['2026-09-10', 'Another Band', 'Unconfigured place']])
        self.assertEqual(len(gigs), 1)
        self.assertEqual(gigs[0]['artists'], ['Dis', 'Dissekerad', 'Yuppiecrusher'])
        self.assertIsNone(gigs[0]['localTime'])
        self.assertIsNone(gigs[0]['dateTime'])
        self.assertEqual(gigs[0]['styleEvidence'], 'punk_calendar')
        self.assertIn('independent', gigs[0]['listingNote'])

    def test_brew_rejects_multi_day_or_duplicate_bills(self):
        for rows in [[['2026-09-10 och 2026-09-11', 'Band', 'Kafé 44, Stockholm']], [['2026-09-10', 'Band', 'Kafé 44, Stockholm']] * 2]:
            with self.assertRaises(ValueError):
                self.brew(rows)
        gig = self.brew([['2026-09-10', 'Band (och filmvisning)', 'Kafé 44, Stockholm']])[0]
        self.assertEqual(gig['artists'], [])

    def test_geronimos_paginates_live_cards_and_ignores_quiz(self):
        source = {'id': 'geronimos', 'indexUrl': 'https://example.com/calendar/', 'eventPrefix': 'https://example.com/events/', 'ajaxUrl': 'https://example.com/ajax', 'venue': VENUE}
        def card(slug, title):
            return f'<article class="mec-event-article"><h3 class="mec-event-title"><a href="https://example.com/events/{slug}/">{title}</a></h3></article>'
        settings = '''<script>jQuery("#x").mecListView({id: "1", end_date: "2026-09-10", offset: "1", current_month_divider: "202609", atts: "atts%5Bskin%5D=list", ajax_url: "https://example.com/ajax"});</script>'''
        requests = []
        def get(url, **kwargs):
            if url == source['indexUrl']:
                return settings + card('quiz', 'Live Music Quiz') + card('a', 'Band • Live')
            if url == source['ajaxUrl']:
                requests.append(kwargs)
                return json.dumps({'count': 1, 'html': card('b', 'Other Band • Live'), 'end_date': '2026-10-01', 'offset': 2, 'current_month_divider': '202610'}) if len(requests) == 1 else json.dumps({'count': 0, 'html': ''})
            return '<span class="mec-start-date-label">okt 25 2026</span><h1 class="mec-single-title">Band • Live</h1><div class="mec-single-event-description">Doors: 19:00 Live: 20:00</div>'
        events = fc.collect_geronimos(source, NOW, get)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]['dateTime'], '2026-10-25T18:00:00+00:00')
        self.assertEqual(events[0]['timeKind'], 'doors')
        self.assertIn(b'mec_offset=2', requests[1]['data'])

    def test_larry_groups_image_date_and_title_links_without_inventing_artists(self):
        source = {'id': 'larrys_corner', 'indexUrl': 'https://example.com/en/events', 'venue': VENUE, 'musicPattern': r'\bguitar\b'}
        html = '<a href="/en/events/band"><img></a><a href="/en/events/band">Thursday 10 September 2026 • 7.32pm</a><a href="/en/events/band">Band!</a><a href="/en/events/art">Friday 11 September 2026</a><a href="/en/events/art">Art opening</a>'
        def get(url):
            if url == source['indexUrl']: return html
            return '<p>Electric guitar concert</p>' if url.endswith('/band') else '<p>Paintings on display</p>'
        events = fc.collect_larrys(source, NOW, get)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['title'], 'Band!')
        self.assertEqual(events[0]['localTime'], '19:32')
        self.assertEqual(events[0]['artists'], [])


class CredentialTests(unittest.TestCase):
    def test_required_ticketmaster_preflight_does_not_fetch_or_replace_snapshot(self):
        with patch.object(sys, 'argv', ['fetch_concerts.py', '--require-ticketmaster']), patch.object(fc, 'load_ticketmaster_key', return_value='absent'), patch.object(fc, 'refresh') as refresh, redirect_stdout(StringIO()):
            self.assertEqual(fc.main(), 1)
            refresh.assert_not_called()

    def test_environment_wins_without_reading_local_storage(self):
        env = {'TICKETMASTER_API_KEY': 'environment-key'}
        self.assertEqual(load_ticketmaster_key('/unused', environ=env, run=lambda *a, **k: self.fail()), 'environment')
        env = {'TICKSTER_API_KEY': 'environment-key'}
        self.assertEqual(load_tickster_key('/unused', environ=env, run=lambda *a, **k: self.fail()), 'environment')

    def test_local_key_load_and_errors_never_reveal_process_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / '.local'; p.mkdir(); (p / 'ticketmaster-key.xml').write_text('encrypted')
            env = {}
            self.assertEqual(load_ticketmaster_key(tmp, environ=env, platform='nt', run=lambda *a, **k: SimpleNamespace(returncode=0, stdout='test-key\n')), 'encrypted_local')
            self.assertEqual(env['TICKETMASTER_API_KEY'], 'test-key')
            with self.assertRaises(RuntimeError) as caught:
                load_ticketmaster_key(tmp, environ={}, platform='nt', run=lambda *a, **k: SimpleNamespace(returncode=1, stdout='private-key'))
            self.assertNotIn('private-key', str(caught.exception))
            self.assertEqual(load_ticketmaster_key(tmp, environ={}, platform='posix'), 'absent')

    def test_required_tickster_preflight_does_not_fetch_or_replace_snapshot(self):
        with patch.object(sys, 'argv', ['fetch_concerts.py', '--require-tickster']), patch.object(fc, 'load_ticketmaster_key', return_value='absent'), patch.object(fc, 'load_tickster_key', return_value='absent'), patch.object(fc, 'refresh') as refresh, redirect_stdout(StringIO()):
            self.assertEqual(fc.main(), 1)
            refresh.assert_not_called()


if __name__ == '__main__': unittest.main()
