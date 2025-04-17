// --- DOM Elements ---
const startButton = document.getElementById('startCompass');
const compassNeedle = document.getElementById('compassNeedle');
const distanceText = document.getElementById('distanceText');
const statusText = document.getElementById('statusText');
const hoursText = document.getElementById('hoursText');

// --- Configuration ---
const standardSystemet = { 
    0: null,     // sun
    1: [10, 19], // mon 
    2: [10, 19], 
    3: [10, 19], 
    4: [10, 19], 
    5: [10, 19], 
    6: [10, 15] };
const extendedSystemet = { 
    0: null,     // sun
    1: [10, 20], // mon
    2: [10, 20], 
    3: [10, 20], 
    4: [10, 20], 
    5: [10, 20], 
    6: [10, 15] };

const beerShops = [
    // === SÖDERORT / SOUTH ===
    { name: "Systembolaget Huddinge C", lat: 59.236300194867724, lon: 17.98243249516459, hours: standardSystemet },
    {
        name: "Steakhouse Huddinge",
        lat: 59.236403519114646,
        lon: 17.980697895981507,
        hours: { 0: [11, 21], 1: [10, 22], 2: [10, 22], 3: [10, 22], 4: [10, 22], 5: [10, 24], 6: [11, 24] }
    },
    { name: "Systembolaget Kungens Kurva", lat: 59.27069281369475, lon: 17.921997461321006, hours: standardSystemet }, // Example: Using mall hours
    { name: "Systembolaget Skärholmen", lat: 59.2758, lon: 17.9075, hours: standardSystemet }, // Example: Using mall hours
    { name: "Systembolaget Liljeholmen", lat: 59.30974291775931, lon: 18.022171971540033, hours: standardSystemet }, // Example: Using mall hours
    { name: "Systembolaget Tumba C", lat: 59.2010, lon: 17.8280, hours: standardSystemet },
    { name: "Systembolaget Globen Shopping", lat: 59.2935, lon: 18.0830, hours: standardSystemet }, // Example: Using mall hours
    { name: "Systembolaget Gullmarsplan", lat: 59.3010, lon: 18.0780, hours: standardSystemet },
    { name: "Systembolaget Årsta Torg", lat: 59.2960, lon: 18.0400, hours: standardSystemet },
    { name: "Systembolaget Älvsjö", lat: 59.2770, lon: 18.0080, hours: standardSystemet },
    { name: "Systembolaget Farsta C", lat: 59.2440, lon: 18.0890, hours: standardSystemet }, // Example: Using mall hours
    { name: "Systembolaget Hagsätra", lat: 59.2550, lon: 18.0350, hours: standardSystemet },
    { name: "Systembolaget Högdalen", lat: 59.2640, lon: 18.0280, hours: standardSystemet },
    { name: "Systembolaget Skarpnäck", lat: 59.2700, lon: 18.1350, hours: standardSystemet },
    { name: "Systembolaget Hammarby Sjöstad", lat: 59.3050, lon: 18.1060, hours: standardSystemet },
    { name: "Systembolaget Fruängen", lat: 59.2820, lon: 17.9740, hours: standardSystemet },
    { name: "Systembolaget Telefonplan", lat: 59.3005, lon: 18.0190, hours: standardSystemet },
    { name: "Systembolaget Tyresö C", lat: 59.2400, lon: 18.2250, hours: standardSystemet },
    { name: "Systembolaget Handen (Haninge C)", lat: 59.1700, lon: 18.1380, hours: standardSystemet }, 
    { name: "Systembolaget Vårberg", lat: 59.2820, lon: 17.8880, hours: standardSystemet },
    { name: "Systembolaget Hallunda", lat: 59.2580, lon: 17.8420, hours: standardSystemet },
    { name: "Systembolaget Skogås", lat: 59.2250, lon: 18.1250, hours: standardSystemet },
    { name: "Systembolaget Södertälje C", lat: 59.1950, lon: 17.6250, hours: standardSystemet }, 

    // === CENTRAL STOCKHOLM ===
    { name: "Systembolaget Hötorget", lat: 59.3338, lon: 18.0645, hours: standardSystemet }, 
    { name: "Systembolaget Regeringsgatan 44", lat: 59.3320, lon: 18.0700, hours: standardSystemet }, 
    { name: "Systembolaget Drottninggatan 63", lat: 59.3360, lon: 18.0610, hours: standardSystemet }, 
    { name: "Systembolaget Vasagatan 11 (Centralen)", lat: 59.3310, lon: 18.0580, hours: standardSystemet }, 
    { name: "Systembolaget Rosenlundsgatan (Söder)", lat: 59.3165, lon: 18.0580, hours: standardSystemet },
    { name: "Systembolaget NK (Hamngatan)", lat: 59.3325, lon: 18.0725, hours: standardSystemet }, 
    { name: "Systembolaget Sturegallerian", lat: 59.3365, lon: 18.0730, hours: standardSystemet }, 
    { name: "Systembolaget Östermalmstorg", lat: 59.3350, lon: 18.0780, hours: standardSystemet },
    { name: "Systembolaget Medborgarplatsen", lat: 59.3175, lon: 18.0720, hours: standardSystemet },
    { name: "Systembolaget Ringen C (Skanstull)", lat: 59.3120, lon: 18.0740, hours: standardSystemet }, 
    { name: "Systembolaget Folkungagatan 98", lat: 59.3150, lon: 18.0810, hours: standardSystemet },
    { name: "Systembolaget Hornstull", lat: 59.3170, lon: 18.0360, hours: standardSystemet },
    { name: "Systembolaget Fridhemsplan", lat: 59.334914041394455, lon: 18.03016065483061, hours: standardSystemet },
    { name: "Systembolaget Odenplan", lat: 59.3430, lon: 18.0500, hours: standardSystemet },
    { name: "Systembolaget Fältöversten (Karlaplan)", lat: 59.3400, lon: 18.0950, hours: standardSystemet }, 
    { name: "Systembolaget Fleminggatan 58", lat: 59.3355, lon: 18.0430, hours: standardSystemet },
    {
        name: "Teodoras",
        lat: 59.3357221671323,
        lon: 18.033179957356698,
        hours: { 0: [13, 3], 1: [15, 3], 2: [15, 3], 3: [15, 3], 4: [15, 3], 5: [15, 3], 6: [13, 3] }
    },
    {
        name: "Dovas",
        lat: 59.33558295461416,
        lon: 18.03311608644089,
        hours: { 0: [11, 1], 1: [11, 1], 2: [11, 1], 3: [11, 1], 4: [11, 1], 5: [11, 1], 6: [11, 1] }
    },
    {
        name: "Bistro Fridhem",
        lat: 59.333315806954126,
        lon: 18.029850969674058,
        hours: { 0: [13, 1], 1: [13, 1], 2: [13, 1], 3: [13, 1], 4: [13, 1], 5: [13, 1], 6: [13, 1] }
    },
    {
        name: "Gröne Jägarn",
        lat: 59.31343881976508,
        lon: 18.073600117059083,
        hours: { 0: [12, 1], 1: [12, 1], 2: [12, 1], 3: [12, 1], 4: [12, 1], 5: [12, 1], 6: [12, 1] }
    },
    {
        name: "The Central Bar",
        lat: 59.31123236268416,
        lon: 18.0745058824433,
        hours: { 0: [11, 1], 1: [11, 1], 2: [11, 1], 3: [11, 1], 4: [11, 1], 5: [11, 1], 6: [11, 1] }
    },
    {
        name: "Patricia Restaurang & Nattklubb",
        lat: 59.321411566345226,
        lon: 18.05253223668301,
        hours: { 0: [22, 5], 1: null, 2: null, 3: null, 4: null, 5: [20, 5], 6: [20, 5] }
    },
    {
        name: "Pub Anchor",
        lat: 59.341278037258355,
        lon: 18.058500580773348,
        hours: { 0: [13, 3], 1: [13, 3], 2: [13, 3], 3: [13, 3], 4: [13, 3], 5: [12, 3], 6: [13, 3] }
    },
    { name: "Systembolaget Garnisonen (Karlavägen)", lat: 59.3370, lon: 18.1050, hours: standardSystemet },

    // === VÄSTERORT / WEST + SOLNA / SUNDBYBERG ===
    { name: "Systembolaget Vällingby C", lat: 59.3650, lon: 17.8750, hours: standardSystemet }, 
    { name: "Systembolaget Brommaplan", lat: 59.3370, lon: 17.9360, hours: standardSystemet },
    { name: "Systembolaget Alvik", lat: 59.3330, lon: 17.9800, hours: standardSystemet },
    { name: "Systembolaget Spånga", lat: 59.3870, lon: 17.9080, hours: standardSystemet },
    { name: "Systembolaget Hässelby Gård", lat: 59.3760, lon: 17.8500, hours: standardSystemet },
    { name: "Systembolaget Akalla", lat: 59.4160, lon: 17.9330, hours: standardSystemet },
    {
        name: "Pub Lord & AlDente",
        lat: 59.401970853764105,
        lon: 17.94364915167063,
        hours: { 0: [11, 23], 1: [11, 23], 2: [11, 23], 3: [11, 23], 4: [11, 23], 5: [11, 0], 6: [11, 0] }
    },    
    { name: "Systembolaget Kista Galleria", lat: 59.4030, lon: 17.9460, hours: standardSystemet }, 
    { name: "Systembolaget Sundbyberg C", lat: 59.361282641195146, lon: 17.96761658614288, hours: standardSystemet },
    { name: "Systembolaget Solna C", lat: 59.3603709947504, lon: 17.999897339919222, hours: standardSystemet }, 
    { name: "Systembolaget Mall of Scandinavia", lat: 59.370194330158704, lon: 18.004843423347644, hours: standardSystemet }, 
    {
        name: "Spisa Pizza Solna",
        lat: 59.38158834903574,
        lon: 18.001108119987467,
        hours: { 0: [12, 21], 1: [11, 21], 2: [11, 21], 3: [11, 21], 4: [11, 21], 5: [11, 21], 6: [12, 21] }
    },
    {
        name: "Veneto",
        lat: 59.381309231723215,
        lon: 17.9944561320891,
        hours: { 0: [12, 21], 1: [11, 21], 2: [11, 21], 3: [11, 21], 4: [11, 21], 5: [11, 21], 6: [12, 21] }
    },
    {
        name: "Basic bar & kök",
        lat: 59.36401813531022,
        lon: 18.01208967251386,
        hours: { 0: [12, 23], 1: [14, 23], 2: [14, 23], 3: [14, 23], 4: [14, 23], 5: [14, 0], 6: [12, 0] }
    },
    {
        name: "Curry Flames",
        lat: 59.3630747852966,
        lon: 18.022514236956372,
        hours: { 0: [17, 21], 1: [11, 21], 2: [11, 21], 3: [11, 21], 4: [11, 21], 5: [11, 22], 6: [17, 22] }
    },
    {
        name: "Tegelbaren",
        lat: 59.363803965676624,
        lon: 18.013583562948757,
        hours: { 0: [12, 2], 1: [13, 2], 2: [13, 2], 3: [13, 2], 4: [13, 2], 5: [13, 2], 6: [12, 2] }
    },
    { name: "Systembolaget Bromma Blocks", lat: 59.35603722291109, lon: 17.95403819710767, hours: standardSystemet }, 
    {
        name: "The Blues Pub",
        lat: 59.36267525599722,
        lon: 17.966726780976334,
        hours: { 0: [15, 1], 1: [16, 1], 2: [16, 1], 3: [16, 1], 4: [16, 1], 5: [15, 1], 6: [15, 1] }
    },
    {
        name: "The Station",
        lat: 59.36133424480804,
        lon: 17.967131923444736,
        hours: { 0: [12, 1], 1: [14, 1], 2: [14, 1], 3: [14, 1], 4: [14, 1], 5: [14, 1], 6: [11, 1] }
    },
    {
        name: "Bistro Berg",
        lat: 59.36165289687524,
        lon: 17.9667554387435,
        hours: { 0: [11, 1], 1: [11, 1], 2: [11, 1], 3: [11, 1], 4: [11, 1], 5: [11, 1], 6: [11, 1] }
    },
    {
        name: "NYC Burger Bromma",
        lat: 59.353590528468665,
        lon: 17.957536910631937,
        hours: { 0: null, 1: [11, 15], 2: [11, 15], 3: [11, 15], 4: [11, 15], 5: [11, 15], 6: null }
    },
    { name: "Systembolaget Jakobsberg (Järfälla)", lat: 59.4220, lon: 17.8350, hours: standardSystemet },
    { name: "Systembolaget Ekerö C", lat: 59.2900, lon: 17.7950, hours: standardSystemet },
    { name: "Systembolaget Barkarby Handelsplats", lat: 59.4070, lon: 17.8550, hours: standardSystemet },
    { name: "Systembolaget Torsplan", lat: 59.346396781223454, lon: 18.03327258104888, hours: extendedSystemet },

    // === NORRORT / NORTH ===
    { name: "Systembolaget Täby Centrum", lat: 59.4430, lon: 18.0700, hours: standardSystemet }, 
    { name: "Systembolaget Mörby C", lat: 59.3980, lon: 18.0550, hours: standardSystemet },
    { name: "Systembolaget Sollentuna C", lat: 59.4280, lon: 17.9480, hours: standardSystemet },
    {
        name: "Hamilton Sollentuna",
        lat: 59.429078263279685,
        lon: 17.950376315626713,
        hours: { 0: [12, 0], 1: [11, 0], 2: [11, 0], 3: [11, 0], 4: [11, 0], 5: [11, 1], 6: [12, 1] }
    },
    {
        name: "Paddy's Pub",
        lat: 59.428882173792154,
        lon: 17.948595278849236,
        hours: { 0: [14, 1], 1: [16, 23], 2: [16, 1], 3: [16, 1], 4: [16, 1], 5: [14, 1], 6: [14, 1] }
    },
    {
        name: "Restaurang som hemma",
        lat: 59.431567691648944,
        lon: 17.942858160553268,
        hours: { 0: [12, 20], 1: [11, 20], 2: [10, 21], 3: [10, 21], 4: [10, 21], 5: [12, 20], 6: null }
    },
    {
        name: "Hägges Kök & Bar",
        lat: 59.4455204605716,
        lon: 17.93287492364029,
        hours: { 0: [12, 22], 1: [10, 22], 2: [10, 22], 3: [10, 22], 4: [10, 22], 5: [10, 1], 6: [12, 1] }
    }, 
    { name: "Systembolaget Väsby Centrum", lat: 59.5170, lon: 17.9250, hours: standardSystemet }, 
    { name: "Systembolaget Arninge", lat: 59.4520, lon: 18.1250, hours: standardSystemet },
    { name: "Systembolaget Åkersberga C", lat: 59.479694308737685, lon: 18.300274711380194, hours: standardSystemet },
    { name: "Systembolaget Vallentuna C", lat: 59.5330, lon: 18.0800, hours: standardSystemet },
    { name: "Systembolaget Märsta", lat: 59.62121118722028, lon: 17.857465378564434, hours: standardSystemet },
    { name: "Systembolaget Sigtuna", lat: 59.61548401139691, lon: 17.719609162850304, hours: standardSystemet },
    { name: "Systembolaget Norrtälje", lat: 59.757200981639876, lon: 18.700358608072552, hours: standardSystemet },
    { name: "Systembolaget Djursholms Torg", lat: 59.3950, lon: 18.0800, hours: standardSystemet },

    // === NACKA / VÄRMDÖ / EAST + LIDINGÖ ===
    { name: "Systembolaget Nacka Forum", lat: 59.3090, lon: 18.1650, hours: standardSystemet }, 
    { name: "Systembolaget Orminge C", lat: 59.3160, lon: 18.2480, hours: standardSystemet },
    { name: "Systembolaget Gustavsberg C", lat: 59.3260, lon: 18.3880, hours: standardSystemet },
    { name: "Systembolaget Sickla", lat: 59.3070, lon: 18.1180, hours: standardSystemet }, 
    { name: "Systembolaget Lidingö C", lat: 59.3670, lon: 18.1420, hours: standardSystemet },
    { name: "Systembolaget Saltsjöbaden", lat: 59.2840, lon: 18.2500, hours: standardSystemet },

    // === UPPSALA ===
    { name: "Systembolaget Boländerna Uppsala", lat: 59.847308235139515, lon: 17.687312396781717, hours: standardSystemet }
];


