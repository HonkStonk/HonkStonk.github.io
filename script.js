// --- DOM Elements ---
const startButton = document.getElementById('startCompass');
const compassNeedle = document.getElementById('compassNeedle');
const distanceText = document.getElementById('distanceText');
const statusText = document.getElementById('statusText');
const hoursText = document.getElementById('hoursText');

// --- Configuration ---
const beerShops = [
    // Add coordinates for relevant Systembolaget or other shops
    // === SÖDERORT / SOUTH ===
    { name: "Systembolaget Huddinge C", lat: 59.236300194867724, lon: 17.98243249516459 },
    { name: "Systembolaget Kungens Kurva", lat: 59.27069281369475, lon: 17.921997461321006 },
    { name: "Systembolaget Skärholmen", lat: 59.2758, lon: 17.9075 },
    { name: "Systembolaget Liljeholmen", lat: 59.30974291775931, lon: 18.022171971540033 },
    { name: "Systembolaget Tumba C", lat: 59.2010, lon: 17.8280 },
    { name: "Systembolaget Globen Shopping", lat: 59.2935, lon: 18.0830 },
    { name: "Systembolaget Gullmarsplan", lat: 59.3010, lon: 18.0780 },
    { name: "Systembolaget Årsta Torg", lat: 59.2960, lon: 18.0400 }, // Clarified name
    { name: "Systembolaget Älvsjö", lat: 59.2770, lon: 18.0080 },
    { name: "Systembolaget Farsta C", lat: 59.2440, lon: 18.0890 },
    { name: "Systembolaget Hagsätra", lat: 59.2550, lon: 18.0350 },
    { name: "Systembolaget Högdalen", lat: 59.2640, lon: 18.0280 },
    { name: "Systembolaget Skarpnäck", lat: 59.2700, lon: 18.1350 },
    { name: "Systembolaget Hammarby Sjöstad", lat: 59.3050, lon: 18.1060 },
    { name: "Systembolaget Fruängen", lat: 59.2820, lon: 17.9740 },
    { name: "Systembolaget Telefonplan", lat: 59.3005, lon: 18.0190 },
    { name: "Systembolaget Tyresö C", lat: 59.2400, lon: 18.2250 },
    { name: "Systembolaget Handen (Haninge C)", lat: 59.1700, lon: 18.1380 }, // Added
    { name: "Systembolaget Vårberg", lat: 59.2820, lon: 17.8880 }, // Added
    { name: "Systembolaget Hallunda", lat: 59.2580, lon: 17.8420 }, // Added
    { name: "Systembolaget Skogås", lat: 59.2250, lon: 18.1250 }, // Added
    { name: "Systembolaget Södertälje C", lat: 59.1950, lon: 17.6250 }, // Added

    // === CENTRAL STOCKHOLM ===
    { name: "Systembolaget Hötorget", lat: 59.3338, lon: 18.0645 },
    { name: "Systembolaget Regeringsgatan 44", lat: 59.3320, lon: 18.0700 }, // Clarified name
    { name: "Systembolaget Drottninggatan 63", lat: 59.3360, lon: 18.0610 }, // Clarified name
    { name: "Systembolaget Vasagatan 11 (Centralen)", lat: 59.3310, lon: 18.0580 }, // Clarified name
    { name: "Systembolaget Rosenlundsgatan (Söder)", lat: 59.3165, lon: 18.0580 },
    { name: "Systembolaget NK (Hamngatan)", lat: 59.3325, lon: 18.0725 }, // Clarified name
    { name: "Systembolaget Sturegallerian", lat: 59.3365, lon: 18.0730 }, // Clarified name
    { name: "Systembolaget Östermalmstorg", lat: 59.3350, lon: 18.0780 },
    { name: "Systembolaget Medborgarplatsen", lat: 59.3175, lon: 18.0720 },
    { name: "Systembolaget Ringen C (Skanstull)", lat: 59.3120, lon: 18.0740 }, // Clarified name
    { name: "Systembolaget Folkungagatan 98", lat: 59.3150, lon: 18.0810 }, // Clarified name
    { name: "Systembolaget Hornstull", lat: 59.3170, lon: 18.0360 },
    { name: "Systembolaget Fridhemsplan", lat: 59.334914041394455, lon: 18.03016065483061 },
    { name: "Systembolaget Odenplan", lat: 59.3430, lon: 18.0500 }, // Added
    { name: "Systembolaget Fältöversten (Karlaplan)", lat: 59.3400, lon: 18.0950 }, // Added
    { name: "Systembolaget Fleminggatan 58", lat: 59.3355, lon: 18.0430 }, // Added (approx coords)
    { name: "Systembolaget Garnisonen (Karlavägen)", lat: 59.3370, lon: 18.1050 }, // Added (approx coords)

    // === VÄSTERORT / WEST + SOLNA / SUNDBYBERG ===
    { name: "Systembolaget Vällingby C", lat: 59.3650, lon: 17.8750 },
    { name: "Systembolaget Brommaplan", lat: 59.3370, lon: 17.9360 },
    { name: "Systembolaget Alvik", lat: 59.3330, lon: 17.9800 },
    { name: "Systembolaget Spånga", lat: 59.3870, lon: 17.9080 },
    { name: "Systembolaget Hässelby Gård", lat: 59.3760, lon: 17.8500 },
    { name: "Systembolaget Akalla", lat: 59.4160, lon: 17.9330 },
    { name: "Systembolaget Kista Galleria", lat: 59.4030, lon: 17.9460 },
    { name: "Systembolaget Sundbyberg C", lat: 59.361282641195146, lon: 17.96761658614288 },
    { name: "Systembolaget Solna C", lat: 59.3603709947504, lon: 17.999897339919222 },
    { name: "Systembolaget Mall of Scandinavia", lat: 59.370194330158704, lon: 18.004843423347644 },
    { name: "Systembolaget Bromma Blocks", lat: 59.35603722291109, lon: 17.95403819710767 },
    { name: "Systembolaget Jakobsberg (Järfälla)", lat: 59.4220, lon: 17.8350 }, // Added
    { name: "Systembolaget Ekerö C", lat: 59.2900, lon: 17.7950 }, // Added
    { name: "Systembolaget Barkarby Handelsplats", lat: 59.4070, lon: 17.8550 }, // Added

    // === NORRORT / NORTH ===
    { name: "Systembolaget Täby Centrum", lat: 59.4430, lon: 18.0700 }, // Clarified name
    { name: "Systembolaget Mörby C", lat: 59.3980, lon: 18.0550 },
    { name: "Systembolaget Sollentuna C", lat: 59.4280, lon: 17.9480 },
    { name: "Systembolaget Väsby Centrum", lat: 59.5170, lon: 17.9250 }, // Clarified name
    { name: "Systembolaget Arninge", lat: 59.4520, lon: 18.1250 },
    { name: "Systembolaget Åkersberga C", lat: 59.4800, lon: 18.2950 },
    { name: "Systembolaget Vallentuna C", lat: 59.5330, lon: 18.0800 },
    { name: "Systembolaget Märsta", lat: 59.6250, lon: 17.8450 }, // Added
    { name: "Systembolaget Sigtuna", lat: 59.6170, lon: 17.7200 }, // Added
    { name: "Systembolaget Norrtälje", lat: 59.757200981639876, lon: 18.700358608072552 },
    { name: "Systembolaget Djursholms Torg", lat: 59.3950, lon: 18.0800 }, // Added

    // === NACKA / VÄRMDÖ / EAST + LIDINGÖ ===
    { name: "Systembolaget Nacka Forum", lat: 59.3090, lon: 18.1650 },
    { name: "Systembolaget Orminge C", lat: 59.3160, lon: 18.2480 },
    { name: "Systembolaget Gustavsberg C", lat: 59.3260, lon: 18.3880 },
    { name: "Systembolaget Sickla", lat: 59.3070, lon: 18.1180 },
    { name: "Systembolaget Lidingö C", lat: 59.3670, lon: 18.1420 }, // Added
    { name: "Systembolaget Saltsjöbaden", lat: 59.2840, lon: 18.2500 }  // Added
    // Add more as needed
];

