document.getElementById('getLocation').addEventListener('click', () => {
    console.log('Requesting location...');
    // Location logic will go here
});

document.getElementById('getCompass').addEventListener('click', () => {
    console.log('Requesting compass...');
    // Compass logic will go here
});

// Check if the browser supports service workers, and if so, register one:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}