// --- State Variables ---
let currentPosition = null;
let currentHeading = null;
let nearestShop = null;
let watchId = null; // To store the watchPosition ID
let hoursIntervalId = null; // To store the interval timer ID

// --- Helper Functions ---

// Calculate distance between two coordinates in kilometers
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Calculate initial bearing between two coordinates in degrees
function getBearingFromLatLon(lat1, lon1, lat2, lon2) {
    const φ1 = deg2rad(lat1);
    const φ2 = deg2rad(lat2);
    const λ1 = deg2rad(lon1);
    const λ2 = deg2rad(lon2);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    let brng = Math.atan2(y, x);
    brng = rad2deg(brng);
    return (brng + 360) % 360; // Normalize to 0-360 degrees
}

 function rad2deg(rad) {
    return rad * (180 / Math.PI);
 }

// --- Core Logic Functions ---

/**
 * Finds the target shop based on priority:
 * 1. Nearest shop that is currently open.
 * 2. If none open, the nearest shop among those that will open soonest.
 * @returns {object|null} The target shop object (with distance and statusInfo) or null if none found.
 */
function findTargetShop() {
    if (!currentPosition) return null; // Need user's location first

    const now = new Date();
    let openShops = [];
    let closedShopsInfo = []; // To store info about closed shops for fallback

    // Step 1: Iterate, calculate distance, and get status for all shops
    beerShops.forEach(shop => {
        // Basic check if shop has essential data
        if (shop.lat === undefined || shop.lon === undefined || !shop.hours) {
            console.warn(`Shop missing coordinates or hours: ${shop.name}`);
            return; // Skip this shop
        }

        const distance = getDistanceFromLatLonInKm(
            currentPosition.coords.latitude,
            currentPosition.coords.longitude,
            shop.lat,
            shop.lon
        );

        const statusInfo = getShopStatus(now, shop.hours);

        // Store calculated info temporarily (doesn't modify original beerShops array)
        const shopWithInfo = { ...shop, distance: distance, statusInfo: statusInfo };

        if (statusInfo && statusInfo.status === 'open') {
            openShops.push(shopWithInfo);
        } else if (statusInfo && statusInfo.status === 'closed' && statusInfo.eventType === 'opens') {
             // Only consider closed shops that will open eventually
             closedShopsInfo.push(shopWithInfo);
        }
        // Ignore shops with status errors or that never open
    });

    // Step 2: Prioritize nearest open shop
    if (openShops.length > 0) {
        console.log("Found open shops:", openShops.length);
        openShops.sort((a, b) => a.distance - b.distance); // Sort open shops by distance
        return openShops[0]; // Return the nearest open one
    }

    // Step 3: If no open shops, find the nearest that opens soonest
    if (closedShopsInfo.length > 0) {
        console.log("No open shops. Checking closed shops:", closedShopsInfo.length);
        // Find the minimum next opening time
        let soonestOpenTime = Infinity;
        closedShopsInfo.forEach(shop => {
            if (shop.statusInfo.nextEventTime.getTime() < soonestOpenTime) {
                soonestOpenTime = shop.statusInfo.nextEventTime.getTime();
            }
        });

         // Filter for shops opening at that soonest time
         const shopsOpeningSoonest = closedShopsInfo.filter(shop =>
            shop.statusInfo.nextEventTime.getTime() === soonestOpenTime
         );

         if (shopsOpeningSoonest.length > 0) {
             // Among those opening soonest, find the nearest one
             shopsOpeningSoonest.sort((a, b) => a.distance - b.distance);
             console.log("Targeting nearest shop opening soonest:", shopsOpeningSoonest[0].name);
             return shopsOpeningSoonest[0];
         }
    }

    // Step 4: Fallback - no open shops found, and no closed shops found opening soon
    console.log("Could not find any open or soon-to-open shops.");
    return null; // Or return geographically nearest as absolute fallback? Null is clearer.
}

