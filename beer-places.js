/* Additive beer-place data. The original curated list remains in script.js. */
(function (root) {
    'use strict';
    const hours = (sun, mon, tue, wed, thu, fri, sat) => ({
        0: sun, 1: mon, 2: tue, 3: wed, 4: thu, 5: fri, 6: sat
    });
    root.MagicCompassBeerPlaces = Object.freeze([
        // Göteborg
        { name: 'Ölrepubliken', city: 'Göteborg', lat: 57.7076991, lon: 11.9616841,
            hours: hours(null, [15, 23], [15, 23], [15, 23], [15, 23], [11, 0.5], [13, 24]),
            sourceUrl: 'https://www.olrepubliken.se/', verifiedOn: '2026-09-15' },
        { name: 'Station Linné', city: 'Göteborg', lat: 57.690799, lon: 11.9525728,
            hours: hours([12, 22], [15, 22], [15, 22], [15, 23], [15, 23], [15, 24], [12, 24]),
            sourceUrl: 'https://stationlinne.com/', verifiedOn: '2026-09-15' },
        { name: 'Zamenhof', city: 'Göteborg', lat: 57.7021762, lon: 11.9561328,
            hours: hours(null, [11.5, 1], [11.5, 1], [11.5, 1], [11.5, 1], [11.5, 1], [12, 1]),
            sourceUrl: 'https://www.zamenhof.se/', verifiedOn: '2026-09-15' },
        { name: 'Victoria Bar', city: 'Göteborg', lat: 57.6983001, lon: 11.9662558,
            hours: hours([13, 1], [11, 1], [11, 1], [11, 1], [11, 1], [11, 1], [12, 1]),
            sourceUrl: 'https://www.victoriabar.se/', verifiedOn: '2026-09-15' },
        { name: 'The Old Beefeater Inn Göteborg', city: 'Göteborg', lat: 57.697472, lon: 11.950725,
            hours: hours([11, 24], [11, 24], [11, 24], [11, 24], [11, 24], [11, 1], [11, 1]),
            sourceUrl: 'https://beefeaterinn.se/', verifiedOn: '2026-09-15' },

        // Malmö
        { name: 'Malmö Brewing Co', city: 'Malmö', lat: 55.5934844, lon: 13.0074615,
            hours: hours([16, 24], [16, 24], [16, 24], [16, 24], [16, 24], [16, 3], [12, 3]),
            sourceUrl: 'https://malmobrewing.com/', verifiedOn: '2026-09-15' },
        { name: 'Bärstronomi', city: 'Malmö', lat: 55.6013421, lon: 12.9999951,
            hours: hours([12, 20], [11.5, 22], [11.5, 22], [11.5, 22], [11.5, 22], [11.5, 24], [12, 24]),
            sourceUrl: 'https://hylliebryggeri.se/barstronomi', verifiedOn: '2026-09-15' },
        { name: "Sir Toby's", city: 'Malmö', lat: 55.5979581, lon: 12.9996995,
            hours: hours([13, 21], [17, 23], [17, 23], [17, 23], [17, 23], [17, 24], [13, 24]),
            sourceUrl: 'https://sirtobys.se/', verifiedOn: '2026-09-15' },
        { name: 'Ukrainian Beer Bar', city: 'Malmö', lat: 55.6000964, lon: 13.0079167,
            hours: hours(null, null, [16, 22], [16, 22], [16, 22], [16, 23], [14, 23]),
            sourceUrl: 'https://ukrainianbeerbar.com/', verifiedOn: '2026-09-15' },
        { name: 'Syltan', city: 'Malmö', lat: 55.6081429, lon: 13.014202,
            hours: hours(null, null, [17, 24], [17, 24], [17, 24], [15, 1], [15, 1]),
            sourceUrl: 'https://www.syltan.com/', verifiedOn: '2026-09-15' },

        // Uppsala
        { name: 'Puben Uppsala', city: 'Uppsala', lat: 59.8603706, lon: 17.6345983,
            hours: hours([16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3]),
            sourceUrl: 'https://pubenuppsala.se/', verifiedOn: '2026-09-15' },
        { name: "Charlie's Bar Uppsala", city: 'Uppsala', lat: 59.8609096, lon: 17.6281267,
            hours: hours([13, 1], [15, 1], [15, 1], [15, 1], [15, 1], [15, 1], [13, 1]),
            sourceUrl: 'https://www.charlies-uppsala.se/', verifiedOn: '2026-09-15' },
        { name: 'Bierhuis', city: 'Uppsala', lat: 59.8617392, lon: 17.6376233,
            hours: hours([17, 22], [17, 22], [17, 23], [17, 23], [17, 23], [16, 24], [13, 24]),
            sourceUrl: 'https://www.bierhuis.se/', verifiedOn: '2026-09-15' },
        { name: 'The Bishops Arms Bäverns gränd', city: 'Uppsala', lat: 59.8571014, lon: 17.6480034,
            hours: hours([15, 22], [16, 23], [16, 23], [16, 23], [16, 23], [13, 1], [11, 1]),
            sourceUrl: 'https://www.elite.se/en/restaurants/uppsala/the-bishops-arms-baverns-grand/', verifiedOn: '2026-09-15' },
        { name: 'Systembolaget Dragarbrunnsgatan', city: 'Uppsala', lat: 59.8584369, lon: 17.6419567,
            hours: hours(null, [10, 19], [10, 19], [10, 19], [10, 19], [10, 19], [10, 15]),
            sourceUrl: 'https://www.systembolaget.se/butiker-ombud/butik/uppsala-lan/uppsala/dragarbrunnsgatan-48-a-0302/', verifiedOn: '2026-09-15' },

        // Skövde. "Sent" is not guessed; only explicitly published closing times are used.
        { name: "Mike's Pub", city: 'Skövde', lat: 58.389864, lon: 13.8476735,
            hours: hours(null, null, null, [16, 2], [16, 2], [14, 2], [14, 2]),
            sourceUrl: 'https://www.mikespub.se/', verifiedOn: '2026-09-15' },
        { name: 'Mummel Mat & Malt', city: 'Skövde', lat: 58.3895285, lon: 13.8478236,
            hours: hours([13, 21], [11.5, 22], [11.5, 22], [11.5, 23], [11.5, 23], [11.5, 2], [13, 2]),
            sourceUrl: 'https://mummelskovde.se/', verifiedOn: '2026-09-15' },
        { name: "Sonya's Bar", city: 'Skövde', lat: 58.3898801, lon: 13.8464005,
            hours: hours(null, null, null, null, null, [17, 1], [17, 1]),
            sourceUrl: 'https://www.sonyasbar.se/', verifiedOn: '2026-09-15' },
        { name: 'Kappa Bar Skövde', city: 'Skövde', lat: 58.3896498, lon: 13.8449416,
            hours: hours(null, null, [17, 23], [17, 23], [17, 23], [16, 1], [16, 1]),
            sourceUrl: 'https://kappabar.se/skovde/', verifiedOn: '2026-09-15' },
        { name: 'Systembolaget Commerce', city: 'Skövde', lat: 58.3904444, lon: 13.8451916,
            hours: hours(null, [10, 19], [10, 19], [10, 19], [10, 19], [10, 19], [10, 15]),
            sourceUrl: 'https://www.systembolaget.se/butiker-ombud/', verifiedOn: '2026-09-15' },

        // Falköping
        { name: 'La Mano', city: 'Falköping', lat: 58.1677761, lon: 13.5537409,
            hours: hours(null, [17, 22], [17, 22], [17, 22], [17, 22], [17, 2], [12, 2]),
            sourceUrl: 'https://www.restauranglamano.se/', verifiedOn: '2026-09-15' },
        { name: 'Bryggeri Nya Victoria', city: 'Falköping', lat: 58.1576014, lon: 13.5384522,
            hours: hours(null, null, null, null, null, [17, 21], null),
            sourceUrl: 'https://nyavictoria.se/', verifiedOn: '2026-09-15' },
        { name: 'Piccolo Italiano', city: 'Falköping', lat: 58.1628938, lon: 13.5549559,
            hours: hours([12, 22], [11, 21], [11, 21], [11, 21], [11, 21], [10, 23], [12, 23]),
            sourceUrl: 'https://piccoloitaliano.com/', verifiedOn: '2026-09-15' },
        { name: 'Falbygdens Osteria', city: 'Falköping', lat: 58.166913, lon: 13.5343206,
            hours: hours([11, 16], [11.5, 17], [11.5, 17], [11.5, 17], [11.5, 17], [11.5, 17], [10, 16]),
            sourceUrl: 'https://falbygdensosteria.se/oppettider/', verifiedOn: '2026-09-15' },
        { name: 'Systembolaget Ålleberg Center', city: 'Falköping', lat: 58.1522134, lon: 13.5604158,
            hours: hours(null, [10, 19], [10, 19], [10, 19], [10, 19], [10, 19], [10, 15]),
            sourceUrl: 'https://www.systembolaget.se/butiker-ombud/', verifiedOn: '2026-09-15' }
    ]);
})(typeof window !== 'undefined' ? window : globalThis);