const openingHours = {
    // dayOfWeek (0=Sun, 1=Mon,... 6=Sat) : [openHour, closeHour] (24-hour format)
    // null means closed all day
    0: null, // Sunday
    1: [10, 19], // Monday
    2: [10, 19], // Tuesday
    3: [10, 19], // Wednesday
    4: [10, 19], // Thursday
    5: [10, 19], // Friday
    6: [10, 15]  // Saturday
};

// --- State Variables ---
let currentPosition = null;
let currentHeading = null;
let nearestShop = null;
let watchId = null; // To store the watchPosition ID

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

function findNearestShop() {
    if (!currentPosition) return null;

    let closestShop = null;
    let minDist = Infinity;

    beerShops.forEach(shop => {
        const dist = getDistanceFromLatLonInKm(
            currentPosition.coords.latitude,
            currentPosition.coords.longitude,
            shop.lat,
            shop.lon
        );
        if (dist < minDist) {
            minDist = dist;
            closestShop = shop;
            closestShop.distance = dist; // Store distance with the shop object
        }
    });
    return closestShop;
}

/**
 * Determines if the shop is open/closed and when the next event (open/close) occurs.
 * @param {Date} now The current date and time.
 * @returns {object|null} Object with status, eventType, nextEventTime, or null on error.
 */