/**
 * Determines if the shop is open/closed and when the next event (open/close) occurs.
 * Handles opening hours crossing midnight.
 * @param {Date} now The current date and time.
 * @param {object} shopHours The opening hours object for the specific shop.
 * @returns {object|null} Object with status, eventType, nextEventTime, or null on error.
 */
function getShopStatus(now, shopHours) {
    // Add safety check for missing hours data
    if (!shopHours) {
        console.error("Shop hours data is missing or invalid for status check.");
        return null;
    }

    const currentDay = now.getDay(); // 0=Sun, 6=Sat
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    let status = 'closed';
    let eventType = 'opens';
    let nextEventTime = null;

    // --- Check yesterday's hours first for overnight opening ---
    const yesterdayDay = (currentDay + 6) % 7; // Day before today
    const yesterdayHours = shopHours[yesterdayDay];
    if (yesterdayHours && Array.isArray(yesterdayHours) && yesterdayHours.length === 2) {
        const yOpen = yesterdayHours[0];
        const yClose = yesterdayHours[1];
        // Check if yesterday's hours crossed midnight (close hour < open hour)
        if (yClose < yOpen) {
            const yCloseTimeInMinutes = yClose * 60;
            // Are we currently *before* yesterday's closing time (which occurs today)?
            if (currentTimeInMinutes < yCloseTimeInMinutes) {
                // Currently open from yesterday!
                status = 'open';
                eventType = 'closes';
                nextEventTime = new Date(now);
                nextEventTime.setHours(yClose, 0, 0, 0); // Closing time is today at yClose hour
                // We've determined the status, no need to check today's opening further for this case
            }
        }
    }

    // --- If not open from yesterday, check today's schedule ---
    if (status === 'closed') { // Only proceed if not already marked open from yesterday
        const todayHours = shopHours[currentDay];
        if (todayHours && Array.isArray(todayHours) && todayHours.length === 2) {
            const openTime = todayHours[0];
            const closeTime = todayHours[1];
            const openTimeInMinutes = openTime * 60;
            const closeTimeInMinutes = closeTime * 60;

            if (closeTime > openTime) { // Normal case: closes same day
                if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
                    // Currently Open, closes later today
                    status = 'open';
                    eventType = 'closes';
                    nextEventTime = new Date(now);
                    nextEventTime.setHours(closeTime, 0, 0, 0);
                } else if (currentTimeInMinutes < openTimeInMinutes) {
                    // Closed, opens later today
                    status = 'closed';
                    eventType = 'opens';
                    nextEventTime = new Date(now);
                    nextEventTime.setHours(openTime, 0, 0, 0);
                }
                // else: closed past closing time today, will be handled by 'find next opening' logic below

            } else { // Special case: closes after midnight (closeTime < openTime)
                if (currentTimeInMinutes >= openTimeInMinutes) {
                    // Currently Open, closes tomorrow morning
                    status = 'open';
                    eventType = 'closes';
                    nextEventTime = new Date(now);
                    // Set date to tomorrow
                    nextEventTime.setDate(now.getDate() + 1);
                    nextEventTime.setHours(closeTime, 0, 0, 0);
                } else {
                    // Currently closed, before opening time today (but will close tomorrow)
                    status = 'closed';
                    eventType = 'opens';
                    nextEventTime = new Date(now);
                    nextEventTime.setHours(openTime, 0, 0, 0); // Opens later today
                }
            }
        }
        // else: Closed all day today based on todayHours being null or invalid, handled below
    }


    // --- If status is still 'closed' and nextEventTime wasn't set above, find the next opening day/time ---
    if (status === 'closed' && !nextEventTime) {
         let nextDay = currentDay;
         let daysToAdd = 0;
         let attempts = 0; // Safety break
         let nextOpeningHours = null;

         // Start search from tomorrow if we determined we are past closing time today
         const todayHoursCheck = shopHours[currentDay];
         if (todayHoursCheck && Array.isArray(todayHoursCheck) && todayHoursCheck.length === 2 &&
             todayHoursCheck[1] > todayHoursCheck[0] && // Normal closing today
             currentTimeInMinutes >= (todayHoursCheck[1] * 60)) { // And we are past it
                 daysToAdd = 1;
                 nextDay = (currentDay + 1) % 7;
         }
         // Also start search from tomorrow if today is null/invalid and it's the first attempt
         else if (!todayHoursCheck || !Array.isArray(todayHoursCheck) || todayHoursCheck.length !== 2) {
            // No valid hours today, start search from tomorrow
            daysToAdd = 1;
            nextDay = (currentDay + 1) % 7;
         }
         // Otherwise, the loop starts by checking the *next* day relative to the last checked 'nextDay'

         do {
             // If not the first iteration where we might have forced daysToAdd=1, increment day
              if (attempts > 0 || daysToAdd == 0) { // Ensure we advance day after checking 'currentDay' implicitly if needed
                    daysToAdd++;
                    nextDay = (nextDay + 1) % 7;
              }

             nextOpeningHours = shopHours[nextDay];
             attempts++;
              // Ensure we break if we loop all the way around without forcing start from tomorrow
             if (attempts > 7) {
                 console.error("Looped through all days without finding opening hours.");
                 break;
             }
         } while ((!nextOpeningHours || !Array.isArray(nextOpeningHours) || nextOpeningHours.length !== 2) && attempts < 8); // Find next day with VALID hours


         if (attempts < 8 && nextOpeningHours) {
             const nextOpeningHour = nextOpeningHours[0];
             nextEventTime = new Date(now);
             nextEventTime.setDate(now.getDate() + daysToAdd); // Set to the correct future date
             nextEventTime.setHours(nextOpeningHour, 0, 0, 0); // Set to opening time
         } else {
             // Only log error if we didn't find anything after checking 7+ days
              if (attempts >= 7) console.error("Could not find next valid opening day within 7 days.");
             return null;
         }
    }

    // Final checks and return
    if (!nextEventTime) {
        console.error("Logical error: Could not determine next event time at the end.");
        return null;
    }

    return {
        status: status,
        eventType: eventType,
        nextEventTime: nextEventTime
    };
}

