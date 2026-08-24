import { setupMapDirections } from './map-directions.js';

const penaCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const penas = Array.isArray(window.__FIESTAS_PENAS__)
  ? [...window.__FIESTAS_PENAS__].sort((a, b) => penaCollator.compare(a.name || '', b.name || ''))
  : [];
const site = window.__FIESTAS_SITE__ || {};
const cartoLayers = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};
const state = {
  query: '',
  selectedId: null,
  sheetState: 'collapsed',
  map: null,
  tileLayer: null,
  markerLayer: null,
  markers: new Map()
};
const markerColors = ['#ba6d18', '#336699', '#4a7c59', '#8b5e83', '#aa4a44', '#557a95', '#8c6f28', '#6b5b95'];
let leafletPromise = null;
let dragStartY = null;
let dragMoved = false;

const elements = {
  app: document.querySelector('[data-penas-app]'),
  mapView: document.querySelector('[data-penas-map-view]'),
  map: document.querySelector('[data-penas-map]'),
  search: document.querySelector('[data-penas-search]'),
  count: document.querySelector('[data-penas-count]'),
  empty: document.querySelector('[data-penas-empty]'),
  sheet: document.querySelector('[data-penas-sheet]'),
  sheetToggle: document.querySelector('[data-penas-sheet-toggle]'),
  sheetOpen: document.querySelector('[data-penas-sheet-open]'),
  sheetPreview: document.querySelector('[data-penas-sheet-preview]'),
  sheetList: document.querySelector('[data-penas-sheet-list]'),
  locate: document.querySelector('[data-penas-locate]')
};

init();

function init() {
  if (!elements.app) return;

  elements.search?.addEventListener('input', () => {
    state.query = normalize(elements.search.value);
    render();
  });
  elements.sheetToggle?.addEventListener('click', () => setSheetState(state.sheetState === 'expanded' ? 'collapsed' : 'expanded'));
  elements.sheetOpen?.addEventListener('click', () => setSheetState('expanded'));
  elements.locate?.addEventListener('click', locateUser);
  bindSheetDrag();

  render();
  void initMap();
  window.addEventListener('fiestas:themechange', () => updateTileLayer());
}

function render() {
  const filtered = getFilteredPenas();
  renderSheet(filtered);
  renderMarkers(filtered);
  if (elements.empty) elements.empty.hidden = filtered.length > 0;
}

function getFilteredPenas() {
  if (!state.query) return penas;
  return penas.filter((pena) => normalize(pena.name).includes(state.query));
}

function renderSheet(filtered) {
  const countLabel = state.query
    ? `${filtered.length} de ${penas.length} peñas`
    : `${penas.length} peñas`;
  if (elements.count) elements.count.textContent = countLabel;
  if (elements.sheetToggle) elements.sheetToggle.setAttribute('aria-expanded', String(state.sheetState === 'expanded'));
  if (elements.sheetOpen) elements.sheetOpen.hidden = state.sheetState !== 'hidden';
  elements.sheet?.classList.toggle('is-expanded', state.sheetState === 'expanded');
  elements.sheet?.classList.toggle('is-collapsed', state.sheetState === 'collapsed');
  elements.sheet?.classList.toggle('is-hidden', state.sheetState === 'hidden');
  elements.mapView?.classList.toggle('is-sheet-expanded', state.sheetState === 'expanded');

  const preview = filtered.slice(0, 2);
  renderPenaItems(elements.sheetPreview, preview);
  renderPenaItems(elements.sheetList, filtered);
}

function renderPenaItems(container, items) {
  if (!container) return;
  container.replaceChildren();
  items.forEach((pena) => container.append(createPenaItem(pena)));
}