function getShopStatus(now) {
    const currentDay = now.getDay(); // 0=Sun, 6=Sat
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    let status = 'closed';
    let eventType = 'opens';
    let nextEventTime = null;

    const todayHours = openingHours[currentDay];

    if (todayHours) { // Shop has hours today
        const openTimeInMinutes = todayHours[0] * 60;
        const closeTimeInMinutes = todayHours[1] * 60;

        if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
            // Currently Open
            status = 'open';
            eventType = 'closes';
            nextEventTime = new Date(now);
            nextEventTime.setHours(todayHours[1], 0, 0, 0); // Closing time today
        } else if (currentTimeInMinutes < openTimeInMinutes) {
            // Closed, opens later today
            status = 'closed';
            eventType = 'opens';
            nextEventTime = new Date(now);
            nextEventTime.setHours(todayHours[0], 0, 0, 0); // Opening time today
        } else {
            // Closed, already past closing time (handle below)
            status = 'closed';
            eventType = 'opens';
        }
    } else {
        // Closed all day today (e.g., Sunday)
        status = 'closed';
        eventType = 'opens';
    }

    // If closed and next event isn't set yet (meaning opens next opening day)
    if (status === 'closed' && !nextEventTime) {
        let nextDay = currentDay;
        let daysToAdd = 0;
        let attempts = 0; // Safety break for infinite loop
        do {
            daysToAdd++;
            nextDay = (nextDay + 1) % 7;
            attempts++;
        } while (!openingHours[nextDay] && attempts < 8); // Find next day with hours

        if (attempts < 8 && openingHours[nextDay]) {
             const nextOpeningHour = openingHours[nextDay][0];
             nextEventTime = new Date(now);
             // Important: Calculate date correctly, avoiding issues near month/year end
             nextEventTime.setDate(now.getDate() + daysToAdd);
             nextEventTime.setHours(nextOpeningHour, 0, 0, 0);
        } else {
            console.error("Could not find next opening day within 7 days.");
             return null; // Should not happen with valid schedule
        }
    }

    if (!nextEventTime) {
        console.error("Could not determine next event time.");
        return null;
    }

    // Ensure the calculated nextEventTime is in the future
    if (nextEventTime <= now && status === 'closed') {
         // This can happen briefly right at opening time if logic isn't perfect,
         // or if calculation resulted in a past time due to date rollover issues.
         // Recalculate assuming we need the *next* available slot after 'now'.
         // This requires more robust logic, for simplicity, let's just indicate recalculating.
         console.warn("Calculated next event time is in the past, needs refinement.");
         // return null; // Or return a flag to recalculate
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
    // Ensure backticks are used for THESE template literals:
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes >= 0 && totalMinutes < 60 || minutes > 0) {
         parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }
    if (parts.length === 0 && diffMs === 0) {
        return "Now";
    }
    if (parts.length === 0) {
        return "Calculating..."
    }

    // This line simply joins the parts with a space
    return parts.join(' ');
}


// --- Add a new function to specifically update the hours text ---
function updateOpeningHoursDisplay() {
    const now = new Date();
    const statusInfo = getShopStatus(now);

    if (statusInfo) {
        const diffMs = statusInfo.nextEventTime.getTime() - now.getTime();
        const formattedDiff = formatTimeDifference(diffMs);
        const prefix = statusInfo.status === 'open' ? 'Closes' : 'Opens';
        hoursText.textContent = `${prefix} in: ${formattedDiff}`;
    } else {
        hoursText.textContent = "Opening hours: Status unavailable";
    }
}

