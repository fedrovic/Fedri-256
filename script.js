// Mapbox setup
mapboxgl.accessToken = 'pk.eyJ1IjoiZmVkcmktMjU2IiwiYSI6ImNtZnJ6dTg2MzBjM2QyanF5cDJ0cDlwZGMifQ.Ttb_MrE99t7YjMFORnEg1g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [30.628, -0.613], // Start in Kihumuro
  zoom: 15
});

// Create blue marker (your live location)
const blueEl = document.createElement('div');
blueEl.className = 'marker marker3';
let blueMarker = new mapboxgl.Marker(blueEl).setLngLat([30.628, -0.613]).addTo(map);

// Use browser Geolocation API
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (position) => {
      const lng = position.coords.longitude;
      const lat = position.coords.latitude;
      blueMarker.setLngLat([lng, lat]);
      map.flyTo({ center: [lng, lat], zoom: 15 });
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
