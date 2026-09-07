import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import fetch_concerts as fc

NOW = '2026-09-07T12:00:00+00:00'
SOURCE = {'id': 'venue', 'name': 'Venue calendar', 'venue': {'name': 'Hovet', 'city': 'Stockholm', 'lat': 59.29, 'lon': 18.08}}


def event(identifier='venue:a', date='2026-10-24'):
    return {'id': identifier, 'sourceIds': [identifier], 'providers': [identifier.split(':')[0]], 'title': 'Amon Amarth', 'artists': ['Amon Amarth'], 'styles': ['Metal'], 'venue': SOURCE['venue'], 'localDate': date, 'localTime': '18:30', 'timeKind': 'start', 'url': 'https://example.com/gig', 'status': 'scheduled', 'lastVerifiedAt': NOW}


class CollectorTests(unittest.TestCase):
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