/**
 * Formats a time difference in milliseconds into a human-readable string.
 * @param {number} diffMs Time difference in milliseconds.
 * @returns {string} Formatted string e.g., "1 hour 53 minutes".
 */
function formatTimeDifference(diffMs) {
    if (diffMs < 0) diffMs = 0;

    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);

    const minutes = totalMinutes % 60;
    const hours = totalHours % 24;

    let parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    // Refined logic for minutes display
    if (minutes > 0 || (days === 0 && hours === 0)) {
         // Show minutes if > 0 OR if it's the only unit (e.g., less than 1 hour left)
         parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0 && diffMs < 1000) { // If difference is negligible, consider it "Now"
        return "Now";
    }
    if (parts.length === 0) {
        // This might happen if diffMs is very small but not zero, e.g., few seconds
        return "Less than a minute"; // Or "Calculating..."
    }

    return parts.join(' ');
}


// Updates the opening hours display text
function updateOpeningHoursDisplay(shopToDisplay) { // Accept target shop as argument
    const now = new Date();

    // Use the passed shopToDisplay, check if it and its hours exist
    if (shopToDisplay && shopToDisplay.hours) {
        // Use the statusInfo already calculated in findTargetShop if available,
        // otherwise recalculate (recalculation is safer if time passed)
        const statusInfo = shopToDisplay.statusInfo || getShopStatus(now, shopToDisplay.hours);

        if (statusInfo) {
            const diffMs = statusInfo.nextEventTime.getTime() - now.getTime();
            const formattedDiff = formatTimeDifference(diffMs);
            const prefix = statusInfo.status === 'open' ? 'Closes' : 'Opens';
            // Include shop name in the hours text for clarity
            hoursText.textContent = `${shopToDisplay.name} ${prefix.toLowerCase()} in: ${formattedDiff}`;
        } else {
            hoursText.textContent = `Opening hours for ${shopToDisplay.name}: Status unavailable`;
        }
    } else if (shopToDisplay) {
         hoursText.textContent = `Opening hours for ${shopToDisplay.name}: Data unavailable`;
    }
     // else: No target shop determined, message handled in updateDisplay
}

