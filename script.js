mapboxgl.accessToken = 'pk.eyJ1IjoiZmVkcmktMjU2IiwiYSI6ImNtZnJ6dTg2MzBjM2QyanF5cDJ0cDlwZGMifQ.Ttb_MrE99t7YjMFORnEg1g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11', // default
  center: [30.628, -0.613], // Start in Kihumuro
  zoom: 15
});

// ✅ Add zoom & compass controls
map.addControl(new mapboxgl.NavigationControl(), "top-right");

let currentLocation = [30.628, -0.613]; // default until GPS updates

// ✅ Blue marker (your live location)
const blueEl = document.createElement('div');
blueEl.className = 'marker marker3';
let blueMarker = new mapboxgl.Marker(blueEl).setLngLat(currentLocation).addTo(map);

// Use browser Geolocation API for live tracking
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (position) => {
      const lng = position.coords.longitude;
      const lat = position.coords.latitude;
      currentLocation = [lng, lat]; // save latest location
      blueMarker.setLngLat(currentLocation);
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

// ✅ Re-center button
document.getElementById("recenterBtn").addEventListener("click", () => {
  map.flyTo({ center: currentLocation, zoom: 18 });
});

// ✅ Style switcher
document.getElementById("styleSelect").addEventListener("change", (event) => {
  const selectedStyle = event.target.value;
  map.setStyle(selectedStyle);
});

// ✅ Search bar (Geocoder)
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  placeholder: "Search for a place..."
});
map.addControl(geocoder, "top-left");

// ✅ Multiple yellow markers for searched places + history list
geocoder.on("result", (e) => {
  const coords = e.result.center;
  const placeName = e.result.place_name;

  // Create yellow marker
  const yellowEl = document.createElement('div');
  yellowEl.className = 'marker-search';
  new mapboxgl.Marker(yellowEl).setLngLat(coords).addTo(map);

  // Fly to the searched place
  map.flyTo({ center: coords, zoom: 16 });

  // Add to search history list
  const listItem = document.createElement("li");
  listItem.textContent = placeName;
  document.getElementById("placesList").appendChild(listItem);
});
