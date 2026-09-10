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


  /* ==================== LOAD PLACES.GEOJSON ==================== */

  try {

    const response = await fetch('data/places.geojson', {
      cache: 'no-store' // Prevent old GeoJSON being cached while developing.
    });

    if (!response.ok) throw new Error('Could not load places.geojson');

    travelData = await response.json(); // Keep original nested arrays intact.
    currentFilteredData = travelData; // Initially display every destination.

    buildRecentPlaces(); // Build bottom recent-place cards.
    addTravelLayers(); // Add permanent markers and clusters.
    bindTravelInteractions(); // Add clicks, hover names and cluster expansion.

  } catch (error) {

    console.error('Travel data error:', error);

  }

});


/* =========================================================
   ADD PERMANENT TRAVEL SOURCE + LAYERS
   ========================================================= */

function addTravelLayers() {

  if (!currentFilteredData) return;


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

    photos.forEach(photo => {

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
        openLightbox(photo, properties.name);
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

showDashboardTab('overview');

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
   PHOTO LIGHTBOX
   ========================================================= */

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const closeLightboxButton = document.getElementById('closeLightbox');


function openLightbox(photo, name = 'Travel photo') {

  if (!lightbox || !lightboxImage) return;

  lightboxImage.src = photo;
  lightboxImage.alt = name;

  lightbox.classList.add('active');

  document.body.classList.add('lightbox-open');

}


function closeLightbox() {

  if (!lightbox) return;

  lightbox.classList.remove('active');

  document.body.classList.remove('lightbox-open');

  setTimeout(() => {

    if (lightboxImage) lightboxImage.src = '';

  }, 200);

}


if (closeLightboxButton) {

  closeLightboxButton.addEventListener('click', event => {

    event.stopPropagation();

    closeLightbox();

  });

}


if (lightbox) {

  lightbox.addEventListener('click', event => {

    if (event.target === lightbox) {
      closeLightbox();
    }

  });

}


/* =========================================================
   DASHBOARD TABS
   ========================================================= */

const dashboardTabs = {
  overview: document.getElementById('dashboardOverview'),
  gallery: document.getElementById('dashboardGallery'),
  videos: document.getElementById('dashboardVideos'),
  info: document.getElementById('dashboardInfo'),
  links: document.getElementById('dashboardLinks')
};


function showDashboardTab(tab) {

  Object.values(dashboardTabs).forEach(section => {

    if (section) section.classList.remove('active');

  });

  if (dashboardTabs[tab]) {
    dashboardTabs[tab].classList.add('active');
  }

  document.querySelectorAll('.dashboard-nav-button').forEach(button => {

    button.classList.toggle(
      'active',
      button.dataset.dashboardTab === tab
    );

  });

  const dashboardMain = document.querySelector('.dashboard-main');

  if (dashboardMain) {

    dashboardMain.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }

}


document.querySelectorAll('.dashboard-nav-button').forEach(button => {

  button.addEventListener('click', () => {

    showDashboardTab(
      button.dataset.dashboardTab
    );

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