let targetShop = null;

// Main function to update all UI elements
function updateDisplay() {
    targetShop = findTargetShop(); // Find the appropriate target shop

    statusText.textContent = " ";
    hoursText.textContent = " ";
    distanceText.textContent = "Distance: --- km";

    if (targetShop) {
        // Update distance text
        distanceText.textContent = `Distance: ${targetShop.distance.toFixed(2)} km (${targetShop.name})`;

        // Calculate bearing if we have position
        const bearing = getBearingFromLatLon(
            currentPosition.coords.latitude,
            currentPosition.coords.longitude,
            targetShop.lat,
            targetShop.lon
        );

        // Rotate needle if we have heading and bearing
        if (currentHeading !== null) {
             if (typeof currentHeading === 'number') {
                 const rotation = bearing - currentHeading;
                 compassNeedle.style.transform = `rotate(${rotation}deg)`;
                 statusText.textContent = `Heading: ${Math.round(currentHeading)}° | Bearing: ${Math.round(bearing)}°`;
             } else {
                 statusText.textContent = "Invalid heading data";
                 console.warn("currentHeading is not a number:", currentHeading);
             }
        } else {
              statusText.textContent = "Waiting for compass...";
              // Optional: Point needle towards target if no compass data? Requires bearing only.
              // compassNeedle.style.transform = `rotate(${bearing}deg)`; // This points North towards target
        }
        // Update opening hours display using the found targetShop
        updateOpeningHoursDisplay(targetShop); // Pass targetShop to the hours display function
    } else {
          distanceText.textContent = `Distance: --- km`;
          hoursText.textContent = "No open or soon-opening shops found.";
          compassNeedle.style.transform = `rotate(0deg)`;
          if (!currentPosition) {
             statusText.textContent = "Waiting for GPS signal...";
          } else {
             statusText.textContent = "No target found.";
          }
    }
}

