mapboxgl.accessToken = 'pk.eyJ1IjoiZmVkcmktMjU2IiwiYSI6ImNtZnJ6dTg2MzBjM2QyanF5cDJ0cDlwZGMifQ.Ttb_MrE99t7YjMFORnEg1g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [30.628, -0.613], 
  zoom: 15
});

map.addControl(new mapboxgl.NavigationControl(), "top-right");

let currentLocation = [30.628, -0.613];

// ✅ Blue marker
const blueEl = document.createElement('div');
blueEl.className = 'marker marker3';
let blueMarker = new mapboxgl.Marker(blueEl).setLngLat(currentLocation).addTo(map);

// Track user location
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (position) => {
      const lng = position.coords.longitude;
      const lat = position.coords.latitude;
      currentLocation = [lng, lat];
      blueMarker.setLngLat(currentLocation);
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
  map.flyTo({ center: currentLocation, zoom: 16 });
});

// ✅ Style button toggle
document.getElementById("styleBtn").addEventListener("click", () => {
  const menu = document.getElementById("styleMenu");
  menu.classList.toggle("hidden");
});

// ✅ Close style menu on outside click
document.addEventListener("click", (event) => {
  const menu = document.getElementById("styleMenu");
  const styleBtn = document.getElementById("styleBtn");

  if (!menu.contains(event.target) && event.target !== styleBtn) {
    menu.classList.add("hidden");
  }
});

// ✅ 3D Mode toggle
let is3D = false;
document.getElementById("toggle3DBtn").addEventListener("click", () => {
  if (!is3D) {
    map.setPitch(60);
    map.setBearing(-17.6);
    add3DBuildings();
    is3D = true;
    document.getElementById("toggle3DBtn").textContent = "2D Mode";
  } else {
    map.setPitch(0);
    map.setBearing(0);
    if (map.getLayer("3d-buildings")) {
      map.removeLayer("3d-buildings");
    }
    is3D = false;
    document.getElementById("toggle3DBtn").textContent = "3D Mode";
  }
});

// ✅ Function to add 3D buildings
function add3DBuildings() {
  if (!map.getLayer("3d-buildings")) {
    const layers = map.getStyle().layers;
    let labelLayerId;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === "symbol" && layers[i].layout["text-field"]) {
        labelLayerId = layers[i].id;
        break;
      }
    }
    map.addLayer(
      {
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#aaa",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15, 0,
            15.05, ["get", "height"]
          ],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.6
        }
      },
      labelLayerId
    );
  }
}

// ✅ Style selection + dynamic button label + keep 3D mode
document.querySelectorAll("#styleMenu button").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const style = e.target.getAttribute("data-style");
    const styleName = e.target.textContent;
    
    map.setStyle(style);
    document.getElementById("styleMenu").classList.add("hidden");

    // Update button text dynamically
    document.getElementById("styleBtn").textContent = styleName + " View";

    map.on("style.load", () => {
      if (is3D) {
        add3DBuildings();
        map.setPitch(60);
        map.setBearing(-17.6);
      }
    });
  });
});

// ✅ Search bar (Geocoder)
const geocoder = new MapboxGeocoder({
  accessToken
