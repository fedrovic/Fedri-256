mapboxgl.accessToken = 'pk.eyJ1IjoiZmVkcmktMjU2IiwiYSI6ImNtZnJ6dTg2MzBjM2QyanF5cDJ0cDlwZGMifQ.Ttb_MrE99t7YjMFORnEg1g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [30.628, -0.613],
  zoom: 15
});

// Marker data
const markersData = [
  {
    className: 'marker marker1',
    pos: [30.628, -0.613],
    route: [
      [30.628, -0.613],
      [30.630, -0.612],
      [30.632, -0.614],
      [30.631, -0.616],
      [30.629, -0.615]
    ],
    step: 0
  },
  {
    className: 'marker marker2',
    pos: [30.626, -0.611],
    route: [
      [30.626, -0.611],
      [30.627, -0.613],
      [30.629, -0.614],
      [30.630, -0.612],
      [30.628, -0.610]
    ],
    step: 0
  },
  {
    className: 'marker marker3',
    pos: [30.627, -0.615],
    route: [
      [30.627, -0.615],
      [30.629, -0.616],
      [30.630, -0.614],
      [30.631, -0.615],
      [30.628, -0.617]
    ],
    step: 0
  }
];

let autoMode = true;
let manualIndex = 0; // marker being manually controlled

// Create markers
markersData.forEach((m, i) => {
  const el = document.createElement('div');
  el.className = m.className;
  m.el = el;
  m.marker = new mapboxgl.Marker(el).setLngLat(m.pos).addTo(map);
});

// Update markers
function updateMarkers() {
  markersData.forEach((m, i) => {
    m.marker.setLngLat(m.pos);
    if (i === manualIndex && !autoMode) {
      m.el.classList.add('highlight');
    } else {
      m.el.classList.remove('highlight');
    }
  });
}

// Automatic movement
function moveMarkersAuto() {
  if (!autoMode) return;
  markersData.forEach(m => {
    m.pos = m.route[m.step];
    m.step = (m.step + 1) % m.route.length;
  });
  updateMarkers();
  setTimeout(moveMarkersAuto, 2000);
}

// Resume auto button
document.getElementById("autoBtn").addEventListener("click", () => {
  autoMode = true;
  updateMarkers(); // remove highlight
  moveMarkersAuto();
});

// Keyboard manual control for first marker
document.addEventListener("keydown", function(event) {
  const stepSize = 0.0005;
  autoMode = false;
  const m = markersData[manualIndex];
  switch(event.key){
    case "ArrowUp": m.pos[1] += stepSize; break;
    case "ArrowDown": m.pos[1] -= stepSize; break;
    case "ArrowLeft": m.pos[0] -= stepSize; break;
    case "ArrowRight": m.pos[0] += stepSize; break;
  }
  updateMarkers();
});

// Start simulation
map.on("load", () => {
  updateMarkers();
  moveMarkersAuto();
});