// --- Event Handlers ---

function handleLocationUpdate(pos) {
    console.log("Location update:", pos.coords);
    currentPosition = pos;
    updateDisplay(); // Update UI whenever location changes
}

function handleLocationError(err) {
    console.error("Location Error:", err.message, `(Code: ${err.code})`);
    statusText.textContent = `Error getting location: ${err.message}`;
    if (err.code === 1) { // PERMISSION_DENIED
        statusText.textContent = "Location permission denied. Please enable in settings.";
        stopTracking();
    } else if (err.code === 2) { // POSITION_UNAVAILABLE
        statusText.textContent = "Location unavailable. Check signal/settings.";
        // Don't necessarily stop tracking, might become available again
    } else if (err.code === 3) { // TIMEOUT
        statusText.textContent = "Location request timed out.";
    }
}

function handleOrientationUpdate(event) {
    let heading = null;
     // Prefer absolute orientation if available
    if (event.absolute === true && event.alpha !== null) {
        heading = event.alpha;
    } else if (event.webkitCompassHeading !== undefined) {
        heading = event.webkitCompassHeading; // Fallback for older iOS
    } else if (event.alpha !== null) {
        // Use alpha, but be aware it might be relative, not true north
        // depending on the device and browser implementation.
        heading = event.alpha;
        // console.log("Using relative alpha for heading."); // Optional log
    }


    if (typeof heading === 'number') {
          currentHeading = heading;
          // console.log("Heading update:", currentHeading); // Reduce console noise
          updateDisplay(); // Update display when heading changes
    } else if (currentHeading === null) { // Only show error if we never got a heading
        statusText.textContent = "Compass data not available or invalid.";
        console.warn("Received invalid heading data:", event);
    }
}