function updateDisplay() {
    nearestShop = findNearestShop(); // Find nearest based on currentPosition

    if (nearestShop) {
        // Update distance text
        distanceText.textContent = `Distance: ${nearestShop.distance.toFixed(2)} km (${nearestShop.name})`;

        // Calculate bearing if we have position
        const bearing = getBearingFromLatLon(
            currentPosition.coords.latitude,
            currentPosition.coords.longitude,
            nearestShop.lat,
            nearestShop.lon
        );

        // Rotate needle if we have heading and bearing
        if (currentHeading !== null) {
            const rotation = bearing - currentHeading;
            compassNeedle.style.transform = `rotate(${rotation}deg)`;
            statusText.textContent = `Heading: ${Math.round(currentHeading)}° | Bearing: ${Math.round(bearing)}°`;
        } else {
             statusText.textContent = "Waiting for compass...";
             // Optional: Point needle North if no compass data yet?
             // compassNeedle.style.transform = `rotate(${bearing}deg)`;
        }
    } else {
         distanceText.textContent = `Distance: --- km`;
         if (!currentPosition) {
            statusText.textContent = "Waiting for GPS signal...";
         }
    }

    updateOpeningHoursDisplay();
}

// --- Event Handlers ---

// Handle successful location updates
function handleLocationUpdate(pos) {
    console.log("Location update:", pos.coords);
    currentPosition = pos;
    updateDisplay(); // Update UI whenever location changes
}

// Handle location errors
function handleLocationError(err) {
    console.error("Location Error:", err);
    statusText.textContent = `Error getting location: ${err.message}`;
    // Stop watching if permission denied or other fatal error
    if (err.code === 1 || err.code === 2) { // PERMISSION_DENIED or POSITION_UNAVAILABLE
        stopTracking();
    }
}

// Handle device orientation updates
function handleOrientationUpdate(event) {
    // Use webkitCompassHeading for older iOS compatibility, otherwise use alpha
    let heading = event.webkitCompassHeading !== undefined
                  ? event.webkitCompassHeading // iOS
                  : event.alpha;             // Standard

    if (heading !== null) {
         // Adjust for device orientation if needed (complex, skip for now)
         // For simplicity, assume 'heading' is relative to North
         currentHeading = heading;
         console.log("Heading update:", currentHeading);
         updateDisplay(); // Update display when heading changes
    } else {
        statusText.textContent = "Compass data not available";
    }
}

// Request permissions and start tracking
function requestPermissionsAndStart() {
    statusText.textContent = "Requesting permissions...";

    // 1. Request Device Orientation (Compass)
    // Standard way requires user interaction first or specific flags.
    // Let's try adding the listener directly - browser might prompt.
    // Use 'deviceorientationabsolute' if available for true North reading
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
         // iOS 13+ requires explicit permission request triggered by user action
         DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientationabsolute', handleOrientationUpdate, true);
                    window.addEventListener('deviceorientation', handleOrientationUpdate, true); // Fallback
                    // 2. Request Geolocation AFTER orientation permission (if granted)
                    startGeolocation();
                } else {
                    statusText.textContent = "Compass permission denied.";
                }
            })
            .catch(error => {
                 console.error("Orientation Permission Error:", error);
                 statusText.textContent = "Could not request compass permission.";
                 // Still try to get location? Or stop? Let's try location anyway.
                 startGeolocation();
            });
    } else {
         // Non-iOS 13+ or browsers without requestPermission method
         window.addEventListener('deviceorientationabsolute', handleOrientationUpdate, true);
         window.addEventListener('deviceorientation', handleOrientationUpdate, true); // Fallback
         statusText.textContent += " (Compass listener added)";
         // 2. Request Geolocation
         startGeolocation();
    }

    updateOpeningHoursDisplay(); // Initial call
    // Start the interval timer to update the hours display every minute
     setInterval(updateOpeningHoursDisplay, 60000); // 60000ms = 1 minute
}

function startGeolocation() {
     if (navigator.geolocation) {
        statusText.textContent = "Attempting to get location...";
        // Use watchPosition for continuous updates
        watchId = navigator.geolocation.watchPosition(
            handleLocationUpdate,
            handleLocationError,
            {
                enableHighAccuracy: true, // Request more accurate GPS
                maximumAge: 0,          // Don't use cached position
                timeout: 15000          // Time limit to get position (ms)
            }
        );
     } else {
        statusText.textContent = "Geolocation is not supported by this browser.";
     }
}

// Function to stop tracking (optional)
function stopTracking() {
     if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log("Stopped location tracking.");
     }
     window.removeEventListener('deviceorientationabsolute', handleOrientationUpdate, true);
     window.removeEventListener('deviceorientation', handleOrientationUpdate, true);
     console.log("Stopped orientation tracking.");
     // Maybe reset UI?
     // statusText.textContent = "Tracking stopped.";
}

// --- Initial Setup ---
startButton.addEventListener('click', requestPermissionsAndStart);

// Register the service worker (from previous steps)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('Service Worker registered with scope:', registration.scope))
        .catch(error => console.error('Service Worker registration failed:', error));
}