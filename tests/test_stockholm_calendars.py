"""Calendar regressions based on the public venue markup observed in September 2026."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import fetch_concerts as fc

NOW = '2026-09-09T00:00:00+00:00'
VENUE = {'name': 'Small room', 'city': 'Stockholm', 'lat': 59.3, 'lon': 18.08}
LIVET = {'id': 'kollektivet_livet', 'adapter': 'kollektivet_livet', 'indexUrl': 'https://venue.example/calendar/',
         'eventPrefix': 'https://venue.example/event/', 'venue': VENUE}


def livet_card(slug='punk', day='2026-10-25 19:00:00'):
    return f'<div class="event"><time datetime="{day}">Tomorrow</time><h3><a href="https://venue.example/event/{slug}/">Band</a></h3></div>'


def livet_info(title='Band + Support', category='Punk, Konsert', doors='19:00', price='450 - 470 kr'):
    return f'''<div class="info-box info-box-event"><h1>{title}</h1><table class="event-info">
      <tr><td class="key">Vad</td><td class="value">{category}</td></tr>
      <tr><td class="key">Dörrar</td><td class="value">{doors}</td></tr>
      <tr><td class="key">Pris</td><td class="value">{price}</td></tr></table>
      <a class="buy-ticket" href="https://tickets.example/gig">Buy</a></div>'''


def slakt_page(title='Band | Hus 7', description='Band: Band<br>Insläpp: 19.00<br>Live från: ca kl 20.00. Ett punkband.', date='torsdag okt 22, 2026', time='19:00', room='Hus 7'):
    return f'''<script type="application/ld+json">{{"@type":"BlogPosting","datePublished":"2020-01-01"}}</script>
      <div class="datum-s"><p>{date}</p></div><div class="titel-s"><h1>{title}</h1></div>
      <div class="stalle-s"><a>{room}</a></div><div class="ticket-s"><a href="https://tickets.example/band">Ticket</a></div>
      <article>{description}<div class="tid-b">{time}</div></article>'''


class StockholmCalendarTests(unittest.TestCase):
    def test_livet_pagination_genres_duplicate_summary_and_dst(self):
        pages = {
            LIVET['indexUrl']: '<div class="event-list">' + livet_card() + '</div><a href="?offset=12">More</a>',
            LIVET['indexUrl'] + '?offset=12': '<div class="event-list">' + livet_card('party') + '</div><a href="?offset=24">More</a>',
            LIVET['indexUrl'] + '?offset=24': '<div class="event-list"></div><a href="?offset=36">More</a>',
            LIVET['eventPrefix'] + 'punk/': livet_info() * 2,
            LIVET['eventPrefix'] + 'party/': livet_info(category='Klubb, Punk'),
        }
        events = fc.collect_venue(LIVET, NOW, pages.__getitem__)
        self.assertEqual(len(events), 1)
        gig = events[0]
        self.assertEqual(gig['localDate'], '2026-10-25')
        self.assertEqual(gig['dateTime'], '2026-10-25T18:00:00+00:00')
        self.assertEqual(gig['timeKind'], 'doors')
        self.assertEqual(gig['styles'], ['Punk'])
        self.assertEqual(gig['ticketPrice'], {'amount': 450, 'currency': 'SEK'})
        self.assertEqual(gig['artists'], [])  # A title is not a verified performer list.

    def test_livet_repeated_pages_and_conflicting_summaries_fail(self):
        calendar = '<div class="event-list">' + livet_card() + '</div>'
        for pages in [
            {LIVET['indexUrl']: calendar + '<a href="?offset=12">More</a>', LIVET['indexUrl'] + '?offset=12': calendar},
            {LIVET['indexUrl']: calendar, LIVET['eventPrefix'] + 'punk/': livet_info() + livet_info(doors='20:00')},
            {LIVET['indexUrl']: '<h1>Maintenance</h1>'},
        ]:
            with self.assertRaises(ValueError):
                fc.collect_venue(LIVET, NOW, pages.__getitem__)

    def slakt_source(self):
        return {'id': 'slakthusen', 'adapter': 'slakthusen', 'name': 'Slakthusen', 'indexUrl': 'https://slakt.example/',
                'venues': {'Hus 7': VENUE}, 'stylePatterns': {'Punk': r'\bpunk\w*\b'}}

    def test_slakt_full_event_year_doors_and_concert_filtering(self):
        source = self.slakt_source()
        listing = '<ul id="nm-blog-list">' + ''.join(f'<li><a href="{source["indexUrl"]}{s}/">Gig</a></li>' for s in ['gig', 'wrestling', 'club']) + '</ul>'
        pages = {source['indexUrl']: listing, source['indexUrl'] + 'gig/': slakt_page(),
                 source['indexUrl'] + 'wrestling/': slakt_page(title='STHLM WRESTLING', description='Live wrestling show'),
                 source['indexUrl'] + 'club/': slakt_page(title='DJ night', description='DJs all night')}
        gigs = fc.collect_venue(source, NOW, pages.__getitem__)
        self.assertEqual(len(gigs), 1)
        self.assertEqual(gigs[0]['localDate'], '2026-10-22')
        self.assertEqual(gigs[0]['dateTime'], '2026-10-22T17:00:00+00:00')
        self.assertEqual(gigs[0]['timeKind'], 'doors')
        self.assertEqual(gigs[0]['title'], 'Band')
        self.assertEqual(gigs[0]['styles'], ['Punk'])

    def test_slakt_time_range_unknown_time_and_pagination(self):
        source = self.slakt_source()
        for listed, expected in [('20.00-01.00', '20:00'), ('', None)]:
            pages = {source['indexUrl']: '<ul id="nm-blog-list"><li><a href="https://slakt.example/gig/">Gig</a></li></ul><a href="https://slakt.example/page/2/">More</a>',
                     source['indexUrl'] + 'page/2/': '<ul id="nm-blog-list"></ul>',
                     source['indexUrl'] + 'gig/': slakt_page(description='Konsert med Band', time=listed)}
            gig = fc.collect_venue(source, NOW, pages.__getitem__)[0]
            self.assertEqual(gig['localTime'], expected)
            self.assertEqual(gig['timeKind'], 'listed')
            if expected is None:
                self.assertIsNone(gig['dateTime'])

    def test_one_broken_new_source_retains_recent_records(self):
        source = self.slakt_source()
        old = fc.calendar_event(source, 'https://slakt.example/gig/', 'Band', '2026-10-22', None, 'listed', NOW, venue=VENUE)
        previous = {'sources': [{'id': source['id'], 'lastSuccess': NOW}], 'events': [old]}
        config = {'cities': ['Stockholm'], 'horizonDays': 365, 'venueSources': [source, {**LIVET, 'name': 'Livet'}]}
        def collect(s, now):
            if s['id'] == 'slakthusen':
                raise ValueError('Markup changed')
            return []
        with patch.dict(fc.os.environ, {'TICKETMASTER_API_KEY': '', 'TICKSTER_API_KEY': ''}):
            result = fc.refresh(config, previous, NOW, venue_collector=collect)
        self.assertIn(old['id'], [e['id'] for e in result['events']])
        self.assertEqual(result['sources'][0]['status'], 'error')

    def test_explicit_room_in_title_and_programme_overrides_stale_category(self):
        source = self.slakt_source()
        source['venues']['Slaktkyrkan'] = {**VENUE, 'name': 'Slaktkyrkan'}
        pages = {source['indexUrl']: '<ul id="nm-blog-list"><li><a href="https://slakt.example/gig/">Gig</a></li></ul>',
                 source['indexUrl'] + 'gig/': slakt_page(title='Band | Slaktkyrkan', description='Band: Band. Venue: Slaktkyrkan. Live från: 20.00')}
        gig = fc.collect_venue(source, NOW, pages.__getitem__)[0]
        self.assertEqual(gig['venue']['name'], 'Slaktkyrkan')
        self.assertEqual(gig['title'], 'Band')


if __name__ == '__main__':
    unittest.main()