// Request permissions and start tracking
function requestPermissionsAndStart() {
    statusText.textContent = "Requesting permissions...";

    // Clear previous interval timer if any
    if (hoursIntervalId) {
        clearInterval(hoursIntervalId);
        hoursIntervalId = null;
    }

    // --- Promise-based Permission Flow (Cleaner) ---
    let orientationPromise = Promise.resolve(); // Assume granted if no requestPermission needed

    // 1. Try requesting Device Orientation permission if method exists (iOS 13+)
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        orientationPromise = DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    console.log("Orientation permission granted.");
                    return true; // Indicate success
                } else {
                    console.log("Orientation permission denied.");
                    statusText.textContent = "Compass permission denied.";
                    // Don't throw error, just proceed without compass maybe
                    return false; // Indicate failure
                }
            })
            .catch(error => {
                console.error("Orientation Permission Request Error:", error);
                statusText.textContent = "Error requesting compass permission.";
                return false; // Indicate failure
            });
    }

    // After attempting orientation permission (or immediately if no request needed):
    orientationPromise.then(orientationGranted => {
        if (orientationGranted !== false) { // Proceed if granted or not applicable
            // Add listeners regardless of explicit grant for non-iOS13+ or if requestPermission doesn't exist
            window.addEventListener('deviceorientationabsolute', handleOrientationUpdate, true);
            window.addEventListener('deviceorientation', handleOrientationUpdate, true); // Fallback
            console.log("Orientation listeners added.");
        }

        // 2. Request Geolocation
        startGeolocation();

        // Call initial update *after* starting requests
        updateDisplay();

        // Start the interval timer *after* starting everything
        hoursIntervalId = setInterval(updateDisplay, 60000); // 60000ms = 1 minute

    }); // End of orientationPromise.then
}


