// --- DOM Elements ---
const startButton = document.getElementById('startCompass');
const compassNeedle = document.getElementById('compassNeedle');
const distanceText = document.getElementById('distanceText');
const statusText = document.getElementById('statusText');
const hoursText = document.getElementById('hoursText');

// --- Configuration ---
const beerShops = [
    // Add coordinates for relevant Systembolaget or other shops
    // Using example locations near Huddinge/Stockholm
    { name: "Systembolaget Huddinge C", lat: 59.2380, lon: 17.9950 },
    { name: "Systembolaget Flemingsberg", lat: 59.2200, lon: 17.9420 },
    { name: "Systembolaget Skärholmen", lat: 59.2758, lon: 17.9075 },
    { name: "Systembolaget Liljeholmen", lat: 59.3100, lon: 18.0240 },
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