function createPenaItem(pena) {
  const article = document.createElement('article');
  article.className = 'fiestas-map-result penas-map-result';
  article.dataset.penaId = String(pena.id);
  article.classList.toggle('is-selected', pena.id === state.selectedId);
  article.style.setProperty('--fiestas-type-color', '#ba6d18');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'penas-map-result-main';
  button.setAttribute('aria-label', `Centrar en ${pena.name}`);
  button.innerHTML = `
    <span class="fiestas-map-result-copy">
      <span class="fiestas-map-result-title-line">
        <span class="fiestas-map-result-title">${escapeHtml(pena.name)}</span>
      </span>
    </span>
  `;
  button.addEventListener('click', () => selectPena(pena));

  const mapLink = document.createElement('a');
  mapLink.className = 'fiestas-map-result-focus';
  mapLink.href = directionsUrl(pena);
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.dataset.fiestasDirections = 'true';
  mapLink.dataset.lat = String(pena.coordinates.lat);
  mapLink.dataset.lng = String(pena.coordinates.lng);
  mapLink.dataset.title = pena.name;
  mapLink.setAttribute('aria-label', `Cómo llegar a ${pena.name}`);
  mapLink.title = 'Cómo llegar';
  mapLink.innerHTML = '<i class="fa-solid fa-route" aria-hidden="true"></i>';

  article.append(button, mapLink);
  setupMapDirections(article);
  return article;
}

async function initMap() {
  if (!elements.map) return;
  const leaflet = await ensureLeaflet();
  if (!leaflet) {
    elements.map.classList.add('is-error');
    elements.map.textContent = 'No se pudo cargar el mapa. Consulta la lista de peñas para ver sus coordenadas.';
    return;
  }

  const center = Array.isArray(site.center) ? site.center : [41.5090909, -4.4593002];
  state.map = leaflet.map(elements.map, { maxZoom: 20, scrollWheelZoom: true, zoomControl: false }).setView(center, 16);
  leaflet.control.zoom({ position: 'topright' }).addTo(state.map);
  state.markerLayer = leaflet.layerGroup().addTo(state.map);
  updateTileLayer(leaflet);
  renderMarkers(getFilteredPenas(), leaflet);
  window.requestAnimationFrame(() => state.map?.invalidateSize());
}

