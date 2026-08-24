import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const site = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'fiestas-2026', 'site.json'), 'utf8'));
const publicBaseUrl = site.publicBaseUrl;
const analyticsConfig = {
  enabled: parseBooleanEnv(process.env.FIESTAS_ANALYTICS_ENABLED) ?? true,
  trackerUrl: process.env.FIESTAS_MATOMO_URL || 'https://stats.nukeador.com/',
  siteId: process.env.FIESTAS_MATOMO_SITE_ID || '30'
};
const communityPlanIcons = new Set([
  'stars', 'music', 'microphone', 'cocktail', 'beer', 'food', 'dance', 'theater', 'masks',
  'fireworks', 'parade', 'family', 'children', 'sports', 'religious', 'camera', 'art',
  'culture', 'map', 'calendar', 'heart', 'layers'
]);
const env = nunjucks.configure(path.join(root, 'src', 'templates'), { autoescape: true, noCache: true });

env.addFilter('urlencode', (value) => encodeURIComponent(String(value || '')));
env.addFilter('dump', (value) => JSON.stringify(value));
env.addFilter('slugify', (value) => slugify(value));

function parseBooleanEnv(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function slugify(value = '') {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'evento';
}

function fiestas2026Icon(type = '') {
  const icons = {
    danza: 'fa-person-dress', deporte: 'fa-person-running', exposicion: 'fa-image', folklore: 'fa-guitar',
    'fuegos-artificiales': 'fa-wand-sparkles', gastronomia: 'fa-utensils', 'infantil-y-familiar': 'fa-children',
    magia: 'fa-hat-wizard', musica: 'fa-music', 'humor-y-monologos': 'fa-masks-theater', otros: 'fa-star', penas: 'fa-people-group',
    religioso: 'fa-place-of-worship', talleres: 'fa-screwdriver-wrench', teatro: 'fa-masks-theater', toros: 'fa-circle-dot'
  };
  return icons[slugify(type)] || 'fa-calendar-day';
}

function socialCategorySlug(type = '') {
  const slug = slugify(type);
  return slug === 'humor-y-monologos' ? 'teatro' : slug;
}

async function writeFile(relPath, content) {
  const filePath = path.join(dist, relPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

function contentVersion(seed) {
  const hash = createHash('sha256');
  for (const [relPath, content] of seed) {
    hash.update(relPath).update('\0').update(content).update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

async function compileCss(cssVersionSeed) {
  const cssDir = path.join(dist, 'assets', 'css');
  await fs.mkdir(cssDir, { recursive: true });
  const input = path.join(root, 'src', 'styles', 'fiestas-2026.css');
  const base = await fs.readFile(path.join(root, 'src', 'styles', 'base.css'), 'utf8');
  const page = await fs.readFile(input, 'utf8');
  const result = await postcss([
    tailwindcss({ config: path.join(root, 'tailwind.config.js') }),
    autoprefixer()
  ]).process(base + '\n' + page, { from: input, to: path.join(cssDir, 'fiestas-2026.css') });
  await fs.writeFile(path.join(cssDir, 'fiestas-2026.css'), result.css);
  cssVersionSeed.push(['assets/css/fiestas-2026.css', result.css]);
}

async function copyJs(jsVersionSeed) {
  const jsDir = path.join(dist, 'assets', 'js');
  await fs.mkdir(jsDir, { recursive: true });
  const files = ['analytics.js', 'plan-storage.js', 'plan-export.js', 'plans-page.js', 'community-plans.js', 'popular-page.js', 'fiestas-2026.js', 'penas-page.js', 'map-directions.js', 'menu-drawer.js', 'pwa.js', 'scroll-top.js', 'subscribe.js', 'theme.js'];
  for (const file of files) {
    const content = await fs.readFile(path.join(root, 'src', 'scripts', file), 'utf8');
    await fs.writeFile(path.join(jsDir, file), content);
    jsVersionSeed.push(['assets/js/' + file, content]);
  }
  return files;
}

async function writeVersionedJs(files, jsVersion) {
  const contents = new Map();
  for (const file of files) {
    const filePath = path.join(dist, 'assets', 'js', file);
    contents.set(file, await fs.readFile(filePath, 'utf8'));
  }
  for (const file of files) {
    const content = contents.get(file);
    const versioned = content.replace(/(['"])\.\/([A-Za-z0-9_-]+)\.js\1/g, '$1./$2.' + jsVersion + '.js$1');
    const versionedFile = file.replace(/\.js$/, '.' + jsVersion + '.js');
    await fs.writeFile(path.join(dist, 'assets', 'js', versionedFile), versioned);
  }
}

async function writeVersionedCss(cssVersion) {
  const source = path.join(dist, 'assets', 'css', 'fiestas-2026.css');
  const target = path.join(dist, 'assets', 'css', 'fiestas-2026.' + cssVersion + '.css');
  await fs.copyFile(source, target);
}

async function loadPwaFiles() {
  const pwaDir = path.join(root, 'src', 'pwa');
  return {
    serviceWorker: await fs.readFile(path.join(pwaDir, 'sw.js'), 'utf8'),
    offlinePage: await fs.readFile(path.join(pwaDir, 'offline.html'), 'utf8')
  };
}

async function writePwaFiles({ serviceWorker, offlinePage }, { appVersion, cssVersion, jsVersion }) {
  const renderedServiceWorker = serviceWorker
    .replaceAll('__APP_VERSION__', appVersion)
    .replaceAll('__CSS_VERSION__', cssVersion)
    .replaceAll('__JS_VERSION__', jsVersion);
  await writeFile('sw.js', renderedServiceWorker);
  await writeFile('offline.html', offlinePage);
}

async function copyStaticAssets(assetVersionSeed) {
  const sourceDir = path.join(root, 'src', 'assets');
  try {
    await copyAssetDir(sourceDir, sourceDir, assetVersionSeed);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function copyCommunityPlansData(assetVersionSeed) {
  const sourcePath = path.join(root, 'src', 'data', 'community-plans.json');
  const raw = await fs.readFile(sourcePath, 'utf8');
  const value = JSON.parse(raw);
  if (value?.schemaVersion !== 1 || value?.festival !== site.festivalId || !Array.isArray(value?.plans)) {
    throw new Error(`The community plans catalog must use schemaVersion 1 and festival ${site.festivalId}.`);
  }
  const ids = new Set();
  const plans = value.plans.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Community plan ${index + 1} must be an object.`);
    const id = String(entry.id || '').trim();
    const name = String(entry.name || '').trim();
    const author = String(entry.author || '').trim();
    const iconValue = String(entry.icon || 'layers').trim().toLowerCase();
    const icon = communityPlanIcons.has(iconValue) ? iconValue : 'layers';
    const url = normalizeCommunityPlanUrl(entry.url);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Community plan ${index + 1} has an invalid stable id.`);
    if (ids.has(id)) throw new Error(`Community plan id "${id}" is duplicated.`);
    if (!name || name.length > 80) throw new Error(`Community plan "${id}" must have a name between 1 and 80 characters.`);
    if (!author || author.length > 80) throw new Error(`Community plan "${id}" must have an author between 1 and 80 characters.`);
    if (!url) throw new Error(`Community plan "${id}" must have a valid JSON url.`);
    ids.add(id);
    return { id, name, author, icon, url };
  });
  const content = JSON.stringify({
    schemaVersion: 1,
    festival: site.festivalId,
    ...(value.updatedAt ? { updatedAt: String(value.updatedAt) } : {}),
    plans
  }, null, 2) + '\n';
  await writeFile('data/planes.json', content);
  assetVersionSeed.push(['data/planes.json', createHash('sha256').update(content).digest('hex')]);
  return plans;
}

async function loadPenas() {
  const sourcePath = path.join(root, 'src', 'data', 'penas.json');
  const value = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  if (!value || typeof value !== 'object' || !Array.isArray(value.peñas) || !value.peñas.length) {
    throw new Error('The peñas catalog must contain a non-empty peñas array.');
  }

  const ids = new Set();
  const penas = value.peñas.map((entry, index) => {
    const id = Number(entry?.id);
    const name = String(entry?.name || '').trim();
    const lat = Number(entry?.coordinates?.lat);
    const lng = Number(entry?.coordinates?.lng);
    if (!Number.isInteger(id) || id < 1 || ids.has(id)) throw new Error(`Peña ${index + 1} has an invalid or duplicated id.`);
    if (!name) throw new Error(`Peña ${index + 1} must have a name.`);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`Peña "${name}" must have valid coordinates.`);
    ids.add(id);
    return { id, name, coordinates: { lat, lng } };
  });

  return {
    sourceUrl: String(value.sourceUrl || '').trim(),
    sourceName: String(value.sourceName || 'Mapa público de peñas').trim(),
    penas
  };
}

async function copyPenasData(assetVersionSeed, penasData) {
  const content = JSON.stringify(penasData, null, 2) + '\n';
  await writeFile('data/penas.json', content);
  assetVersionSeed.push(['data/penas.json', createHash('sha256').update(content).digest('hex')]);
}

function normalizeCommunityPlanUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('/') && !text.startsWith('/data/')) return '';
  try {
    const url = new URL(text, publicBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || !url.pathname.toLowerCase().endsWith('.fiestas-plan.json')) return '';
    return text.startsWith('/') ? url.pathname + url.search : url.href;
  } catch (_) {
    return '';
  }
}

function communityPlanIconClass(icon = '') {
  const icons = {
    stars: 'fa-star',
    music: 'fa-music',
    microphone: 'fa-microphone',
    cocktail: 'fa-wine-glass',
    beer: 'fa-beer-mug-empty',
    food: 'fa-utensils',
    dance: 'fa-person-dress',
    theater: 'fa-masks-theater',
    masks: 'fa-mask-face',
    fireworks: 'fa-wand-sparkles',
    parade: 'fa-drum',
    family: 'fa-people-roof',
    children: 'fa-child-reaching',
    sports: 'fa-person-running',
    religious: 'fa-place-of-worship',
    camera: 'fa-camera',
    art: 'fa-palette',
    culture: 'fa-book-open',
    map: 'fa-map-location-dot',
    calendar: 'fa-calendar-days',
    heart: 'fa-heart',
    layers: 'fa-layer-group'
  };
  return icons[icon] || icons.layers;
}

async function loadCommunityPlanMemberships(communityPlans) {
  const sourceDir = path.join(root, 'src', 'data', 'community-plans');
  const memberships = new Map();

  for (const communityPlan of communityPlans) {
    const fileName = path.basename(new URL(communityPlan.url, publicBaseUrl).pathname);
    const raw = await fs.readFile(path.join(sourceDir, fileName), 'utf8');
    const value = JSON.parse(raw);
    if (value?.schemaVersion !== 1 || value?.festival !== site.festivalId || !Array.isArray(value?.plans)) {
      throw new Error(`Community plan "${communityPlan.id}" has an invalid export.`);
    }

    const activityIds = new Set();
    for (const sourcePlan of value.plans) {
      if (!sourcePlan || typeof sourcePlan !== 'object' || !Array.isArray(sourcePlan.activityIds)) continue;
      for (const activityId of sourcePlan.activityIds) activityIds.add(String(activityId).trim());
    }

    for (const activityId of activityIds) {
      if (!activityId) continue;
      const plansForEvent = memberships.get(activityId) || [];
      plansForEvent.push({
        id: communityPlan.id,
        name: communityPlan.name,
        author: communityPlan.author,
        iconClass: communityPlanIconClass(communityPlan.icon),
        pageUrl: `/planes/${communityPlan.id}/`
      });
      memberships.set(activityId, plansForEvent);
    }
  }

  return memberships;
}

async function copyCommunityPlanFiles(assetVersionSeed) {
  const sourceDir = path.join(root, 'src', 'data', 'community-plans');
  try {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const sourcePath = path.join(sourceDir, entry.name);
      const content = await fs.readFile(sourcePath);
      const relPath = 'data/community-plans/' + entry.name;
      await writeFile(relPath, content);
      assetVersionSeed.push([relPath, createHash('sha256').update(content).digest('hex')]);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function copyAssetDir(sourceDir, currentDir, assetVersionSeed) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await copyAssetDir(sourceDir, sourcePath, assetVersionSeed);
      continue;
    }
    if (!entry.isFile()) continue;
    const relPath = path.relative(sourceDir, sourcePath);
    if (relPath.startsWith(`events${path.sep}`)) continue;
    const targetPath = path.join(dist, 'assets', relPath);
    const content = await fs.readFile(sourcePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
    assetVersionSeed.push(['assets/' + relPath, createHash('sha256').update(content).digest('hex')]);
  }
}

async function loadEvents() {
  const raw = await fs.readFile(path.join(root, 'src', 'data', 'fiestas-2026', 'events.json'), 'utf8');
  const sourceEvents = JSON.parse(raw);
  const ids = sourceEvents.map((event) => event.id);
  if (sourceEvents.some((event) => !Number.isInteger(event.id) || event.id < 1) || new Set(ids).size !== ids.length) {
    throw new Error('Each event must have a unique positive numeric id.');
  }
  return sourceEvents.map((event) => {
    const ticket = event.ticket && typeof event.ticket === 'object'
      ? {
          required: Boolean(event.ticket.required),
          status: String(event.ticket.status || ''),
          label: String(event.ticket.label || ''),
          url: event.ticket.url ? String(event.ticket.url) : '',
          note: String(event.ticket.note || '')
        }
      : null;
    return {
    id: String(event.id || ''),
    date: String(event.date || ''),
    dateLabel: String(event.dateLabel || event.date || ''),
    startTime: String(event.startTime || ''),
    endTime: String(event.endTime || ''),
    title: String(event.title || 'Evento'),
    image: event.image ? String(event.image) : '',
    location: String(event.location || ''),
    zone: String(event.zone || ''),
    neighborhood: inferArea(event),
    type: String(event.type || 'Evento'),
    tags: normalizeTags(event.tags, event.type),
    description: String(event.description || ''),
    summary: String(event.summary || ''),
    performances: Array.isArray(event.performances) ? event.performances.map(String) : [],
    organizers: Array.isArray(event.organizers) ? event.organizers.map(String) : [],
    collaborators: Array.isArray(event.collaborators) ? event.collaborators.map(String) : [],
    coordinates: hasCoordinates(event.coordinates)
      ? normalizeCoordinates(event.coordinates)
      : null,
    ticket,
    ticketKind: ticketKind(ticket)
    };
  }).filter((event) => event.id && event.date)
    .sort((a, b) => a.date.localeCompare(b.date) || sortMinutes(a.startTime) - sortMinutes(b.startTime) || a.title.localeCompare(b.title, 'es'))
    .map((event) => ({
      ...event,
      slug: slugify(event.title),
      icon: fiestas2026Icon(event.type),
      socialImagePath: '/assets/social/categories/' + socialCategorySlug(event.type) + '.jpg',
      socialImageAlt: 'Imagen de la categoría ' + event.type + ' de las Fiestas 2026',
      socialImageWidth: 512,
      socialImageHeight: 512,
      urlPath: '/e/' + event.id + '/' + slugify(event.title) + '/',
      canonicalUrl: publicBaseUrl + '/e/' + event.id + '/' + slugify(event.title) + '/',
      shareText: shareText(event),
      ticketLabel: ticketKindLabel(event.ticketKind),
      ticketDetail: ticketDetail(event.ticketKind, event.ticket),
      mapUrl: '/mapa/?event=' + encodeURIComponent(event.id),
      osmUrl: event.coordinates ? 'https://www.openstreetmap.org/?mlat=' + event.coordinates.lat + '&mlon=' + event.coordinates.lng + '#map=17/' + event.coordinates.lat + '/' + event.coordinates.lng : '',
      directionsUrl: event.coordinates ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(event.coordinates.lat + ',' + event.coordinates.lng) : ''
    }));
}

function hasCoordinates(coordinates) {
  return coordinates && Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng);
}

function normalizeCoordinates(coordinates) {
  return Object.fromEntries(Object.entries({
    lat: coordinates.lat,
    lng: coordinates.lng,
    source: coordinates.source,
    osmType: coordinates.osmType,
    osmId: coordinates.osmId,
    query: coordinates.query,
    accuracy: coordinates.accuracy,
    geocodedAt: coordinates.geocodedAt
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function normalizePenaKey(value = '') {
  return slugify(value)
    .replace(/^penas?-/, '')
    .replace(/^(el|la|los|las)-/, '');
}

function buildPenaActivities(penas, events) {
  const penasByKey = new Map(penas.map((pena) => [normalizePenaKey(pena.name), pena]));
  const activitiesByPenaId = new Map(penas.map((pena) => [pena.id, []]));

  events.forEach((event) => {
    const matchedPenaIds = new Set();
    event.organizers.forEach((organizer) => {
      const pena = penasByKey.get(normalizePenaKey(organizer));
      if (pena) matchedPenaIds.add(pena.id);
    });

    if (!matchedPenaIds.size && event.coordinates) {
      const coordinateMatch = penas.find((pena) => (
        Math.abs(pena.coordinates.lat - event.coordinates.lat) < 0.000001
        && Math.abs(pena.coordinates.lng - event.coordinates.lng) < 0.000001
      ));
      if (coordinateMatch) matchedPenaIds.add(coordinateMatch.id);
    }

    matchedPenaIds.forEach((penaId) => {
      activitiesByPenaId.get(penaId)?.push({
        id: event.id,
        title: event.title,
        dateLabel: event.dateLabel,
        startTime: event.startTime,
        endTime: event.endTime,
        urlPath: event.urlPath
      });
    });
  });

  return penas.map((pena) => ({
    ...pena,
    activities: activitiesByPenaId.get(pena.id) || []
  }));
}

function shareText(event) {
  return [
    event.title,
    [event.dateLabel, [event.startTime, event.endTime].filter(Boolean).join(' - ')].filter(Boolean).join(' · '),
    event.location
  ].filter(Boolean).join('\n');
}

function eventDateTime(date, time) {
  return time && /^\d{2}:\d{2}$/.test(time) ? date + 'T' + time + ':00+02:00' : date;
}

function eventEndDate(date, startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes >= startMinutes) return date;

  const nextDate = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(nextDate.getTime())) return date;
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function eventImageUrl(event) {
  if (!event.image) return /^https?:\/\//i.test(event.socialImagePath) ? event.socialImagePath : publicBaseUrl + event.socialImagePath;
  return /^https?:\/\//i.test(event.image) ? event.image : publicBaseUrl + event.image;
}

function eventStructuredData(event) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary || event.description || event.dateLabel,
    startDate: eventDateTime(event.date, event.startTime),
    url: event.canonicalUrl,
    image: [eventImageUrl(event)],
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.location || event.zone || site.location.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: site.location.name,
        addressRegion: site.location.province,
        addressCountry: site.location.country
      }
    },
    organizer: {
      '@type': 'Organization',
      name: 'Vecinos de Montemayor de Pililla',
      url: publicBaseUrl
    }
  };
  if (event.endTime) data.endDate = eventDateTime(eventEndDate(event.date, event.startTime, event.endTime), event.endTime);
  if (event.coordinates) {
    data.location.geo = {
      '@type': 'GeoCoordinates',
      latitude: event.coordinates.lat,
      longitude: event.coordinates.lng
    };
  }
  return data;
}

function ticketKindLabel(kind) {
  const labels = {
    free: 'Gratis',
    paid: 'De pago',
    registration: 'Inscripción'
  };
  return labels[kind] || 'Entrada no indicada';
}

function ticketDetail(kind, ticket) {
  const genericText = normalizeForMatch([
    'Entrada no indicada',
    'Sin entrada indicada',
    'El programa no indica venta de entradas para este evento.',
    'No consta venta de entradas en el programa para este evento.'
  ].join(' '));
  const label = ticket?.label || '';
  const note = ticket?.note || '';
  if (label && label !== ticketKindLabel(kind) && !genericText.includes(normalizeForMatch(label))) return label;
  if (kind !== 'free' && note && !genericText.includes(normalizeForMatch(note))) return note;
  return '';
}

function buildSummary(events) {
  const dates = [...new Map(events.map((event) => [event.date, {
    date: event.date,
    label: event.dateLabel,
    shortLabel: event.dateLabel.split(' ').slice(0, 2).join(' '),
    weekday: event.dateLabel.split(' ')[0]?.replace(',', '').slice(0, 3).toUpperCase() || '',
    dayNumber: event.date.split('-')[2]?.replace(/^0/, '') || '',
    monthLabel: monthLabel(event.date)
  }])).values()];
  const types = [...new Set(events.flatMap((event) => event.tags?.length ? event.tags : [event.type || 'Evento']))].sort((a, b) => a.localeCompare(b, 'es'));
  const areas = [...new Set(events.map((event) => event.neighborhood || event.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  return { dates, types, areas };
}

function monthLabel(date = '') {
  const months = { '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DIC' };
  return months[String(date).split('-')[1]] || '';
}

function sortMinutes(time = '') {
  if (!time) return 99 * 60;
  const [hour, minute] = String(time).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 99 * 60;
  return hour * 60 + minute;
}

function ticketKind(ticket) {
  if (!ticket?.required) return 'free';
  const text = normalizeForMatch([ticket.label, ticket.url, ticket.note].filter(Boolean).join(' '));
  if (text.includes('inscrip') || text.includes('reserva') || text.includes('plazas limitadas')) return 'registration';
  return 'paid';
}

function inferArea(event = {}) {
  return String(event.zone || event.location || '').trim();
}

function normalizeForMatch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeTags(tags, type) {
  const primary = String(type || 'Evento');
  const values = Array.isArray(tags) ? tags.map(String) : [];
  return [...new Set([primary, ...values].map((tag) => tag.trim()).filter(Boolean))];
}

function pageContext({ assetVersion, cssVersion, jsVersion }) {
  return {
    site,
    activeNav: 'fiestas-2026',
    pageCss: 'fiestas-2026.' + cssVersion + '.css',
    pageJs: 'fiestas-2026.' + jsVersion + '.js',
    communityPlansUrl: '/data/planes.json',
    assetVersion,
    cssVersion,
    jsVersion,
    categoryFeeds: [],
    publicBaseUrl,
    calendarUrl: `${publicBaseUrl}/calendar.ics`,
    webcalUrl: `webcal://${new URL(publicBaseUrl).host}/calendar.ics`,
    rssUrl: `${publicBaseUrl}/rss.xml`,
    analyticsConfig,
    fiestasDateRange: formatDateRange(site, site.dateRange)
  };
}

function formatDateRange(currentSite, fallbackDates = []) {
  const dates = Array.isArray(fallbackDates) ? fallbackDates : [];
  if (dates.length) return dates.join('–');
  return currentSite.location?.name || 'Fiestas 2026';
}

function xmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function icsEscape(value = '') {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r?\n/g, '\\n');
}

function icsDateTime(date, time = '00:00') {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  return `${date.replaceAll('-', '')}T${normalizedTime.replace(':', '')}00`;
}

function createCalendarFeed(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//Fiestas 2026//Montemayor de Pililla//ES',
    `X-WR-CALNAME:${icsEscape(site.fullName)}`,
    'X-WR-TIMEZONE:Europe/Madrid'
  ];
  for (const event of events) {
    const start = icsDateTime(event.date, event.startTime);
    const end = event.endTime ? icsDateTime(eventEndDate(event.date, event.startTime, event.endTime), event.endTime) : start;
    const location = event.location || event.zone || site.location.name;
    const description = [event.summary, event.description].filter(Boolean).join('\n\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(`${event.id}@fiestas.montemayordepililla.com`)}`,
      `DTSTAMP:${icsDateTime('2026-01-01', '00:00')}Z`,
      `DTSTART;TZID=Europe/Madrid:${start}`,
      `DTEND;TZID=Europe/Madrid:${end}`,
      `SUMMARY:${icsEscape(event.title)}`,
      `LOCATION:${icsEscape(location)}`,
      `DESCRIPTION:${icsEscape(description || event.dateLabel)}`,
      `URL:${icsEscape(event.canonicalUrl)}`,
      ...(event.coordinates ? [`GEO:${event.coordinates.lat};${event.coordinates.lng}`] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

function createRssFeed(events) {
  const items = events.map((event) => [
    '<item>',
    `<title>${xmlEscape(event.title)}</title>`,
    `<link>${xmlEscape(event.canonicalUrl)}</link>`,
    `<guid isPermaLink="true">${xmlEscape(event.canonicalUrl)}</guid>`,
    `<pubDate>${new Date(`${event.date}T${event.startTime || '00:00'}:00+02:00`).toUTCString()}</pubDate>`,
    `<description>${xmlEscape([event.dateLabel, event.startTime, event.location, event.summary || event.description].filter(Boolean).join(' · '))}</description>`,
    '</item>'
  ].join(''));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${xmlEscape(site.fullName)}</title>`,
    `<link>${xmlEscape(publicBaseUrl)}/</link>`,
    `<description>${xmlEscape(site.description)}</description>`,
    '<language>es-ES</language>',
    ...items,
    '</channel>',
    '</rss>',
    ''
  ].join('\n');
}

function render(template, context) {
  return env.render(template, context);
}

async function build() {
  await fs.rm(dist, { recursive: true, force: true });
  const cssVersionSeed = [];
  const jsVersionSeed = [];
  const assetVersionSeed = [];
  await compileCss(cssVersionSeed);
  const jsFiles = await copyJs(jsVersionSeed);
  await copyStaticAssets(assetVersionSeed);
  const penasData = await loadPenas();
  await copyPenasData(assetVersionSeed, penasData);
  const communityPlans = await copyCommunityPlansData(assetVersionSeed);
  await copyCommunityPlanFiles(assetVersionSeed);
  const communityPlanMemberships = await loadCommunityPlanMemberships(communityPlans);
  const pwaFiles = await loadPwaFiles();
  const cssVersion = contentVersion(cssVersionSeed);
  const jsVersion = contentVersion(jsVersionSeed);
  await writeVersionedCss(cssVersion);
  await writeVersionedJs(jsFiles, jsVersion);
  const assetVersion = contentVersion([...cssVersionSeed, ...jsVersionSeed, ...assetVersionSeed]);
  const appVersion = contentVersion([
    ...cssVersionSeed,
    ...jsVersionSeed,
    ...assetVersionSeed,
    ['pwa/sw.js', pwaFiles.serviceWorker],
    ['pwa/offline.html', pwaFiles.offlinePage]
  ]);
  await writePwaFiles(pwaFiles, { appVersion, cssVersion, jsVersion });
  const versions = { assetVersion, cssVersion, jsVersion };
  const events = await loadEvents();
  const penaCatalog = buildPenaActivities(penasData.penas, events);
  const summary = buildSummary(events);
  const socialImage = /^https?:\/\//i.test(site.socialImagePath)
    ? site.socialImagePath
    : publicBaseUrl + site.socialImagePath;
  const dateRange = summary.dates.length
    ? `${summary.dates[0].dayNumber}–${summary.dates.at(-1).dayNumber} ${summary.dates[0].monthLabel}`
    : site.location.name;

  const homeContext = {
    ...pageContext(versions),
    title: `${site.name} | ${site.location.name}`,
    meta: { description: site.description },
    canonicalUrl: publicBaseUrl + '/',
    social: {
      type: 'website', title: `${site.name} | ${site.location.name}`,
      description: site.description,
      image: socialImage, imageAlt: site.fullName,
      imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg', url: publicBaseUrl + '/'
    },
    fiestasEvents: events,
    fiestasEventsJson: JSON.stringify(events),
    fiestasDates: summary.dates,
    fiestasTypes: summary.types,
    fiestasAreas: summary.areas,
    fiestasDateRange: dateRange,
    communityPlans
  };

  await writeFile('index.html', render('fiestas-2026.njk', homeContext));
  await writeFile('mapa/index.html', render('fiestas-2026.njk', {
    ...homeContext,
    title: `Mapa | ${site.name}`,
    canonicalUrl: publicBaseUrl + '/mapa/',
    social: {
      ...homeContext.social,
      title: `Mapa | ${site.name}`,
      url: publicBaseUrl + '/mapa/'
    }
  }));

  await writeFile('penas/index.html', render('fiestas-2026-penas.njk', {
    ...pageContext(versions),
    title: `Peñas | ${site.name}`,
    meta: { description: 'Mapa público de las peñas de Montemayor de Pililla y sus coordenadas.' },
    canonicalUrl: publicBaseUrl + '/penas/',
    social: {
      ...homeContext.social,
      title: `Peñas | ${site.name}`,
      description: 'Mapa público de las peñas de Montemayor de Pililla y sus coordenadas.',
      imageAlt: `Mapa de peñas de ${site.location.name}`,
      url: publicBaseUrl + '/penas/'
    },
    penas: penaCatalog,
    penasJson: JSON.stringify(penaCatalog),
    penasSourceUrl: penasData.sourceUrl
  }));

  await writeFile('populares/index.html', render('fiestas-2026-popular.njk', {
    ...homeContext,
    title: `Actividades populares | ${site.name}`,
    meta: { description: 'Estas son las actividades más guardadas por los vecinos y vecinas.' },
    canonicalUrl: publicBaseUrl + '/populares/',
    social: {
      ...homeContext.social,
      title: `Actividades populares | ${site.name}`,
      description: 'Estas son las actividades más guardadas por los vecinos y vecinas.',
      imageAlt: `Actividades populares de ${site.fullName}`,
      url: publicBaseUrl + '/populares/'
    }
  }));

  await writeFile('plan/index.html', render('fiestas-2026-plan.njk', {
    ...homeContext,
    title: `Mi plan | ${site.name}`,
    robotsMeta: 'noindex,follow',
    canonicalUrl: publicBaseUrl + '/plan/',
    social: {
      ...homeContext.social,
      title: `Mi plan | ${site.name}`,
      url: publicBaseUrl + '/plan/'
    }
  }));

  await writeFile('plan/importar/index.html', render('fiestas-2026-plan-import.njk', {
    ...homeContext,
    title: `Importar plan | ${site.name}`,
    canonicalUrl: publicBaseUrl + '/plan/importar/',
    robotsMeta: 'noindex,follow',
    social: {
      ...homeContext.social,
      title: `Importar plan | ${site.name}`,
      url: publicBaseUrl + '/plan/importar/'
    }
  }));

  await writeFile('planes/index.html', render('fiestas-2026-community-plans.njk', {
    ...homeContext,
    title: `Planes vecinales | ${site.name}`,
    canonicalUrl: publicBaseUrl + '/planes/',
    social: {
      ...homeContext.social,
      title: `Planes vecinales | ${site.name}`,
      description: `Descubre colecciones de actividades creadas por vecinos para ${site.fullName}.`,
      url: publicBaseUrl + '/planes/'
    }
  }));

  for (const communityPlan of communityPlans) {
    const planPath = `/planes/${communityPlan.id}/`;
    const planTitle = `${communityPlan.name} | Planes vecinales | ${site.name}`;
    const planDescription = `${communityPlan.name}, creado por ${communityPlan.author}, para disfrutar ${site.fullName}.`;
    await writeFile(`planes/${communityPlan.id}/index.html`, render('fiestas-2026-community-plan.njk', {
      ...homeContext,
      title: planTitle,
      meta: { description: planDescription },
      canonicalUrl: publicBaseUrl + planPath,
      social: {
        ...homeContext.social,
        title: planTitle,
        description: planDescription,
        url: publicBaseUrl + planPath
      },
      communityPlan: {
        ...communityPlan,
        pageUrl: publicBaseUrl + planPath
      }
    }));
  }

  for (const event of events) {
    await writeFile('e/' + event.id + '/' + event.slug + '/index.html', render('fiestas-2026-detail.njk', {
      ...pageContext(versions),
      title: event.title + ' | ' + site.name,
      meta: { description: event.summary || event.description || event.dateLabel },
      canonicalUrl: publicBaseUrl + event.urlPath,
      social: {
        type: 'article', title: event.title + ' | ' + site.name,
        description: event.summary || event.description || event.dateLabel,
        image: eventImageUrl(event),
        imageAlt: event.image ? event.title : event.socialImageAlt,
        imageWidth: event.image ? 1200 : event.socialImageWidth,
        imageHeight: event.image ? 630 : event.socialImageHeight,
        imageType: 'image/jpeg', url: publicBaseUrl + event.urlPath
      },
      event,
      structuredData: eventStructuredData(event),
      relatedEvents: getRelatedEvents(events, event),
      communityPlansForEvent: communityPlanMemberships.get(event.id) || [],
      hideDrawerFilters: true
    }));
  }

  const urls = ['/', '/mapa/', '/penas/', '/populares/', '/planes/', ...communityPlans.map((plan) => `/planes/${plan.id}/`), ...events.map((event) => event.urlPath)];
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => '  <url><loc>' + publicBaseUrl + url + '</loc></url>'),
    '</urlset>',
    ''
  ].join('\n');
  await writeFile('sitemap.xml', sitemap);
  await writeFile('robots.txt', ['User-agent: *', 'Allow: /', 'Sitemap: ' + publicBaseUrl + '/sitemap.xml', ''].join('\n'));
  await writeFile('CNAME', `${new URL(publicBaseUrl).hostname}\n`);
  await writeFile('calendar.ics', createCalendarFeed(events));
  await writeFile('rss.xml', createRssFeed(events));
  console.log('Built fiestas repo with ' + events.length + ' events.');
}

function getRelatedEvents(events, event, limit = 3) {
  return events
    .filter((candidate) => candidate.id !== event.id && candidate.type === event.type)
    .map((candidate) => ({
      event: candidate,
      score: stableHash(event.id + ':' + candidate.id)
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ event: candidate }) => candidate);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
