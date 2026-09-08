import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import fetch_concerts as fc

NOW = '2026-09-07T12:00:00+00:00'
SOURCE = {'id': 'venue', 'name': 'Venue calendar', 'venue': {'name': 'Hovet', 'city': 'Stockholm', 'lat': 59.29, 'lon': 18.08}}


def event(identifier='venue:a', date='2026-10-24'):
    return {'id': identifier, 'sourceIds': [identifier], 'providers': [identifier.split(':')[0]], 'title': 'Amon Amarth', 'artists': ['Amon Amarth'], 'styles': ['Metal'], 'venue': SOURCE['venue'], 'localDate': date, 'localTime': '18:30', 'timeKind': 'start', 'url': 'https://example.com/gig', 'status': 'scheduled', 'lastVerifiedAt': NOW}


class CollectorTests(unittest.TestCase):
    def test_tickster_utc_dates_handle_swedish_midnight_and_dst(self):
        raw = {'id': 'a', 'name': 'Gig', 'infoUrl': 'https://www.tickster.com/gig',
               'performers': ['Band'], 'spotifyArtists': [{'name': 'Band', 'id': 'spotify-id'}],
               'tags': ['musik', 'Uppsala', 'indie'], 'state': 'cancelled'}
        for utc, day, clock in [('2026-09-08T22:30:00Z', '2026-09-09', '00:30'),
                                ('2026-03-29T01:30:00Z', '2026-03-29', '03:30'),
                                ('2026-10-25T01:30:00Z', '2026-10-25', '02:30')]:
            result = fc.normalize_tickster({**raw, 'startUtc': utc}, NOW)
            self.assertEqual((result['localDate'], result['localTime']), (day, clock))
            self.assertEqual(result['artists'], ['Band'])
            self.assertEqual(result['styles'], ['indie'])
            self.assertEqual(result['status'], 'cancelled')
            self.assertIsNone(result['venue']['lat'])
        result = fc.normalize_tickster(raw, NOW)
        self.assertIsNone(result['localDate'])
        self.assertIsNone(result['localTime'])

    def test_tickster_paginates_unions_tags_and_ignores_collection_products(self):
        calls = []
        def get(url, headers=None):
            self.assertEqual(headers, {'X-API-KEY': 'private-test-key'})
            self.assertNotIn('private-test-key', url)
            params = parse_qs(urlparse(url).query)
            calls.append(params)
            if not params:
                return json.dumps({'id': 'gig', 'name': 'Band', 'infoUrl': 'https://www.tickster.com/gig'})
            row = {'id': 'gig' if params['skip'] == ['0'] else 'collection',
                   'eventHierarchyType': 'event' if params['skip'] == ['0'] else 'collection',
                   'venue': {'country': 'SE', 'city': 'Uppsala'}}
            return json.dumps({'items': [row], 'totalItems': 2})
        result = fc.collect_tickster({'cities': ['Uppsala']}, 'private-test-key', NOW, get)
        self.assertEqual(len(result), 1)
        self.assertEqual(len(calls), 5)  # Two tags x two pages, one detail.

    def test_tickster_incomplete_or_repeated_page_is_a_failure(self):
        for items in [[], [{'id': 'gig', 'eventHierarchyType': 'collection'}]]:
            with self.assertRaises(ValueError):
                fc.collect_tickster({'cities': ['Uppsala']}, 'test', NOW,
                                    lambda *args, **kwargs: json.dumps({'totalItems': 2, 'items': items}))

    def test_tickster_nullable_empty_collection_is_valid(self):
        rows = fc.collect_tickster({'cities': ['Uppsala']}, 'test', NOW,
                                   lambda *args, **kwargs: json.dumps({'totalItems': 0, 'items': None}))
        self.assertEqual(rows, [])

    def katalin_fixture(self):
        source = {'id': 'katalin', 'indexUrl': 'https://example.com/events/', 'apiUrl': 'https://example.com/wp-json/wp/v2',
                  'venue': {'name': 'Katalin', 'city': 'Uppsala', 'lat': 59.86, 'lon': 17.64}, 'musicGenres': ['Indie']}
        # Minimal factual fields from the public Division 7 WP record; the other
        # record is synthetic and exercises non-music filtering.
        rows = [{'id': 16074, 'slug': 'division-7', 'link': 'https://example.com/events/division-7/',
                 'title': {'rendered': 'Division 7'}, 'genre': [11],
                 'acf': {'date_of_event': '20260925', 'time': '20:00:00', 'ticket_status': 'usual',
                         'book_a_ticket': 'https://secure.tickster.com/h4vu7w09xdvjcmg'}},
                {'id': 2, 'slug': 'comedy', 'genre': [25]}]
        calls = []
        def get(url):
            calls.append(url)
            if '/wp-json/' not in url:
                return '<a href="?tab=2">Next</a><a href="/events/division-7/">Gig</a>' if '?' not in url else '<a href="/events/comedy/">Comedy</a>'
            if '/genre?' in url:
                return json.dumps([{'id': 11, 'name': 'Indie'}, {'id': 25, 'name': 'Stand-up'}])
            return json.dumps(rows)
        return source, rows, calls, get

    def test_katalin_follows_calendar_pages_uses_event_date_and_filters_comedy(self):
        source, rows, calls, get = self.katalin_fixture()
        events = fc.collect_katalin(source, NOW, get)
        self.assertEqual(len(events), 1)
        result = events[0]
        self.assertEqual((result['localDate'], result['localTime'], result['dateTime']),
                         ('2026-09-25', '20:00', '2026-09-25T18:00:00+00:00'))
        self.assertEqual(result['artists'], [])  # Title alone is not a verified lineup.
        self.assertEqual(result['styles'], ['Indie'])
        self.assertEqual(len(calls), 4)

    def test_katalin_missing_metadata_does_not_silently_drop_a_gig(self):
        source, rows, calls, get = self.katalin_fixture()
        rows.pop()
        with self.assertRaises(ValueError):
            fc.collect_katalin(source, NOW, get)

    def test_katalin_missing_time_stays_unknown(self):
        source, rows, calls, get = self.katalin_fixture()
        rows[0]['acf']['time'] = ''
        result = fc.collect_katalin(source, NOW, get)[0]
        self.assertIsNone(result['localTime'])
        self.assertIsNone(result['dateTime'])

    def test_new_source_failure_keeps_ticketmaster_and_does_not_leak_credentials(self):
        config = {'venueSources': [], 'cities': ['Stockholm'], 'horizonDays': 365}
        old = {'sources': [], 'events': [event('tickster:a')]}
        with patch.dict(fc.os.environ, {'TICKETMASTER_API_KEY': 'test', 'TICKSTER_API_KEY': 'private-test-key'}):
            result = fc.refresh(config, old, NOW, ticketmaster_collector=lambda *args: [event('ticketmaster:b')],
                                tickster_collector=lambda *args: (_ for _ in ()).throw(RuntimeError('private-test-key')))
        self.assertEqual(result['sources'][1]['status'], 'error')
        self.assertNotIn('private-test-key', str(result))
        self.assertEqual(set(result['events'][0]['providers']), {'tickster', 'ticketmaster'})

    def test_venue_doors_and_show_are_not_confused(self):
        raw = {'name': 'Amon Amarth', 'startDate': '2026-10-24T17:30:00+02:00', 'performer': {'name': 'Amon Amarth'}}
        page = fc.Page('<p>Entréer öppnar <b>17:30</b></p><p>Showstart <b>18:30</b></p>')
        result = fc.normalize_venue_event(raw, page, 'https://example.com/gig', SOURCE, NOW)
        self.assertEqual((result['localTime'], result['timeKind'], result['dateTime']), ('18:30', 'start', '2026-10-24T16:30:00+00:00'))

    def test_date_only_stays_without_time_or_utc_instant(self):
        result = fc.normalize_venue_event({'name': 'Gig', 'startDate': '2026-10-24'}, fc.Page(''), 'https://example.com/gig', SOURCE, NOW)
        self.assertIsNone(result['localTime'])
        self.assertIsNone(result['dateTime'])

    def test_absent_coordinates_are_not_zero(self):
        raw = {'id': '1', 'name': 'Gig', 'url': 'https://example.com/gig', 'dates': {'start': {'dateTBA': True, 'timeTBA': True}}}
        result = fc.normalize_ticketmaster(raw, NOW)
        self.assertIsNone(result['localDate'])
        self.assertIsNone(result['localTime'])
        self.assertIsNone(result['venue']['lat'])
        self.assertIsNone(fc.number_or_none('NaN', 90))

    def test_duplicate_provider_ids_and_cross_source_performance(self):
        a, b = event(), event('ticketmaster:1')
        result = fc.deduplicate([a, a, b])
        self.assertEqual(len(result), 1)
        self.assertEqual(set(result[0]['sourceIds']), {'venue:a', 'ticketmaster:1'})

    def test_distinct_nights_and_products_are_preserved(self):
        self.assertEqual(len(fc.deduplicate([event(), event('venue:b')])), 2)
        self.assertEqual(len(fc.deduplicate([event(), event('other:b', '2026-10-25')])), 2)
        a, b = event(), event('other:b')
        b['timeKind'] = 'doors'
        self.assertEqual(len(fc.deduplicate([a, b])), 2)

    def test_reschedule_keeps_canonical_identity(self):
        old = event()
        old['sourceIds'].append('ticketmaster:1')
        updated = event('ticketmaster:1', '2026-11-10')
        result = fc.deduplicate([updated], [old])
        self.assertEqual((result[0]['id'], result[0]['localDate']), ('venue:a', '2026-11-10'))

    def test_fresh_record_replaces_retained_fields(self):
        old = event()
        old['sourceIds'].append('ticketmaster:1')
        old['lastVerifiedAt'] = '2026-09-06T12:00:00+00:00'
        fresh = event('ticketmaster:1', '2026-11-10')
        result = fc.deduplicate([old, fresh], [old])
        self.assertEqual(result[0]['localDate'], '2026-11-10')

    def test_ticketmaster_splits_large_queries(self):
        calls = []
        def get(url):
            from urllib.parse import parse_qs, urlparse
            import json
            params = parse_qs(urlparse(url).query)
            calls.append(params)
            total = 1500 if len(calls) == 1 else 0
            return json.dumps({'page': {'totalElements': total, 'totalPages': 0}})
        result = fc.collect_ticketmaster({'cities': ['Stockholm'], 'horizonDays': 2}, 'test-key', NOW, get=get)
        self.assertEqual(result, [])
        self.assertEqual(len(calls), 5)  # Parent, two halves, unknown-date flags.
        self.assertEqual(calls[-1]['includeTBD'], ['only'])

    def test_failure_preserves_recent_records_and_marks_partial(self):
        old = {'events': [event()], 'sources': [{'id': 'venue', 'lastSuccess': NOW}]}
        config = {'venueSources': [SOURCE], 'cities': ['Stockholm'], 'horizonDays': 365}
        def fail(*args):
            raise RuntimeError('secret-key-must-not-appear')
        with patch.dict(fc.os.environ, {'TICKETMASTER_API_KEY': 'test'}):
            result = fc.refresh(config, old, NOW, fail, lambda *args: [])
        self.assertEqual(len(result['events']), 1)
        self.assertEqual(result['sources'][0]['status'], 'error')
        self.assertNotIn('secret-key', str(result))

    def test_total_failure_does_not_generate_replacement(self):
        def fail(*args):
            raise RuntimeError('unavailable')
        with patch.dict(fc.os.environ, {'TICKETMASTER_API_KEY': ''}):
            with self.assertRaises(RuntimeError):
                fc.refresh({'venueSources': [SOURCE]}, {}, NOW, fail)

    def test_calendar_schema_change_is_not_a_successful_empty_feed(self):
        source = {**SOURCE, 'indexUrl': 'https://example.com/gigs/', 'eventPrefix': 'https://example.com/gigs/'}
        with self.assertRaises(ValueError):
            fc.collect_venue(source, NOW, get=lambda url: '<p>Broken calendar</p>')

    def test_validation_rejects_unsafe_urls_and_impossible_dates(self):
        for field, value in [('url', 'javascript:alert(1)'), ('localDate', '2026-02-30')]:
            raw = event()
            raw[field] = value
            with self.assertRaises(ValueError):
                fc.validate([raw])


if __name__ == '__main__':
    unittest.main()