function renderMarkers(filtered, leaflet = window.L) {
  if (!state.map || !state.markerLayer || !leaflet) return;
  state.markerLayer.clearLayers();
  state.markers.clear();

  filtered.forEach((pena) => {
    const selected = pena.id === state.selectedId;
    const markerColor = markerColorFor(pena);
    const marker = leaflet.marker([pena.coordinates.lat, pena.coordinates.lng], {
      title: pena.name,
      alt: pena.name,
      icon: leaflet.divIcon({
        className: `penas-map-marker${selected ? ' is-selected' : ''}`,
        html: `<button type="button" aria-label="${escapeHtml(pena.name)}" style="--pena-color: ${markerColor}"><span>${escapeHtml(initialsFor(pena.name))}</span></button>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      })
    });
    marker.bindPopup(popupMarkup(pena), {
      maxWidth: 300,
      autoPan: true,
      autoPanPaddingTopLeft: [18, 88],
      autoPanPaddingBottomRight: [18, 210]
    });
    marker.on('popupopen', (event) => setupMapDirections(event.popup.getElement()));
    marker.on('click', () => {
      state.selectedId = pena.id;
      renderSheet(getFilteredPenas());
      marker.getElement()?.classList.add('is-selected');
      marker.closePopup();
      focusPena(pena, marker);
    });
    marker.addTo(state.markerLayer);
    state.markers.set(pena.id, marker);
  });
}

function selectPena(pena) {
  state.selectedId = pena.id;
  render();
  const marker = state.markers.get(pena.id);
  if (!state.map || !marker) return;
  focusPena(pena, marker);
}

function focusPena(pena, marker) {
  if (!state.map) {
    marker.openPopup();
    return;
  }

  state.map.panTo([pena.coordinates.lat, pena.coordinates.lng], {
    animate: true,
    duration: 0.35
  });
  window.setTimeout(() => marker.openPopup(), 220);
}

function popupMarkup(pena) {
  return `
    <div class="penas-popup">
      <span class="penas-popup-kicker">PEÑA</span>
      <div class="penas-popup-title-row">
        <strong>${escapeHtml(pena.name)}</strong>
        <a class="penas-popup-route" href="${directionsUrl(pena)}" target="_blank" rel="noopener noreferrer" data-fiestas-directions data-lat="${escapeHtml(pena.coordinates.lat)}" data-lng="${escapeHtml(pena.coordinates.lng)}" data-title="${escapeHtml(pena.name)}" aria-label="Cómo llegar a ${escapeHtml(pena.name)}" title="Cómo llegar"><i class="fa-solid fa-route" aria-hidden="true"></i></a>
      </div>
      ${activitiesMarkup(pena)}
    </div>
  `;
}

function activitiesMarkup(pena) {
  const activities = Array.isArray(pena.activities) ? pena.activities.filter((activity) => activity?.urlPath) : [];
  if (!activities.length) return '';

  return `
    <div class="penas-popup-activities">
      <span class="penas-popup-activities-label">ACTIVIDADES</span>
      ${activities.map((activity) => `
        <a class="penas-popup-activity" href="${escapeHtml(activity.urlPath)}">
          <span class="penas-popup-activity-copy">
            <strong>${escapeHtml(activity.title)}</strong>
            <small>${escapeHtml(activityDateTime(activity))}</small>
          </span>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </a>
      `).join('')}
    </div>
  `;
}

function activityDateTime(activity) {
  const time = [activity.startTime, activity.endTime].filter(Boolean).join(' - ');
  return [activity.dateLabel, time].filter(Boolean).join(' · ');
}

function setSheetState(nextState) {
  state.sheetState = nextState;
  renderSheet(getFilteredPenas());
}

function bindSheetDrag() {
  const handle = elements.sheetToggle;
  if (!handle || !elements.sheet) return;

  handle.addEventListener('pointerdown', (event) => {
    dragStartY = event.clientY;
    dragMoved = false;
    elements.sheet.classList.add('is-dragging');
    handle.setPointerCapture?.(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (dragStartY === null) return;
    dragMoved = Math.abs(event.clientY - dragStartY) > 12;
  });

  const finishDrag = (event) => {
    if (dragStartY === null) return;
    const delta = event.clientY - dragStartY;
    const wasDragged = dragMoved;
    dragStartY = null;
    dragMoved = false;
    elements.sheet.classList.remove('is-dragging');
    if (!wasDragged) return;
    setSheetState(delta < 0 ? 'expanded' : 'collapsed');
    handle.addEventListener('click', suppressNextSheetClick, { once: true, capture: true });
  };

  handle.addEventListener('pointerup', finishDrag);
  document.addEventListener('pointerup', finishDrag);

  handle.addEventListener('pointercancel', () => {
    dragStartY = null;
    dragMoved = false;
    elements.sheet.classList.remove('is-dragging');
  });
}

function suppressNextSheetClick(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function markerColorFor(pena) {
  return markerColors[Math.abs(Number(pena.id) || 0) % markerColors.length];
}

function initialsFor(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase('es');
  return (words[0] || '').slice(0, 2).toLocaleUpperCase('es');
}

function directionsUrl(pena) {
  const { lat, lng } = pena.coordinates;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

function updateTileLayer(leaflet = window.L) {
  if (!state.map || !leaflet) return;
  if (state.tileLayer) state.map.removeLayer(state.tileLayer);
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  state.tileLayer = leaflet.tileLayer(cartoLayers[theme], {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
    subdomains: 'abcd'
  }).addTo(state.map);
}

function locateUser() {
  if (!state.map || !navigator.geolocation) {
    setLocateLabel('La ubicación no está disponible');
    return;
  }

  setLocateLabel('Localizando ubicación');
  elements.locate?.setAttribute('disabled', 'disabled');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      renderUserMarker();
      state.map.setView([state.userLocation.lat, state.userLocation.lng], Math.max(state.map.getZoom(), 17), { animate: true });
      setLocateLabel('Centrar en mi ubicación');
      elements.locate?.removeAttribute('disabled');
    },
    () => {
      setLocateLabel('No se pudo obtener tu ubicación');
      elements.locate?.removeAttribute('disabled');
    },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
  );
}

function renderUserMarker() {
  if (!state.map || !state.userLocation || !window.L) return;
  state.userMarker?.remove();
  state.userMarker = window.L.circleMarker([state.userLocation.lat, state.userLocation.lng], {
    radius: 8,
    color: '#336699',
    fillColor: '#3f7fb5',
    fillOpacity: 0.9,
    weight: 3
  }).addTo(state.map);
  state.userMarker.bindPopup('Tu ubicación aproximada');
}

function setLocateLabel(label) {
  elements.locate?.setAttribute('aria-label', label);
  if (elements.locate) elements.locate.title = label;
}

function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-penas-leaflet-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L || null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.dataset.penasLeafletLoader = 'true';
    script.addEventListener('load', () => resolve(window.L || null), { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    document.head.append(script);
  });
  return leafletPromise;
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
