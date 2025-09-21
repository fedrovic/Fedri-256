mapboxgl.accessToken = 'pk.eyJ1IjoiZmVkcmktMjU2IiwiYSI6ImNtZnJ6dTg2MzBjM2QyanF5cDJ0cDlwZGMifQ.Ttb_MrE99t7YjMFORnEg1g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11', // default
  center: [30.628, -0.613], // Start in Kihumuro
  zoom: 15
});

// ✅ Add zoom & compass controls
map.addControl(new mapboxgl.NavigationControl(), "top-right");

// Create blue marker (your live location)
const blueEl = document.createElement('div');
blueEl.className = 'marker marker3';
let blueMarker = new mapboxgl.Marker(blueEl).setLngLat([30.628, -0.613]).addTo(map);

let currentLocation = [30.628, -0.613]; // default until GPS updates

// Use browser Geolocation API
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (position) => {
      const lng = position.coords.longitude;
      const lat = position.coords.latitude;
      currentLocation = [lng, lat]; // save latest location
      blueMarker.setLngLat(currentLocation);

      // Auto-center once when loaded
      map.flyTo({ center: currentLocation, zoom: 18 });
    },
    (error) => {
      console.error("Error getting location:", error);
      alert("Unable to access your location. Please enable GPS.");
    },
    { enableHighAccuracy: true }
  );
} else {
  alert("Geolocation not supported on this device/browser.");
}

// ✅ Re-center button logic
document.getElementById("recenterBtn").addEventListener("click", () => {
  map.flyTo({ center: currentLocation, zoom: 18 });
});

// ✅ Style switcher logic
document.getElementById("styleSelect").addEventListener("change", (event) => {
  const selectedStyle = event.target.value;
  map.setStyle(selectedStyle);
});
