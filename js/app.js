/* =========================================================
   TRAVEL MAP APPLICATION
   ========================================================= */


/* =========================================================
   MAPTILER KEY
   ========================================================= */

const MAPTILER_KEY = 'bJFELXE9ObxEcPw6yWbl'; // Replace A with your real MapTiler API key.


/* =========================================================
   CREATE PERMANENT MAP
   ========================================================= */

const map = new maplibregl.Map({
  container: 'map', // Main map container.
  style: {
  version: 8,

  // Required for text such as cluster numbers.
  glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`,

  sources: {},
  layers: []
},
  center: [134.5, -27.5], // Start over Australia.
  zoom: 3.5,
  minZoom: 2
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');


/* =========================================================
   APP STATE
   ========================================================= */

let travelData = null; // Original places.geojson.
let currentFilteredData = null; // Data currently shown on map.
let activeCategory = 'All'; // Current category filter.
let activeYear = 'All'; // Current year filter.


/* =========================================================
   BASEMAP TILE URLS
   ========================================================= */

const basemapTiles = {
  map: `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`, // Street map.
  satellite: `https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`, // Satellite.
  terrain: `https://api.maptiler.com/maps/topo-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}` // Terrain.
};


/* =========================================================
   MAP LOAD
   ========================================================= */

map.on('load', async () => {

  /* ==================== BASEMAP SOURCES ==================== */

  map.addSource('basemap-map', {
    type: 'raster',
    tiles: [basemapTiles.map],
    tileSize: 256,
    attribution: '© MapTiler © OpenStreetMap contributors'
  });

  map.addSource('basemap-satellite', {
    type: 'raster',
    tiles: [basemapTiles.satellite],
    tileSize: 256,
    attribution: '© MapTiler © OpenStreetMap contributors'
  });

  map.addSource('basemap-terrain', {
    type: 'raster',
    tiles: [basemapTiles.terrain],
    tileSize: 256,
    attribution: '© MapTiler © OpenStreetMap contributors'
  });


  /* ==================== BASEMAP LAYERS ==================== */

  map.addLayer({
    id: 'basemap-map-layer',
    type: 'raster',
    source: 'basemap-map',
    layout: { visibility: 'none' }
  });

  map.addLayer({
    id: 'basemap-satellite-layer',
    type: 'raster',
    source: 'basemap-satellite',
    layout: { visibility: 'visible' }
  });

  map.addLayer({
    id: 'basemap-terrain-layer',
    type: 'raster',
    source: 'basemap-terrain',
    layout: { visibility: 'none' }
  });


/* =========================================================
   ULURU BASE WALK — ROUTE SOURCES + CINEMATIC LAYERS
   ========================================================= */

const emptyGeoJSON = {
  type: 'FeatureCollection',
  features: []
};


/* ==================== ROUTE SOURCES ==================== */

map.addSource('uluru-walk-route', {
  type: 'geojson',
  data: emptyGeoJSON
});

map.addSource('uluru-walk-progress', {
  type: 'geojson',
  data: emptyGeoJSON
});


/* ==================== ROUTE SHADOW ==================== */
/* Dark shadow underneath makes the route readable on satellite imagery. */

map.addLayer({
  id: 'uluru-walk-route-shadow',
  type: 'line',
  source: 'uluru-walk-route',

  layout: {
    'line-cap': 'round',
    'line-join': 'round'
  },

  paint: {
    'line-color': '#000000',
    'line-width': 10,
    'line-opacity': 0.28,
    'line-blur': 2
  }
});


/* ==================== COMPLETE ROUTE ==================== */
/* Remaining route stays visible underneath the animation. */

map.addLayer({
  id: 'uluru-walk-route-line',
  type: 'line',
  source: 'uluru-walk-route',

  layout: {
    'line-cap': 'round',
    'line-join': 'round'
  },

  paint: {
    'line-color': '#ffffff',
    'line-width': 6,
    'line-opacity': 0.70
  }
});


/* ==================== COMPLETED ROUTE GLOW ==================== */

map.addLayer({
  id: 'uluru-walk-progress-glow',
  type: 'line',
  source: 'uluru-walk-progress',

  layout: {
    'line-cap': 'round',
    'line-join': 'round'
  },

  paint: {
    'line-color': '#ff3b30',
    'line-width': 13,
    'line-opacity': 0.32,
    'line-blur': 3
  }
});


/* ==================== COMPLETED ROUTE ==================== */

map.addLayer({
  id: 'uluru-walk-progress-line',
  type: 'line',
  source: 'uluru-walk-progress',

  layout: {
    'line-cap': 'round',
    'line-join': 'round'
  },

  paint: {
    'line-color': '#ff453a',
    'line-width': 7,
    'line-opacity': 1
  }
});

/* =========================================================
   ULURU BASE WALK — CINEMATIC WALK MODE
   ========================================================= */

let uluruWalkAnimation = null;
let uluruWalkerMarker = null;
let uluruWalkStopped = false;

   /* =========================================================
   ULURU WALK — LOCATION LABELS
   Labels shown only during the cinematic Base Walk.
   Coordinates can be refined independently from the route.
   ========================================================= */

const uluruWalkLocations = [
  {
    id: 'uluru',
    name: 'ULURU',
    subtitle: 'Aṉangu cultural landscape',
    coordinates: [131.0369, -25.3444],
    type: 'major'
  },
  {
    id: 'mala-walk',
    name: 'Mala Walk',
    subtitle: '',
    coordinates: [130.9857, -25.3455],
    type: 'place'
  },
  {
    id: 'kantju-gorge',
    name: 'Kantju Gorge',
    subtitle: '',
    coordinates: [130.9859, -25.3365],
    type: 'place'
  },
  {
    id: 'mutitjulu-waterhole',
    name: 'Mutitjulu Waterhole',
    subtitle: '',
    coordinates: [131.0805, -25.3520],
    type: 'place'
  },
  {
    id: 'kuniya-walk',
    name: 'Kuniya Walk',
    subtitle: '',
    coordinates: [131.0781, -25.3514],
    type: 'place'
  }
];

let uluruWalkLocationMarkers = [];


/* =========================================================
   CREATE ULURU WALK LOCATION LABELS
   ========================================================= */

function createUluruWalkLocationLabels() {

  removeUluruWalkLocationLabels();

  uluruWalkLocations.forEach(location => {

    const markerElement = document.createElement('div');

    markerElement.className =
      `uluru-walk-location-label ${location.type === 'major' ? 'uluru-major-label' : ''}`;

    if (location.type === 'major') {

      markerElement.innerHTML = `
        <div class="uluru-location-major-name">
          ${location.name}
        </div>

        ${
          location.subtitle
            ? `
              <div class="uluru-location-subtitle">
                ${location.subtitle}
              </div>
            `
            : ''
        }
      `;

    } else {

      markerElement.innerHTML = `
        <div class="uluru-location-dot"></div>

        <div class="uluru-location-name">
          ${location.name}
        </div>
      `;

    }

    const marker = new maplibregl.Marker({
      element: markerElement,
      anchor: 'center'
    })
      .setLngLat(location.coordinates)
      .addTo(map);

    uluruWalkLocationMarkers.push(marker);

  });

}


/* =========================================================
   REMOVE ULURU WALK LOCATION LABELS
   ========================================================= */

function removeUluruWalkLocationLabels() {

  uluruWalkLocationMarkers.forEach(marker => {
    marker.remove();
  });

  uluruWalkLocationMarkers = [];

}

/* =========================================================
   ULURU WALK — PHOTO POINTS

   These are illustrative photo stops positioned directly
   on coordinates from the actual Uluru Base Walk route.

   The coordinate does NOT represent the exact location
   where the photograph was originally taken.
   ========================================================= */

const uluruWalkPhotoPoints = [

  {
    id: 'uluru-photo-01',
    title: 'Uluru Base Walk',
    caption: 'A moment from the northern side of the walk.',
    image:
      'https://pub-5b0739bcf4824a9281200bc31e19b443.r2.dev/uluru/photos/Image03.webp',
    coordinates: [
      131.0299987476537,
      -25.3350200525214
    ]
  },

  {
    id: 'uluru-photo-02',
    title: 'Around Uluru',
    caption: 'Following the walking track around the rock.',
    image:
      'https://pub-5b0739bcf4824a9281200bc31e19b443.r2.dev/uluru/photos/Image06.webp',
    coordinates: [
      131.0438318123332,
      -25.33575584584111
    ]
  },

  {
    id: 'uluru-photo-03',
    title: 'Uluru Landscape',
    caption: 'A view from the eastern section of the Base Walk.',
    image:
      'https://pub-5b0739bcf4824a9281200bc31e19b443.r2.dev/uluru/photos/Image10.webp',
    coordinates: [
      131.0539691878397,
      -25.34147744055506
    ]
  },

  {
    id: 'uluru-photo-04',
    title: 'Walking Country',
    caption: 'A moment along the southern section of the circuit.',
    image:
      'https://pub-5b0739bcf4824a9281200bc31e19b443.r2.dev/uluru/photos/Image14.webp',
    coordinates: [
      131.0482590538396,
      -25.35030216683478
    ]
  },

  {
    id: 'uluru-photo-05',
    title: 'Uluru Base',
    caption: 'Looking across the landscape while continuing around Uluru.',
    image:
      'https://pub-5b0739bcf4824a9281200bc31e19b443.r2.dev/uluru/photos/Image19.webp',
    coordinates: [
      131.0363067849428,
      -25.35221663800647
    ]
  },

  {
    id: 'uluru-photo-06',
    title: 'Completing the Circuit',
    caption: 'A final moment from the western side of the Base Walk.',
    image:
      'https://pub-5b0739bcf4824a9281200bc31e19b443.r2.dev/uluru/photos/Image23.webp',
    coordinates: [
      131.0242751503351,
      -25.35039449452704
    ]
  }

];


let uluruWalkPhotoMarkers = [];


/* =========================================================
   CREATE ULURU WALK PHOTO MARKERS
   ========================================================= */

function createUluruWalkPhotoMarkers() {

  removeUluruWalkPhotoMarkers();

  uluruWalkPhotoPoints.forEach(photo => {

    const markerElement =
      document.createElement('button');

    markerElement.className =
      'uluru-photo-marker';

    markerElement.type = 'button';

    markerElement.setAttribute(
      'aria-label',
      `View photo: ${photo.title}`
    );

    markerElement.innerHTML = `
      <span class="uluru-photo-marker-icon">
        📷
      </span>
    `;


    /* Open the photo when camera is clicked. */

    markerElement.addEventListener(
      'click',
      event => {

        event.preventDefault();
        event.stopPropagation();

        openUluruWalkPhoto(photo);

      }
    );


    const marker =
      new maplibregl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat(photo.coordinates)
        .addTo(map);


    uluruWalkPhotoMarkers.push(
      marker
    );

  });

}


/* =========================================================
   REMOVE ULURU WALK PHOTO MARKERS
   ========================================================= */

function removeUluruWalkPhotoMarkers() {

  uluruWalkPhotoMarkers.forEach(
    marker => marker.remove()
  );

  uluruWalkPhotoMarkers = [];

}


/* =========================================================
   OPEN ULURU WALK PHOTO
   ========================================================= */

function openUluruWalkPhoto(photo) {

  console.log(
    'ULURU PHOTO CLICKED:',
    photo.id,
    photo.image
  );

  document
    .getElementById('uluruWalkPhotoViewer')
    ?.remove();

  const viewer =
    document.createElement('div');

  viewer.id =
    'uluruWalkPhotoViewer';

  viewer.className =
    'uluru-walk-photo-viewer';


  viewer.innerHTML = `

    <div class="uluru-photo-card">

      <button
        type="button"
        class="uluru-photo-close"
        aria-label="Close photo"
      >
        ×
      </button>

      <img
        class="uluru-photo-image"
        src="${photo.image}"
        alt="${photo.title}"
      >

      <div class="uluru-photo-content">

        <div class="uluru-photo-title">
          ${photo.title}
        </div>

        <div class="uluru-photo-caption">
          ${photo.caption}
        </div>

      </div>

    </div>

  `;


  document.body.appendChild(
    viewer
  );


  viewer
    .querySelector('.uluru-photo-close')
    ?.addEventListener(
      'click',
      closeUluruWalkPhoto
    );


  viewer.addEventListener(
    'click',
    event => {

      if (event.target === viewer) {
        closeUluruWalkPhoto();
      }

    }
  );

}


/* =========================================================
   CLOSE ULURU WALK PHOTO
   ========================================================= */

function closeUluruWalkPhoto() {

  document
    .getElementById('uluruWalkPhotoViewer')
    ?.remove();

}


/* =========================================================
   DISTANCE CALCULATION
   ========================================================= */

function calculateWalkDistance(coord1, coord2) {

  const earthRadius = 6371;

  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;

  const deltaLat =
    (coord2[1] - coord1[1]) * Math.PI / 180;

  const deltaLng =
    (coord2[0] - coord1[0]) * Math.PI / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(deltaLng / 2) *
    Math.sin(deltaLng / 2);

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}


/* =========================================================
   ENTER CINEMATIC WALK MODE
   Hide normal WhereWeBeen interface.
   ========================================================= */

function enterUluruWalkMode() {

  document.body.classList.add('uluru-walk-mode');

  const dashboard =
    document.getElementById('travelDashboard');

  const backdrop =
    document.getElementById('dashboardBackdrop');

  if (dashboard) {
    dashboard.classList.remove('active');
  }

  if (backdrop) {
    backdrop.classList.remove('active');
  }

}


/* =========================================================
   EXIT CINEMATIC WALK MODE
   ========================================================= */

function exitUluruWalkMode() {

  document.body.classList.remove('uluru-walk-mode');

}


/* =========================================================
   CREATE CINEMATIC WALK INTERFACE
   ========================================================= */

function createUluruWalkUI() {

  document
    .getElementById('uluruWalkOverlay')
    ?.remove();

  const overlay =
    document.createElement('div');

  overlay.id = 'uluruWalkOverlay';

  overlay.innerHTML = `

    <!-- ==================== WALK CARD ==================== -->

    <section class="uluru-walk-card">

      <h2>Uluru Base Walk</h2>

      <div class="uluru-walk-stats">

        <div class="uluru-walk-stat">
          <span class="uluru-stat-icon">🚶</span>
          <span>10.6 km</span>
        </div>

        <div class="uluru-walk-stat">
          <span class="uluru-stat-icon">◷</span>
          <span>3–4 hours</span>
        </div>

        <div class="uluru-walk-stat">
          <span class="uluru-stat-icon">▥</span>
          <span>Moderate</span>
        </div>

      </div>

      <div class="uluru-walk-card-divider"></div>

      <div class="uluru-walk-card-footer">

        <div class="uluru-walk-message">

          <strong>
            Enjoy the journey!
          </strong>

          <span>
            Following the Uluru Base Walk route.
          </span>

        </div>

        <button
          id="stopUluruWalkButton"
          class="uluru-stop-button"
          type="button">
          <span>■</span>
          Stop animation
        </button>

      </div>

    </section>


    <!-- ==================== PROGRESS PANEL ==================== -->

    <section class="uluru-progress-panel">

      <div class="uluru-progress-top">

        <span id="uluruWalkStatus">
          Walking around Uluru...
        </span>

        <span id="uluruWalkDistance">
          0.0 km / 10.6 km
        </span>

      </div>

      <div class="uluru-progress-bottom">

        <div class="uluru-progress-track">

          <div
            id="uluruWalkProgressBar"
            class="uluru-progress-fill">
          </div>

        </div>

        <span id="uluruWalkPercentage">
          0%
        </span>

      </div>

    </section>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById('stopUluruWalkButton')
    ?.addEventListener(
      'click',
      stopUluruWalk
    );

}


/* =========================================================
   UPDATE PROGRESS
   ========================================================= */

function updateUluruWalkProgress(
  percentage,
  distanceTravelled,
  totalDistance
) {

  const bar =
    document.getElementById(
      'uluruWalkProgressBar'
    );

  const percentageText =
    document.getElementById(
      'uluruWalkPercentage'
    );

  const distanceText =
    document.getElementById(
      'uluruWalkDistance'
    );

  if (bar) {
    bar.style.width =
      `${Math.min(percentage, 100)}%`;
  }

  if (percentageText) {
    percentageText.textContent =
      `${Math.round(percentage)}%`;
  }

  if (distanceText) {
    distanceText.textContent =
      `${distanceTravelled.toFixed(1)} km / ${totalDistance.toFixed(1)} km`;
  }

}


/* =========================================================
   STOP WALK
   ========================================================= */

function stopUluruWalk() {

  uluruWalkStopped = true;

  if (uluruWalkAnimation) {

    cancelAnimationFrame(
      uluruWalkAnimation
    );

    uluruWalkAnimation = null;

  }

  const status =
    document.getElementById(
      'uluruWalkStatus'
    );

  if (status) {
    status.textContent =
      'Walk paused';
  }

  const button =
    document.getElementById(
      'stopUluruWalkButton'
    );

  if (button) {

    button.innerHTML =
      '<span>×</span> Close';

    button.onclick =
      closeUluruWalkUI;

  }

}


/* =========================================================
   CLOSE WALK MODE
   ========================================================= */

function closeUluruWalkUI() {

  uluruWalkStopped = true;

  if (uluruWalkAnimation) {

    cancelAnimationFrame(
      uluruWalkAnimation
    );

    uluruWalkAnimation = null;

  }

  if (uluruWalkerMarker) {

    uluruWalkerMarker.remove();

    uluruWalkerMarker = null;

  }

  /* Remove the floating walk interface. */

document
  .getElementById('uluruWalkOverlay')
  ?.remove();


/* Remove Uluru and landmark labels. */

removeUluruWalkLocationLabels();


/* Remove Uluru photo markers. */

removeUluruWalkPhotoMarkers();


/* Close an open photo viewer. */

closeUluruWalkPhoto();


/* Return to the normal WhereWeBeen map. */

exitUluruWalkMode();
}


/* =========================================================
   START ULURU BASE WALK
   ========================================================= */

async function startUluruWalk() {

  try {

    /* ==================== ENTER WALK MODE ==================== */

    enterUluruWalkMode();

    uluruWalkStopped = false;


    /* ==================== RESET OLD RUN ==================== */

    if (uluruWalkAnimation) {

      cancelAnimationFrame(
        uluruWalkAnimation
      );

      uluruWalkAnimation = null;

    }

    if (uluruWalkerMarker) {

      uluruWalkerMarker.remove();

      uluruWalkerMarker = null;

    }

    document
      .getElementById('uluruWalkOverlay')
      ?.remove();


    /* ==================== MAP SOURCES ==================== */

    const routeSource =
      map.getSource(
        'uluru-walk-route'
      );

    const progressSource =
      map.getSource(
        'uluru-walk-progress'
      );

    if (!routeSource || !progressSource) {

      throw new Error(
        'Uluru walk layers are not ready.'
      );

    }


    /* ==================== LOAD REAL ROUTE ==================== */

    const response =
      await fetch(
        'data/routes/uluru-base-walk.geojson',
        {
          cache: 'no-store'
        }
      );

    if (!response.ok) {

      throw new Error(
        `Could not load Uluru Base Walk route (${response.status})`
      );

    }

    const route =
      await response.json();

    const feature =
      route.type === 'FeatureCollection'
        ? route.features?.[0]
        : route;

    if (
      !feature ||
      feature.geometry?.type !== 'LineString'
    ) {

      throw new Error(
        'Uluru Base Walk must contain a LineString.'
      );

    }

    const coordinates =
      feature.geometry.coordinates;

    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2
    ) {

      throw new Error(
        'Uluru Base Walk has insufficient coordinates.'
      );

    }


    /* ==================== CALCULATE DISTANCES ==================== */

    const cumulativeDistances = [0];

    let geometryDistance = 0;

    for (
      let i = 1;
      i < coordinates.length;
      i++
    ) {

      geometryDistance +=
        calculateWalkDistance(
          coordinates[i - 1],
          coordinates[i]
        );

      cumulativeDistances.push(
        geometryDistance
      );

    }

    const displayDistance = 10.6;


    /* ==================== SHOW COMPLETE ROUTE ==================== */

    routeSource.setData({

      type: 'Feature',

      properties: {
        name:
          feature.properties?.name ||
          'Uluru Base Walk'
      },

      geometry: {
        type: 'LineString',
        coordinates
      }

    });


    /* ==================== CLEAR PROGRESS ==================== */

    progressSource.setData({

      type: 'FeatureCollection',

      features: []

    });


    /* ==================== WALKER ==================== */

    const walker =
      document.createElement('div');

    walker.className =
      'uluru-walker-marker';

    walker.innerHTML = `
      <div class="uluru-walker-halo">
        <span>🚶</span>
      </div>
    `;

    uluruWalkerMarker =
      new maplibregl.Marker({

        element: walker,

        anchor: 'center'

      })
        .setLngLat(
          coordinates[0]
        )
        .addTo(map);


/* ==================== WALK UI ==================== */

createUluruWalkUI();


/* ==================== LOCATION LABELS ==================== */

createUluruWalkLocationLabels();


/* ==================== PHOTO POINTS ==================== */

createUluruWalkPhotoMarkers();


/* ==================== FIT ULURU ==================== */

const bounds =
  coordinates.reduce(

    (routeBounds, coordinate) =>
      routeBounds.extend(
        coordinate
      ),

    new maplibregl.LngLatBounds(
      coordinates[0],
      coordinates[0]
    )

  );

map.fitBounds(bounds, {

  padding: {
    top: 110,
    right: 80,
    bottom: 120,
    left: 80
  },

  duration: 1800,

  maxZoom: 14.5

});


await new Promise(
  resolve =>
    setTimeout(
      resolve,
      1900
    )
);


    /* ==================== ANIMATION ==================== */

    const progressCoordinates = [
      coordinates[0]
    ];

    const totalDuration = 35000;

    const interval =
      totalDuration /
      (coordinates.length - 1);

    let index = 1;

    let previousTime = 0;


    function animate(timestamp) {

      if (uluruWalkStopped) {
        return;
      }

      if (!previousTime) {
        previousTime = timestamp;
      }

      if (
        timestamp - previousTime >=
        interval
      ) {

        previousTime = timestamp;


        /* ==================== FINISHED ==================== */

        if (
          index >=
          coordinates.length
        ) {

          uluruWalkAnimation = null;

          updateUluruWalkProgress(
            100,
            displayDistance,
            displayDistance
          );

          const status =
            document.getElementById(
              'uluruWalkStatus'
            );

          if (status) {

            status.textContent =
              'Uluru Base Walk completed';

          }

          const button =
            document.getElementById(
              'stopUluruWalkButton'
            );

          if (button) {

            button.innerHTML =
              '<span>✓</span> Close';

            button.onclick =
              closeUluruWalkUI;

          }

          return;

        }


        /* ==================== NEXT POINT ==================== */

        const coordinate =
          coordinates[index];

        progressCoordinates.push(
          coordinate
        );


        /* ==================== DRAW PROGRESS ==================== */

        progressSource.setData({

          type: 'Feature',

          properties: {},

          geometry: {

            type: 'LineString',

            coordinates:
              progressCoordinates

          }

        });


        /* ==================== MOVE WALKER ==================== */

        if (uluruWalkerMarker) {

          uluruWalkerMarker
            .setLngLat(
              coordinate
            );

        }


        /* ==================== UPDATE NUMBERS ==================== */

        const routeProgress =
          cumulativeDistances[index] /
          geometryDistance;

        const percentage =
          Math.min(
            routeProgress * 100,
            100
          );

        const travelled =
          routeProgress *
          displayDistance;

        updateUluruWalkProgress(
          percentage,
          travelled,
          displayDistance
        );

        index++;

      }


      uluruWalkAnimation =
        requestAnimationFrame(
          animate
        );

    }


    uluruWalkAnimation =
      requestAnimationFrame(
        animate
      );


  } catch (error) {

    console.error(
      'Uluru walk animation error:',
      error
    );

    exitUluruWalkMode();

  }

}


/* =========================================================
   GLOBAL WALK FUNCTIONS
   ========================================================= */

window.startUluruWalk = startUluruWalk;
window.stopUluruWalk = stopUluruWalk;


/* =========================================================
   ADD TRAVEL MAP LAYERS
   ========================================================= */

function addTravelLayers() {

  if (!map || !currentFilteredData) return;


  /* ==================== GEOJSON SOURCE ==================== */

  if (!map.getSource('travel-places')) {

    map.addSource('travel-places', {
      type: 'geojson',
      data: currentFilteredData,
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 60
    });

  } else {

    map.getSource('travel-places').setData(currentFilteredData);

  }



  /* ==================== CLUSTER CIRCLES ==================== */

  if (!map.getLayer('clusters')) {

    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'travel-places',
      filter: ['has', 'point_count'],

      paint: {
        'circle-color': '#2878ed',
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 25, 30, 31, 100, 38],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

  }


  /* ==================== CLUSTER NUMBERS ==================== */

  if (!map.getLayer('cluster-count')) {

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'travel-places',
      filter: ['has', 'point_count'],

      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Regular'],
        'text-size': 16,
        'text-allow-overlap': true
      },

      paint: {
        'text-color': '#ffffff'
      }
    });

  }


  /* ==================== INDIVIDUAL MARKERS ==================== */

  if (!map.getLayer('unclustered-point')) {

    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'travel-places',
      filter: ['!', ['has', 'point_count']],

      paint: {
        'circle-color': [
          'case',
          ['in', 'city', ['downcase', ['coalesce', ['get', 'category'], '']]], '#2878ed',
          ['in', 'culture', ['downcase', ['coalesce', ['get', 'category'], '']]], '#8f4ae8',
          ['in', 'nature', ['downcase', ['coalesce', ['get', 'category'], '']]], '#23a55a',
          '#ef476f'
        ],

        'circle-radius': 9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

  }

}


/* =========================================================
   TRAVEL MAP INTERACTIONS
   ========================================================= */

function bindTravelInteractions() {

  const hoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 14,
    className: 'place-hover-popup'
  });


  /* ==================== CLUSTER CLICK ==================== */

  map.on('click', 'clusters', async event => {

    const features = map.queryRenderedFeatures(event.point, {
      layers: ['clusters']
    });

    if (!features.length) return;

    const clusterId = features[0].properties.cluster_id;
    const source = map.getSource('travel-places');

    if (!source) return;

    try {

      const zoom = await source.getClusterExpansionZoom(clusterId);

      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom,
        duration: 750
      });

    } catch (error) {

      console.error('Cluster expansion error:', error);

    }

  });


  /* ==================== PLACE CLICK ==================== */

  map.on('click', 'unclustered-point', event => {

    if (!event.features || !event.features.length || !travelData) return;

    const clickedName = event.features[0].properties.name;

    // Always retrieve ORIGINAL GeoJSON feature so links/photos/videos stay intact.
    const originalFeature = travelData.features.find(feature => {
      return feature.properties && feature.properties.name === clickedName;
    });

    if (!originalFeature) {
      console.error(`Could not find original GeoJSON data for: ${clickedName}`);
      return;
    }

    openDashboard(originalFeature.properties);

  });


  /* ==================== PLACE HOVER ==================== */

  map.on('mouseenter', 'unclustered-point', event => {

    map.getCanvas().style.cursor = 'pointer';

    if (!event.features || !event.features.length) return;

    const feature = event.features[0];
    const name = feature.properties.name || 'Location';

    hoverPopup
      .setLngLat(feature.geometry.coordinates.slice())
      .setHTML(`<div class="hover-place-name">${name}</div>`)
      .addTo(map);

  });

  map.on('mouseleave', 'unclustered-point', () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });


  /* ==================== CLUSTER POINTER ==================== */

  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
  });

}


/* =========================================================
   BASEMAP SWITCHING
   ========================================================= */

function setBasemap(selectedBasemap) {

  map.setLayoutProperty('basemap-map-layer', 'visibility', 'none');
  map.setLayoutProperty('basemap-satellite-layer', 'visibility', 'none');
  map.setLayoutProperty('basemap-terrain-layer', 'visibility', 'none');

  map.setLayoutProperty(
    `basemap-${selectedBasemap}-layer`,
    'visibility',
    'visible'
  );

}


/* =========================================================
   MAP / SATELLITE / TERRAIN BUTTONS
   ========================================================= */

document.querySelectorAll('.style-button').forEach(button => {

  button.addEventListener('click', () => {

    const selectedBasemap = button.dataset.style;

    if (!['map', 'satellite', 'terrain'].includes(selectedBasemap)) return;

    document.querySelectorAll('.style-button').forEach(item => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    setBasemap(selectedBasemap); // Only basemap visibility changes; markers stay.

  });

});


/* =========================================================
   CATEGORY FILTER
   ========================================================= */

document.querySelectorAll('.category-button').forEach(button => {

  button.addEventListener('click', () => {

    activeCategory = button.dataset.category;

    document.querySelectorAll('.category-button').forEach(item => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    applyFilters();

  });

});


/* =========================================================
   FILTER ENGINE
   ========================================================= */

function applyFilters() {

  if (!travelData) return;

  currentFilteredData = {
    type: 'FeatureCollection',

    features: travelData.features.filter(feature => {

      const properties = feature.properties;
      const category = (properties.category || '').toLowerCase();

      const categoryOK =
        activeCategory === 'All' ||
        category.includes(activeCategory.toLowerCase());

      const yearOK =
        activeYear === 'All' ||
        (properties.visited || '').includes(activeYear);

      return categoryOK && yearOK;

    })
  };

  const source = map.getSource('travel-places');

  if (source) source.setData(currentFilteredData);

}


/* =========================================================
   SEARCH
   ========================================================= */

const searchInput = document.getElementById('placeSearch');
const suggestionBox = document.getElementById('searchSuggestions');

searchInput.addEventListener('input', renderSearchSuggestions);


function renderSearchSuggestions() {

  suggestionBox.innerHTML = '';

  if (!travelData) return;

  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    suggestionBox.classList.remove('active');
    return;
  }

  const matches = travelData.features
    .filter(feature => {

      const p = feature.properties;

      return (
        (p.name || '').toLowerCase().includes(query) ||
        (p.category || '').toLowerCase().includes(query)
      );

    })
    .slice(0, 6);

  if (!matches.length) {
    suggestionBox.classList.remove('active');
    return;
  }

  matches.forEach(feature => {

    const p = feature.properties;
    const button = document.createElement('button');

    button.className = 'search-result';

    button.innerHTML = `
      <span class="search-result-name">${p.name}</span>
      <span class="search-result-category">${p.category || ''}</span>
    `;

    button.addEventListener('click', () => {

      suggestionBox.classList.remove('active');
      searchInput.value = p.name;

      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 9,
        duration: 1200
      });

      setTimeout(() => openDashboard(p), 850);

    });

    suggestionBox.appendChild(button);

  });

  suggestionBox.classList.add('active');

}


/* =========================================================
   RECENT PLACES
   ========================================================= */

function buildRecentPlaces() {

  const recentList = document.getElementById('recentList');

  if (!recentList || !travelData) return;

  recentList.innerHTML = '';

  travelData.features
    .slice()

    .reverse()
    .slice(0, 6)
    .forEach(feature => {

      const p = feature.properties;
      const photos = getMediaArray(p, 'photos', 'photo');

      /* Prefer the dedicated hero image.
         If none exists, fall back to the first gallery photo. */
      const cardImage = p.heroPhoto ? p.heroPhoto : (photos[0] || '');

      const card = document.createElement('div');
      card.className = 'recent-card';

      card.innerHTML = `
        ${cardImage ? `
          <img
            src="${cardImage}"
            alt="${p.name || 'Travel destination'}"
            draggable="false"
          >
        ` : ''}

        <div class="recent-card-overlay">
          <div class="recent-card-name">${p.name || ''}</div>
          <div class="recent-card-category">${p.category || ''}</div>
        </div>
      `;

      card.addEventListener('click', () => {

        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: 9,
          duration: 1100
        });

        setTimeout(() => openDashboard(p), 750);

      });

      recentList.appendChild(card);

    });

}

/* =========================================================
   MAIN MENU
   ========================================================= */

const mainMenuItems = document.querySelectorAll('.menu-item');
const menuPanel = document.getElementById('menuPanel');
const menuPanelContent = document.getElementById('menuPanelContent');


mainMenuItems.forEach(item => {

  item.addEventListener('click', () => {

    mainMenuItems.forEach(menuItem => {
      menuItem.classList.remove('active');
    });

    item.classList.add('active');

    const menu = item.dataset.menu;

    switch (menu) {

      case 'explore':

        closeMenuPanel();

        map.flyTo({
          center: [134.5, -27.5],
          zoom: 3.5,
          duration: 900
        });

        break;


      case 'trips':
        showTripsPanel();
        break;


      case 'wishlist':
        showWishlistPanel();
        break;


      case 'timeline':
        showTimelinePanel();
        break;


      case 'statistics':
        showStatisticsPanel();
        break;


      case 'about':

        showMenuPanel(
          'About',
          `
            <p>This is a visual travel map built around interactive locations, photos and short videos.</p>
            <p>Click a destination on the map to open its visual dashboard.</p>
          `
        );

        break;


      case 'disclaimer':

        showMenuPanel(
          'Disclaimer',
          `
            <p>The information presented on this travel map is provided for general travel inspiration and informational purposes only.</p>

            <p>While reasonable care is taken to keep information accurate and useful, travel conditions, prices, opening hours, access requirements, road conditions, park regulations and other information may change without notice.</p>

            <p>Visitors should always verify important information with official tourism authorities, park agencies, accommodation providers and other relevant organisations before travelling.</p>

            <p>Photos, videos and personal observations presented on this website reflect experiences at the time of visiting and may not represent current conditions.</p>

            <p>External links are provided for convenience. This website is not responsible for the content, accuracy or availability of third-party websites.</p>
          `
        );

        break;


      case 'settings':
        showSettingsPanel();
        break;

    }

  });

});


/* =========================================================
   MENU PANEL FUNCTIONS
   ========================================================= */

function showMenuPanel(title, content) {

  if (!menuPanel || !menuPanelContent) return;

  menuPanelContent.innerHTML = `
    <h2>${title}</h2>
    ${content}
  `;

  menuPanel.classList.add('active');

}


function closeMenuPanel() {

  if (!menuPanel) return;

  menuPanel.classList.remove('active');

}


const closeMenuPanelButton = document.getElementById('closeMenuPanel');

if (closeMenuPanelButton) {
  closeMenuPanelButton.addEventListener('click', closeMenuPanel);
}


/* =========================================================
   TRIPS
   ========================================================= */

function showTripsPanel() {

  if (!travelData) return;

  const trips = [
    ...new Set(
      travelData.features
        .map(feature => feature.properties.trip)
        .filter(Boolean)
    )
  ];

  if (!trips.length) {

    showMenuPanel(
      'Trips',
      `
        <p>No grouped trips have been added yet.</p>
        <p>Later you can add <strong>"trip": "Uluru 2026"</strong> to each GeoJSON location.</p>
      `
    );

    return;
  }

  const html = trips
    .map(trip => `<div class="utility-item">${trip}</div>`)
    .join('');

  showMenuPanel('Trips', html);

}


/* =========================================================
   WISHLIST
   ========================================================= */

function getWishlist() {

  try {
    return JSON.parse(localStorage.getItem('travel-wishlist') || '[]');
  } catch {
    return [];
  }

}


function showWishlistPanel() {

  const wishlist = getWishlist();

  if (!wishlist.length) {
    showMenuPanel('Wishlist', '<p>No saved places yet.</p>');
    return;
  }

  const html = wishlist
    .map(place => `<div class="utility-item">${place}</div>`)
    .join('');

  showMenuPanel('Wishlist', html);

}


/* =========================================================
   TIMELINE
   ========================================================= */

function showTimelinePanel() {

  if (!travelData) return;

  const years = [
    ...new Set(
      travelData.features
        .map(feature => {

          const match = (feature.properties.visited || '').match(/\b20\d{2}\b/);

          return match ? match[0] : null;

        })
        .filter(Boolean)
    )
  ].sort();

  const buttons = years
    .map(year => `
      <button class="timeline-year ${activeYear === year ? 'active' : ''}" data-year="${year}">
        ${year}
      </button>
    `)
    .join('');

  showMenuPanel(
    'Timeline',
    `
      <p>Filter places by the year you visited.</p>

      <div class="timeline-buttons">
        <button class="timeline-year ${activeYear === 'All' ? 'active' : ''}" data-year="All">All</button>
        ${buttons}
      </div>
    `
  );

  menuPanel.querySelectorAll('.timeline-year').forEach(button => {

    button.addEventListener('click', () => {

      activeYear = button.dataset.year;

      applyFilters();

      showTimelinePanel();

    });

  });

}


/* =========================================================
   STATISTICS PANEL
   ========================================================= */

function showStatisticsPanel() {

  if (!travelData) return;

  let photos = 0;
  let videos = 0;

  travelData.features.forEach(feature => {

    photos += getMediaArray(feature.properties, 'photos', 'photo').length;
    videos += getMediaArray(feature.properties, 'videos', 'video').length;

  });

  showMenuPanel(
    'Statistics',
    `
      <div class="utility-item">Places: <strong>${travelData.features.length}</strong></div>
      <div class="utility-item">Photos: <strong>${photos}</strong></div>
      <div class="utility-item">Videos: <strong>${videos}</strong></div>
    `
  );

}


/* =========================================================
   SETTINGS
   ========================================================= */

function showSettingsPanel() {

  showMenuPanel(
    'Settings',
    `
      <button id="resetMapButton" class="timeline-year">Reset map</button>
      <button id="clearFiltersButton" class="timeline-year">Clear filters</button>
    `
  );

  const resetMapButton = document.getElementById('resetMapButton');
  const clearFiltersButton = document.getElementById('clearFiltersButton');

  if (resetMapButton) {

    resetMapButton.addEventListener('click', () => {

      map.flyTo({
        center: [134.5, -27.5],
        zoom: 3.5
      });

    });

  }

  if (clearFiltersButton) {

    clearFiltersButton.addEventListener('click', () => {

      activeCategory = 'All';
      activeYear = 'All';

      document.querySelectorAll('.category-button').forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.category === 'All'
        );

      });

      applyFilters();

    });

  }

}


/* =========================================================
   MEDIA ARRAY HELPER
   ========================================================= */

function getMediaArray(properties, pluralName, singularName) {

  const plural = properties[pluralName];

  if (Array.isArray(plural)) return plural;

  if (typeof plural === 'string' && plural.trim()) {

    try {

      const parsed = JSON.parse(plural);

      if (Array.isArray(parsed)) return parsed;

    } catch {}

  }

  const single = properties[singularName];

  return single ? [single] : [];

}


/* =========================================================
   LINKS ARRAY HELPER
   ========================================================= */

function getLinksArray(properties) {

  if (!properties) return [];

  if (Array.isArray(properties.links)) return properties.links;

  if (typeof properties.links === 'string' && properties.links.trim()) {

    try {

      const parsed = JSON.parse(properties.links);

      if (Array.isArray(parsed)) return parsed;

    } catch (error) {

      console.error(`Could not parse links for ${properties.name}:`, error);

    }

  }

  return [];

}


/* =========================================================
   DASHBOARD ELEMENTS
   ========================================================= */

const dashboard = document.getElementById('travelDashboard');
const backdrop = document.getElementById('overlayBackdrop');
const heroPhoto = document.getElementById('heroPhoto');
const photoGallery = document.getElementById('photoGallery');
const videoGallery = document.getElementById('videoGallery');


/* =========================================================
   OPEN DASHBOARD
   ========================================================= */

function openDashboard(properties) {

  if (!properties) return;

  const photos = getMediaArray(properties, 'photos', 'photo');
  const videos = getMediaArray(properties, 'videos', 'video');
  const currentPlace = travelData.features.find(feature =>
  feature.properties.name === properties.name
);

const links = currentPlace?.properties?.links || [];

    /* ==================== TEMPORARY LINK DIAGNOSTIC ==================== */

  console.log('==============================');
  console.log('OPENING PLACE:', properties.name);
  console.log('DIRECT properties.links:', properties.links);
  console.log('PROCESSED links:', links);

  const diagnosticFeature = travelData?.features?.find(feature => {
    return feature.properties?.name === properties.name;
  });

  console.log('ORIGINAL FEATURE:', diagnosticFeature);
  console.log('ORIGINAL FEATURE LINKS:', diagnosticFeature?.properties?.links);
  console.log('==============================');


  /* ==================== TITLE ==================== */

  const dashboardPlaceName = document.getElementById('dashboardPlaceName');

  if (dashboardPlaceName) {
    dashboardPlaceName.textContent =
      properties.title ||
      properties.name ||
      'Location';
  }


  /* ==================== HERO DESCRIPTION ==================== */

  const heroDescription = document.getElementById('heroDescription');

  if (heroDescription) {
    heroDescription.textContent =
      properties.heroDescription ||
      properties.aboutPreview ||
      '';
  }


  /* ==================== HERO PHOTO ==================== */

  if (heroPhoto) {

    if (photos.length > 0) {

      heroPhoto.src = properties.heroPhoto || photos[0];
      heroPhoto.alt = properties.name || 'Travel photo';
      heroPhoto.style.display = 'block';

    } else {

      heroPhoto.removeAttribute('src');
      heroPhoto.style.display = 'none';

    }

  }


  /* ==================== COUNTS ==================== */

  setText('heroPhotoCount', `${photos.length} Photos`);
  setText('heroVideoCount', `${videos.length} Videos`);
  setText('quickVisited', properties.visited || 'Not specified');
  setText('quickCategory', properties.category || 'Travel');
  setText('quickPhotos', photos.length);
  setText('quickVideos', videos.length);


  /* ==================== ABOUT ==================== */

  setText('aboutHeading', `About ${properties.name || ''}`);

  setText(
    'aboutPreview',
    properties.aboutPreview ||
    createDescriptionPreview(
      properties.description ||
      properties.aboutFull ||
      ''
    )
  );

  const aboutFull = document.getElementById('aboutFull');

  if (aboutFull) {
    aboutFull.innerHTML =
      properties.aboutFull ||
      properties.description ||
      '';

    aboutFull.classList.remove('visible');
  }

  setText('readMoreButton', 'Read more ↓');


  /* ==================== BEST TIME ==================== */

  setText(
    'bestTime',
    properties.bestTime ||
    'Check seasonal conditions before travelling.'
  );


  /* ==================== INFO TAB ==================== */

  setText(
    'infoGettingThere',
    properties.gettingThere ||
    'Information not added yet.'
  );

  setText(
    'infoStayingNearby',
    properties.stayingNearby ||
    'Information not added yet.'
  );

  setText(
    'infoExploreNearby',
    properties.exploreNearby ||
    'Information not added yet.'
  );

  setText(
    'infoPlanVisit',
    properties.planVisit ||
    'Information not added yet.'
  );

  setText(
    'infoCulturalNote',
    properties.culturalNote ||
    'Information not added yet.'
  );


  /* ==================== PHOTO GALLERY ==================== */

   if (photoGallery) {
   
     photoGallery.innerHTML = '';
   
     photos.forEach((photo, photoIndex) => {
   
       const image = document.createElement('img');
   
       image.src = photo;
       image.alt = properties.name || 'Travel photo';
       image.className = 'gallery-photo';
       image.draggable = false;
       image.loading = 'lazy';
   
       image.addEventListener('contextmenu', event => {
         event.preventDefault();
       });
   
       image.addEventListener('click', () => {
   
         openLightboxGallery(
           photos,
           photoIndex,
           properties.name
         );
   
       });
   
       photoGallery.appendChild(image);
   
     });
   
   }

  /* ==================== VIDEO GALLERY ==================== */

  if (videoGallery) {

    videoGallery.innerHTML = '';

    videos.forEach(video => {

      const card = document.createElement('div');

      card.className = 'video-card';

      card.innerHTML = `
        <video
          controls
          controlsList="nodownload"
          disablePictureInPicture
          playsinline
          preload="metadata"
          oncontextmenu="return false;"
        >
          <source src="${video}" type="video/mp4">
        </video>
      `;

      videoGallery.appendChild(card);

    });

  }


/* ==================== OFFICIAL LINKS ==================== */

const linksList = document.getElementById('dashboardLinksList');

if (linksList) {

  linksList.innerHTML = '';

  links.forEach(link => {

    if (!link || !link.url) return;

    const element = document.createElement('a');

    element.className = 'dashboard-resource-link';
    element.href = link.url;
    element.target = '_blank';
    element.rel = 'noopener noreferrer';

    element.innerHTML = `
      <span class="resource-icon">${link.icon || '🔗'}</span>
      <span class="resource-name">${link.name || 'Official resource'}</span>
      <span class="resource-arrow">↗</span>
    `;

    linksList.appendChild(element);

  });

}


/* ==================== SHOW DASHBOARD ==================== */

populateExperiencePlanExplore(properties);
populateFascinatingFacts(properties);
showDashboardTab('experience');

if (dashboard) dashboard.classList.add('active');
if (backdrop) backdrop.classList.add('active');

} // End openDashboard()



/* =========================================================
   SAFE TEXT HELPER
   ========================================================= */

function setText(id, value) {

  const element = document.getElementById(id);

  if (element) element.textContent = value;

}


/* =========================================================
   DESCRIPTION PREVIEW
   ========================================================= */

function createDescriptionPreview(html) {

  const temporary = document.createElement('div');

  temporary.innerHTML = html;

  const text = (
    temporary.textContent ||
    temporary.innerText ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= 260) return text;

  return `${text.slice(0, 260).trim()}…`;

}


/* =========================================================
   STRIP HTML
   ========================================================= */

function stripHTML(html) {

  const temporary = document.createElement('div');

  temporary.innerHTML = html;

  return temporary.textContent || temporary.innerText || '';

}


/* =========================================================
   CLOSE DASHBOARD
   ========================================================= */

function closeDashboard() {

  if (dashboard) dashboard.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');

  if (dashboard) {

    dashboard.querySelectorAll('video').forEach(video => {
      video.pause();
    });

  }

}


const closeDashboardButton = document.getElementById('closeDashboard');

if (closeDashboardButton) {
  closeDashboardButton.addEventListener('click', closeDashboard);
}

if (backdrop) {
  backdrop.addEventListener('click', closeDashboard);
}


/* =========================================================
   READ MORE / SHOW LESS
   ========================================================= */

const readMoreButton = document.getElementById('readMoreButton');

if (readMoreButton) {

  readMoreButton.addEventListener('click', function () {

    const full = document.getElementById('aboutFull');

    if (!full) return;

    const visible = full.classList.toggle('visible');

    this.textContent =
      visible
        ? 'Show less ↑'
        : 'Read more ↓';

  });

}


/* =========================================================
   PHOTO LIGHTBOX GALLERY
   Previous / Next + Keyboard + Mobile Swipe
   ========================================================= */

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const closeLightboxButton = document.getElementById('closeLightbox');

let lightboxPhotos = [];
let lightboxCurrentIndex = 0;
let lightboxPlaceName = 'Travel photo';

let lightboxTouchStartX = 0;
let lightboxTouchEndX = 0;


/* =========================================================
   OPEN GALLERY
   ========================================================= */

function openLightboxGallery(
  photos,
  startIndex = 0,
  placeName = 'Travel photo'
) {

  if (!lightbox || !lightboxImage) return;

  lightboxPhotos = photos;
  lightboxCurrentIndex = startIndex;
  lightboxPlaceName = placeName;

  updateLightboxImage();

  lightbox.classList.add('active');
  document.body.classList.add('lightbox-open');

}


/* =========================================================
   UPDATE CURRENT PHOTO
   ========================================================= */

function updateLightboxImage() {

  if (!lightboxImage || !lightboxPhotos.length) return;

  const photo =
    lightboxPhotos[lightboxCurrentIndex];

  lightboxImage.src = photo;

  lightboxImage.alt =
    `${lightboxPlaceName} photo ${lightboxCurrentIndex + 1}`;

  const counter =
    document.getElementById('lightboxCounter');

  if (counter) {

    counter.textContent =
      `${lightboxCurrentIndex + 1} / ${lightboxPhotos.length}`;

  }

}


/* =========================================================
   NEXT PHOTO
   ========================================================= */

function showNextLightboxPhoto() {

  if (!lightboxPhotos.length) return;

  lightboxCurrentIndex =
    (lightboxCurrentIndex + 1) %
    lightboxPhotos.length;

  updateLightboxImage();

}


/* =========================================================
   PREVIOUS PHOTO
   ========================================================= */

function showPreviousLightboxPhoto() {

  if (!lightboxPhotos.length) return;

  lightboxCurrentIndex =
    (lightboxCurrentIndex - 1 + lightboxPhotos.length) %
    lightboxPhotos.length;

  updateLightboxImage();

}


/* =========================================================
   CLOSE LIGHTBOX
   ========================================================= */

function closeLightbox() {

  if (!lightbox) return;

  lightbox.classList.remove('active');

  document.body.classList.remove('lightbox-open');

  setTimeout(() => {

    if (lightboxImage) {
      lightboxImage.src = '';
    }

    lightboxPhotos = [];
    lightboxCurrentIndex = 0;

  }, 200);

}


/* =========================================================
   PREVIOUS / NEXT BUTTONS
   ========================================================= */

const lightboxPreviousButton =
  document.getElementById('lightboxPrevious');

const lightboxNextButton =
  document.getElementById('lightboxNext');


if (lightboxPreviousButton) {

  lightboxPreviousButton.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      showPreviousLightboxPhoto();

    }
  );

}


if (lightboxNextButton) {

  lightboxNextButton.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      showNextLightboxPhoto();

    }
  );

}


/* =========================================================
   CLOSE BUTTON
   ========================================================= */

if (closeLightboxButton) {

  closeLightboxButton.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      closeLightbox();

    }
  );

}


/* =========================================================
   CLICK BACKGROUND TO CLOSE
   ========================================================= */

if (lightbox) {

  lightbox.addEventListener(
    'click',
    event => {

      if (event.target === lightbox) {

        closeLightbox();

      }

    }
  );

}


/* =========================================================
   KEYBOARD NAVIGATION
   ========================================================= */

document.addEventListener(
  'keydown',
  event => {

    if (
      !lightbox ||
      !lightbox.classList.contains('active')
    ) {
      return;
    }


    /* RIGHT ARROW */

    if (event.key === 'ArrowRight') {

      event.preventDefault();

      showNextLightboxPhoto();

    }


    /* LEFT ARROW */

    if (event.key === 'ArrowLeft') {

      event.preventDefault();

      showPreviousLightboxPhoto();

    }

  }
);


/* =========================================================
   MOBILE SWIPE
   ========================================================= */

if (lightbox) {

  lightbox.addEventListener(
    'touchstart',
    event => {

      lightboxTouchStartX =
        event.changedTouches[0].screenX;

    },
    { passive: true }
  );


  lightbox.addEventListener(
    'touchend',
    event => {

      lightboxTouchEndX =
        event.changedTouches[0].screenX;

      const swipeDistance =
        lightboxTouchEndX -
        lightboxTouchStartX;


      /* Ignore very small finger movements */

      if (Math.abs(swipeDistance) < 50) {
        return;
      }


      /* Swipe left = next photo */

      if (swipeDistance < 0) {

        showNextLightboxPhoto();

      }


      /* Swipe right = previous photo */

      if (swipeDistance > 0) {

        showPreviousLightboxPhoto();

      }

    },
    { passive: true }
  );

}

/* =========================================================
   EXPERIENCE / PLAN / EXPLORE DATA
   ========================================================= */

function normaliseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function renderSimpleList(id, value, emptyText = 'More information will be added soon.') {
  const element = document.getElementById(id);
  if (!element) return;

  const items = normaliseList(value);

  if (!items.length) {
    element.innerHTML = `<p class="empty-feature-text">${emptyText}</p>`;
    return;
  }

  element.innerHTML = `
    <ul class="feature-list">
      ${items.map(item => {
        if (typeof item === 'string') return `<li>${item}</li>`;
        return `<li>${item.name || item.title || ''}</li>`;
      }).join('')}
    </ul>
  `;
}

function getNestedValue(object, keys, fallback = '') {
  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ''
    ) {
      return object[key];
    }
  }

  return fallback;
}

/* =========================================================
   POPULATE EXPERIENCE / PLAN / EXPLORE
   ========================================================= */

function populateExperiencePlanExplore(properties) {

  if (!properties) return;

  const experience = properties.experience || {};
  const plan = properties.plan || {};
  const explore = properties.explore || {};

  const photos = getMediaArray(properties, 'photos', 'photo');
  const videos = getMediaArray(properties, 'videos', 'video');


  /* =======================================================
     EXPERIENCE
     ======================================================= */

  setText(
    'experienceSummary',
    experience.summary ||
    properties.aboutPreview ||
    `My experience at ${properties.name || 'this place'}.`
  );

  setText(
    'experiencePhotoLabel',
    `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
  );

  setText(
    'experienceVideoLabel',
    `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`
  );

  renderSimpleList(
    'experienceSurprised',
    experience.surprisedMe,
    'Personal observations will be added soon.'
  );

  renderSimpleList(
    'experienceLearned',
    experience.whatILearned,
    'What I learned will be added soon.'
  );

  renderSimpleList(
    'experienceDifferent',
    experience.whatIdDoDifferently,
    'Notes will be added after reviewing the trip.'
  );

  renderSimpleList(
    'experienceEnvironment',
    experience.environmentalObservations || experience.observations,
    'Environmental observations will be added soon.'
  );


  /* =======================================================
     PLAN — BEST TIME
     ======================================================= */

  const bestSeason = plan.bestSeason || {};

  setText(
    'planBestTime',
    bestSeason.summary ||
    plan.bestTime ||
    properties.bestTime ||
    'Check seasonal conditions before travelling.'
  );


  /* =======================================================
     PLAN — CLIMATE
     ======================================================= */

  const climate = plan.climate || {};

  setText(
    'planClimate',
    climate.summary ||
    'Climate information will be added soon.'
  );

  const climateLink = document.getElementById('planClimateLink');

  if (climateLink) {
    if (climate.sourceUrl) {
      climateLink.href = climate.sourceUrl;
      climateLink.textContent =
        climate.sourceName || 'View detailed climate statistics →';
      climateLink.style.display = 'inline-block';
    } else {
      climateLink.style.display = 'none';
    }
  }


  /* =======================================================
     PLAN — ACCESS
     ======================================================= */

  const access = plan.access || {};

  setText(
    'planAccess',
    access.summary ||
    plan.gettingThere ||
    properties.gettingThere ||
    'Information not added yet.'
  );


  /* =======================================================
     PLAN — FACILITIES
     ======================================================= */

  renderSimpleList(
    'planFacilities',
    plan.facilities,
    'Facilities information will be added soon.'
  );


  /* =======================================================
     PLAN — SAFETY
     ======================================================= */

  renderSimpleList(
    'planSafety',
    plan.safety,
    'Check current official advice before travelling.'
  );


  /* =======================================================
     PLAN — MOBILE COVERAGE
     ======================================================= */

  setText(
    'planMobile',
    plan.mobileCoverage ||
    'Information not added yet.'
  );


  /* =======================================================
     PLAN — WHAT TO PACK
     ======================================================= */

  renderSimpleList(
    'planPacking',
    plan.whatToPack,
    'Packing information will be added soon.'
  );


  /* =======================================================
     PLAN — PERMITS / PARK PASS
     ======================================================= */

  setText(
    'planPermits',
    plan.permits ||
    'Check whether passes or permits are required.'
  );


  /* =======================================================
     PLAN — COST
     ======================================================= */

  setText(
    'planCost',
    plan.cost ||
    'Information not added yet.'
  );


  /* =======================================================
     PLAN — GETTING THERE
     ======================================================= */

  setText(
    'infoGettingThere',
    plan.gettingThere ||
    access.summary ||
    properties.gettingThere ||
    'Information not added yet.'
  );


  /* =======================================================
     PLAN — STAYING NEARBY
     ======================================================= */

  setText(
    'infoStayingNearby',
    plan.stayingNearby ||
    properties.stayingNearby ||
    'Information not added yet.'
  );


  /* =======================================================
     PLAN — PLANNING
     ======================================================= */

  setText(
    'infoPlanVisit',
    plan.planVisit ||
    properties.planVisit ||
    'Information not added yet.'
  );


  /* =======================================================
     PLAN — CULTURAL RESPECT
     ======================================================= */

  setText(
    'infoCulturalNote',
    plan.culturalConsiderations ||
    plan.culturalNote ||
    properties.culturalNote ||
    'Information not added yet.'
  );


  /* =======================================================
     EXPLORE — NEARBY EXPERIENCES
     ======================================================= */

  const nearbyElement = document.getElementById('infoExploreNearby');
  const nearbyPlaces = Array.isArray(explore.nearbyPlaces)
    ? explore.nearbyPlaces
    : [];

  if (nearbyElement) {
    if (nearbyPlaces.length) {
      nearbyElement.innerHTML = nearbyPlaces.map(place => `
        <div class="explore-nearby-item">
          ${place.description ? `<p>${place.description}</p>` : `
            <p>
              ${place.name || 'Nearby place'}
              ${place.distance ? ` — ${place.distance}` : ''}
            </p>
          `}
        </div>
      `).join('');
    } else {
      nearbyElement.innerHTML = `
        <p class="empty-feature-text">Nearby experiences will be added soon.</p>
      `;
    }
  }


  /* =======================================================
     EXPLORE — EVENTS
     ======================================================= */

  const eventsElement = document.getElementById('exploreEvents');
  const events = explore.events || {};

  if (eventsElement) {
    if (events.summary) {
      eventsElement.innerHTML = `
        <p>${events.summary}</p>

        ${events.sourceUrl ? `
          <a href="${events.sourceUrl}"
             target="_blank"
             rel="noopener noreferrer"
             class="explore-source-link">
            ${events.sourceName || 'View current events'} →
          </a>
        ` : ''}
      `;
    } else {
      eventsElement.innerHTML = `
        <p class="empty-feature-text">Events will be added soon.</p>
      `;
    }
  }


  /* =======================================================
     EXPLORE — WALKS
     ======================================================= */

  const walksElement = document.getElementById('exploreWalks');
  const walks = Array.isArray(explore.walks)
    ? explore.walks
    : [];

  if (walksElement) {

    if (walks.length) {

      walksElement.innerHTML = walks.map(walk => {

        const meta = [
          walk.distance,
          walk.duration,
          walk.difficulty
        ].filter(Boolean);

        return `
          <div class="explore-walk-item">

            <h4>${walk.name || 'Walk'}</h4>

            ${meta.length ? `
              <div class="explore-walk-meta">
                ${meta.map(item => `<span>${item}</span>`).join('')}
              </div>
            ` : ''}

            ${walk.description ? `
              <p>${walk.description}</p>
            ` : ''}

            ${walk.animated === true ? `
              <button
                type="button"
                class="explore-walk-button"
                data-walk-id="${walk.id || ''}">
                ${walk.buttonText || 'View animated walk'} →
              </button>
            ` : ''}

          </div>
        `;
      }).join('');


      /* -----------------------------------------------
         WALK BUTTONS
         ----------------------------------------------- */

      walksElement
        .querySelectorAll('.explore-walk-button')
        .forEach(button => {

          button.addEventListener('click', () => {

            const walkId = button.dataset.walkId;

            if (walkId === 'uluru-base-walk') {

              if (typeof startUluruWalk === 'function') {
                startUluruWalk();
              } else {
                console.error(
                  'Uluru Base Walk animation function was not found.'
                );
              }

            }

          });

        });

    } else {

      walksElement.innerHTML = `
        <p class="empty-feature-text">Walks will be added soon.</p>
      `;

    }
  }


  /* =======================================================
     EXPLORE — ROAD TRIPS
     ======================================================= */

  renderSimpleList(
    'exploreRoadTrips',
    explore.roadTrips,
    'Road trips will be added soon.'
  );


  /* =======================================================
     EXPLORE — NATURE
     ======================================================= */

  renderSimpleList(
    'exploreNature',
    explore.nature,
    'Nature experiences will be added soon.'
  );


  /* =======================================================
     EXPLORE — CULTURE & CITIES
     ======================================================= */

  renderSimpleList(
    'exploreCulture',
    explore.culture ||
    explore.cities ||
    explore.culturalExperiences,
    'Culture and city experiences will be added soon.'
  );

}

/* =========================================================
   10 FACTS
   Populated from properties.facts in places.geojson.
   ========================================================= */

function getFactsArray(properties) {

  if (!properties) return [];

  if (Array.isArray(properties.facts)) {
    return properties.facts.filter(Boolean);
  }

  if (typeof properties.facts === 'string' && properties.facts.trim()) {

    try {

      const parsed = JSON.parse(properties.facts);

      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }

    } catch (error) {

      console.error(
        `Could not parse facts for ${properties.name || 'destination'}:`,
        error
      );

    }

  }

  return [];

}


/* =========================================================
   CHECK SOURCE URL
   ========================================================= */

function isSafeExternalUrl(value) {

  if (!value || typeof value !== 'string') return false;

  try {

    const url = new URL(value, window.location.href);

    return url.protocol === 'http:' || url.protocol === 'https:';

  } catch {

    return false;

  }

}


/* =========================================================
   SHORT SOURCE NAME
   ========================================================= */

function getShortFactSourceName(sourceName, sourceUrl) {

  const name = (sourceName || '').toLowerCase();

  if (name.includes('parks australia')) {
    return 'Parks Australia';
  }

  if (name.includes('unesco')) {
    return 'UNESCO';
  }

  if (name.includes('australian government')) {
    return 'Australian Government';
  }

  if (name.includes('geoscience australia')) {
    return 'Geoscience Australia';
  }

  if (name.includes('wikipedia')) {
    return 'Wikipedia';
  }

  if (sourceName && sourceName.trim()) {
    return sourceName.trim();
  }

  if (sourceUrl) {

    try {

      return new URL(sourceUrl)
        .hostname
        .replace(/^www\./, '');

    } catch {}

  }

  return 'Source';
}


/* =========================================================
   POPULATE 10 FACTS
   ========================================================= */

function populateFascinatingFacts(properties) {

  const factsHeading =
    document.getElementById('factsHeading');

  const factsGrid =
    document.getElementById('factsGrid');

  const factsEmpty =
    document.getElementById('factsEmpty');

  const factsSection =
    document.getElementById('dashboardFacts');

  if (!factsGrid) return;


  /* ==================== GET FACTS ==================== */

  const facts = getFactsArray(properties);


  /* ==================== HEADING ==================== */

  if (factsHeading) {

    factsHeading.textContent =
      properties?.name
        ? `10 facts about ${properties.name}`
        : '10 facts';

  }


  /* ==================== SMALL KICKER ==================== */

  const factsKicker =
    factsSection?.querySelector('.section-kicker');

  if (factsKicker) {
    factsKicker.textContent = '10 FACTS';
  }


  /* ==================== LEFT NAVIGATION ==================== */

  const factsNavButton =
    document.querySelector(
      '.dashboard-nav-button[data-dashboard-tab="facts"]'
    );

  const factsNavLabel =
    factsNavButton?.querySelector('.dashboard-nav-label');

  if (factsNavLabel) {
    factsNavLabel.textContent = '10 Facts';
  }


  /* ==================== CLEAR OLD CARDS ==================== */

  factsGrid.innerHTML = '';


  /* ==================== NO FACTS ==================== */

  if (!facts.length) {

    factsGrid.style.display = 'none';

    if (factsEmpty) {
      factsEmpty.style.display = 'block';
    }

    return;
  }


  factsGrid.style.display = '';

  if (factsEmpty) {
    factsEmpty.style.display = 'none';
  }


  /* ==================== CREATE FACT CARDS ==================== */

  facts.slice(0, 10).forEach((fact, index) => {

    if (!fact) return;


    /* ---------- CARD ---------- */

    const card =
      document.createElement('article');

    card.className = 'fact-card';


    /* ---------- NUMBER ---------- */

    const number =
      document.createElement('div');

    number.className = 'fact-number';

    number.textContent = index + 1;


    /* ---------- CONTENT ---------- */

    const content =
      document.createElement('div');

    content.className = 'fact-content';


    /* ---------- TITLE ---------- */

    const title =
      document.createElement('h3');

    title.className = 'fact-title';

    title.textContent =
      fact.title || `Fact ${index + 1}`;


    /* ---------- DESCRIPTION ---------- */

    const text =
      document.createElement('p');

    text.className = 'fact-text';

    text.textContent =
      fact.text || '';


    content.appendChild(title);
    content.appendChild(text);


    /* ---------- SOURCE ---------- */

    if (isSafeExternalUrl(fact.sourceUrl)) {

      const source =
        document.createElement('a');

      source.className = 'fact-source';

      source.href = fact.sourceUrl;

      source.target = '_blank';

      source.rel = 'noopener noreferrer';

      source.textContent =
        `${getShortFactSourceName(
          fact.sourceName,
          fact.sourceUrl
        )} ↗`;

      content.appendChild(source);

    }


    /* ---------- BUILD CARD ---------- */

    card.appendChild(number);
    card.appendChild(content);

    factsGrid.appendChild(card);

  });

}


/* =========================================================
   DASHBOARD TABS
   EXPERIENCE / PLAN / EXPLORE / 10 FACTS
   ========================================================= */

function showDashboardTab(tabName) {

  /* ==================== TAB SECTIONS ==================== */

  const sections = {
    experience: document.getElementById('dashboardExperience'),
    plan: document.getElementById('dashboardPlan'),
    explore: document.getElementById('dashboardExplore'),
    facts: document.getElementById('dashboardFacts')
  };


  /* ==================== HIDE ALL SECTIONS ==================== */

  Object.values(sections).forEach(section => {

    if (!section) return;

    section.classList.remove('active');
    section.style.display = 'none';

  });


  /* ==================== SHOW SELECTED SECTION ==================== */

  const selectedSection = sections[tabName];

  if (selectedSection) {

    selectedSection.classList.add('active');
    selectedSection.style.display = 'block';

  }


  /* ==================== UPDATE LEFT NAVIGATION ==================== */

  document
    .querySelectorAll('.dashboard-nav-button')
    .forEach(button => {

      const isActive =
        button.dataset.dashboardTab === tabName;

      button.classList.toggle(
        'active',
        isActive
      );

    });


  /* ==================== RETURN CONTENT TO TOP ==================== */

  const dashboardMain =
    document.querySelector('.dashboard-main');

  if (dashboardMain) {

    dashboardMain.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }

}


/* =========================================================
   DASHBOARD NAVIGATION BUTTON CLICKS
   ========================================================= */

document
  .querySelectorAll('.dashboard-nav-button')
  .forEach(button => {

    button.addEventListener('click', event => {

      event.preventDefault();

      const tabName =
        button.dataset.dashboardTab;

      if (
        tabName !== 'experience' &&
        tabName !== 'plan' &&
        tabName !== 'explore' &&
        tabName !== 'facts'
      ) {
        return;
      }

      showDashboardTab(tabName);

    });

  });

/* =========================================================
   ESCAPE KEY
   ========================================================= */

document.addEventListener('keydown', event => {

  if (event.key !== 'Escape') return;


  /* Close lightbox first. */

  if (lightbox && lightbox.classList.contains('active')) {

    closeLightbox();

    return;

  }


  /* Then dashboard. */

  if (dashboard && dashboard.classList.contains('active')) {

    closeDashboard();

    return;

  }


  /* Otherwise close main menu panel. */

  closeMenuPanel();

});

/* =========================================================
   MOBILE MAP INTERACTION UI
   Temporarily hides recent cards while moving the map.
   ========================================================= */

function isMobileMapView() {
  return window.matchMedia('(max-width: 950px)').matches;
}

function hideMobileOverlayContent() {
  if (!isMobileMapView()) return;

  document.body.classList.add('map-interacting');
}

function showMobileOverlayContent() {
  if (!isMobileMapView()) return;

  document.body.classList.remove('map-interacting');
}

map.on('dragstart', hideMobileOverlayContent);
map.on('zoomstart', hideMobileOverlayContent);

map.on('dragend', () => {
  setTimeout(showMobileOverlayContent, 250);
});

map.on('zoomend', () => {
  setTimeout(showMobileOverlayContent, 250);
});

/* =========================================================
   MOBILE CONTROL PANEL
   ========================================================= */

const mobileMenuButton =
  document.getElementById('mobileMenuButton');

const mobileControlPanel =
  document.getElementById('mobileControlPanel');

const mobileControlBackdrop =
  document.getElementById('mobileControlBackdrop');

const closeMobileControlPanelButton =
  document.getElementById('closeMobileControlPanel');


function openMobileControlPanel() {

  if (mobileControlPanel) {
    mobileControlPanel.classList.add('active');
  }

  if (mobileControlBackdrop) {
    mobileControlBackdrop.classList.add('active');
  }

}


function closeMobileControlPanel() {

  if (mobileControlPanel) {
    mobileControlPanel.classList.remove('active');
  }

  if (mobileControlBackdrop) {
    mobileControlBackdrop.classList.remove('active');
  }

}


if (mobileMenuButton) {

  mobileMenuButton.addEventListener(
    'click',
    openMobileControlPanel
  );

}


if (closeMobileControlPanelButton) {

  closeMobileControlPanelButton.addEventListener(
    'click',
    closeMobileControlPanel
  );

}


if (mobileControlBackdrop) {

  mobileControlBackdrop.addEventListener(
    'click',
    closeMobileControlPanel
  );

}


/* =========================================================
   MOBILE PANEL MENU LINKS
   ========================================================= */

document
  .querySelectorAll('.mobile-panel-link')
  .forEach(button => {

    button.addEventListener('click', () => {

      const menu = button.dataset.menu;

      closeMobileControlPanel();

      const originalMenuItem =
        document.querySelector(
          `.menu-item[data-menu="${menu}"]`
        );

      if (originalMenuItem) {
        originalMenuItem.click();
      }

    });

  });

  /* =========================================================
   LOAD PLACES.GEOJSON
   ========================================================= */

try {

  const response = await fetch('data/places.geojson', {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(
      `Could not load places.geojson (${response.status})`
    );
  }

  /* ==================== STORE ORIGINAL DATA ==================== */

  travelData = await response.json();

  currentFilteredData = travelData;

  console.log(
    `Travel data loaded: ${travelData.features?.length || 0} places`
  );


  /* ==================== BUILD MAP PLACES ==================== */

  addTravelLayers();


  /* ==================== ACTIVATE MAP INTERACTIONS ==================== */

  bindTravelInteractions();


  /* ==================== BUILD RECENT PLACE CARDS ==================== */

  buildRecentPlaces();


} catch (error) {

  console.error(
    'Could not load travel places:',
    error
  );

}


/* =========================================================
   END MAP LOAD
   ========================================================= */

}); // End map.on('load')