function startGeolocation() {
     if (navigator.geolocation) {
        statusText.textContent = "Attempting to get location...";
        // Clear previous watch if any
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
        }
        watchId = navigator.geolocation.watchPosition(
            handleLocationUpdate,
            handleLocationError,
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 20000 // Increased timeout slightly
            }
        );
     } else {
        statusText.textContent = "Geolocation is not supported by this browser.";
        alert("Geolocation is not supported by this browser."); // More prominent alert
     }
}

// Function to stop tracking
function stopTracking() {
     if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log("Stopped location tracking.");
     }
     window.removeEventListener('deviceorientationabsolute', handleOrientationUpdate, true);
     window.removeEventListener('deviceorientation', handleOrientationUpdate, true);
     console.log("Stopped orientation tracking.");

     if (hoursIntervalId !== null) {
        clearInterval(hoursIntervalId);
        hoursIntervalId = null;
        console.log("Stopped hours update interval.");
     }
     // Reset UI elements if desired
     // statusText.textContent = "Tracking stopped.";
     // distanceText.textContent = `Distance: --- km`;
     // hoursText.textContent = "Opening hours: -";
     // currentPosition = null;
     // currentHeading = null;
     // nearestShop = null;
     // compassNeedle.style.transform = `rotate(0deg)`;
}

// --- Initial Setup ---
startButton.addEventListener('click', requestPermissionsAndStart);

// Register the service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { // Register SW after page load
         navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('Service Worker registered with scope:', registration.scope))
            .catch(error => console.error('Service Worker registration failed:', error));
    });
}

// Optional: Add visibility change listener to potentially pause/resume expensive tracking?
// document.addEventListener("visibilitychange", () => {
//   if (document.visibilityState === "hidden") {
//     // Maybe stop watchPosition/orientation listeners? Requires restart logic on visible.
//     // stopTracking(); // Example - careful with state
//   } else {
//     // Restart tracking if needed
//     // if (trackingWasActive) requestPermissionsAndStart();
//   }
// });