import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const agenda = document.getElementById('agenda');
const status = document.getElementById('status');
const regionFilter = document.getElementById('filter-region');
const suburbToggle = document.getElementById('suburb-multiselect-toggle');
const suburbPanel = document.getElementById('suburb-multiselect-panel');
const categoryFilter = document.getElementById('filter-category');
const searchInput = document.getElementById('filter-search');
const resultCount = document.getElementById('result-count');
const quickFilters = document.getElementById('quick-filters');
const freeFilter = document.getElementById('filter-free');

let allEvents = [];
let activeRange = 'all';
let freeOnly = false;
let selectedSuburbs = new Set();

// --- Local-date helpers -----------------------------------------------
// IMPORTANT: never use Date#toISOString() here. It converts to UTC, and
// Melbourne is 10-11 hours ahead of UTC, so for roughly the first third of
// each Melbourne day toISOString() still reports *yesterday's* date. That
// bug is what made "Tomorrow" show today's events. Everything below does
// plain local-calendar arithmetic instead.

function isoFromDateObj(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() {
  return isoFromDateObj(new Date());
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return isoFromDateObj(new Date(y, m - 1, d + days));
}

// Friday/Saturday/Sunday of the *next* (or current, if today is already
// within it) weekend.
function upcomingWeekend() {
  const dayOfWeek = new Date().getDay(); // 0=Sun..6=Sat
  // Days from today to the Friday of "this" weekend: negative if that Friday
  // already happened (i.e. today is Sat/Sun and we mean the current weekend).
  const daysUntilFriday = { 0: -2, 1: 4, 2: 3, 3: 2, 4: 1, 5: 0, 6: -1 }[dayOfWeek];
  const friday = addDays(todayISO(), daysUntilFriday);
  return { friday, saturday: addDays(friday, 1), sunday: addDays(friday, 2) };
}

// --- Category / suburb normalization -----------------------------------
// Ticketmaster and RRR each use their own vocabulary for what's really the
// same real-world grouping. This maps raw source values to one canonical
// label. Extend these objects as new sources introduce new spellings.
const CATEGORY_GROUPS = {
  theatre: 'Arts & Theatre',
  'arts & theatre': 'Arts & Theatre',
  gig: 'Music',
  music: 'Music',
  sports: 'Sports',
  miscellaneous: 'Miscellaneous',
  undefined: null,
};

const SUBURB_GROUPS = {
  'brunswick east': 'Brunswick',
};

function normalize(raw, groupMap) {
  if (!raw) return raw;
  const key = raw.trim().toLowerCase();
  return key in groupMap ? groupMap[key] : raw;
}

const normalizeCategory = (raw) => normalize(raw, CATEGORY_GROUPS);
const normalizeSuburb = (raw) => normalize(raw, SUBURB_GROUPS);

// --- Region grouping -----------------------------------------------------
// Broad regions for quick browsing, on top of the precise per-suburb list
// (kept separately as a multi-select for anyone who wants exact suburbs
// rather than a whole region). Order here also controls dropdown order.
const REGION_ORDER = [
  'City', 'Inner North', 'Inner East', 'Bayside', 'Inner West',
  'Outer East', 'South East', 'North', 'West',
];

const SUBURB_REGIONS = {
  // City
  melbourne: 'City', 'melbourne cbd': 'City', southbank: 'City', docklands: 'City',
  'east melbourne': 'City', 'north melbourne': 'City', 'west melbourne': 'City',
  'south wharf': 'City', parkville: 'City',
  // Inner North
  carlton: 'Inner North', 'carlton north': 'Inner North', fitzroy: 'Inner North',
  'fitzroy north': 'Inner North', collingwood: 'Inner North', abbotsford: 'Inner North',
  'clifton hill': 'Inner North', northcote: 'Inner North', thornbury: 'Inner North',
  preston: 'Inner North', reservoir: 'Inner North', brunswick: 'Inner North',
  'brunswick east': 'Inner North', 'brunswick west': 'Inner North', coburg: 'Inner North',
  'coburg north': 'Inner North', 'pascoe vale': 'Inner North', 'pascoe vale south': 'Inner North',
  fawkner: 'Inner North', batman: 'Inner North', merlynston: 'Inner North',
  // Inner East
  richmond: 'Inner East', cremorne: 'Inner East', burnley: 'Inner East', hawthorn: 'Inner East',
  'hawthorn east': 'Inner East', kew: 'Inner East', 'kew east': 'Inner East', camberwell: 'Inner East',
  canterbury: 'Inner East', balwyn: 'Inner East', 'balwyn north': 'Inner East', 'surrey hills': 'Inner East',
  'box hill': 'Inner East', 'glen iris': 'Inner East', malvern: 'Inner East', 'malvern east': 'Inner East',
  toorak: 'Inner East', armadale: 'Inner East', prahran: 'Inner East', windsor: 'Inner East',
  'south yarra': 'Inner East',
  // Bayside
  'st kilda': 'Bayside', 'st kilda east': 'Bayside', 'st kilda west': 'Bayside', elwood: 'Bayside',
  balaclava: 'Bayside', ripponlea: 'Bayside', caulfield: 'Bayside', 'caulfield north': 'Bayside',
  'caulfield south': 'Bayside', 'caulfield east': 'Bayside', 'port melbourne': 'Bayside',
  'south melbourne': 'Bayside', 'albert park': 'Bayside', 'middle park': 'Bayside', brighton: 'Bayside',
  'brighton east': 'Bayside', elsternwick: 'Bayside', gardenvale: 'Bayside', hampton: 'Bayside',
  sandringham: 'Bayside', 'black rock': 'Bayside', beaumaris: 'Bayside',
  // Inner West
  footscray: 'Inner West', yarraville: 'Inner West', seddon: 'Inner West', kingsville: 'Inner West',
  maidstone: 'Inner West', maribyrnong: 'Inner West', 'west footscray': 'Inner West',
  braybrook: 'Inner West', tottenham: 'Inner West', sunshine: 'Inner West', 'sunshine north': 'Inner West',
  'sunshine west': 'Inner West', 'ascot vale': 'Inner West', 'moonee ponds': 'Inner West',
  essendon: 'Inner West', 'essendon north': 'Inner West', aberfeldie: 'Inner West', flemington: 'Inner West',
  kensington: 'Inner West', newmarket: 'Inner West', 'avondale heights': 'Inner West', niddrie: 'Inner West',
  'airport west': 'Inner West', keilor: 'Inner West', 'keilor east': 'Inner West', 'keilor park': 'Inner West',
  // Outer East
  blackburn: 'Outer East', 'blackburn north': 'Outer East', 'blackburn south': 'Outer East',
  nunawading: 'Outer East', ringwood: 'Outer East', 'ringwood east': 'Outer East', mitcham: 'Outer East',
  vermont: 'Outer East', 'vermont south': 'Outer East', wantirna: 'Outer East', 'wantirna south': 'Outer East',
  bayswater: 'Outer East', 'bayswater north': 'Outer East', 'ferntree gully': 'Outer East',
  'upper ferntree gully': 'Outer East', boronia: 'Outer East', knoxfield: 'Outer East', rowville: 'Outer East',
  scoresby: 'Outer East', 'wheelers hill': 'Outer East', 'glen waverley': 'Outer East',
  'mount waverley': 'Outer East', syndal: 'Outer East', clayton: 'Outer East', 'clayton south': 'Outer East',
  'notting hill': 'Outer East', oakleigh: 'Outer East', huntingdale: 'Outer East', chadstone: 'Outer East',
  ashburton: 'Outer East', ashwood: 'Outer East', burwood: 'Outer East', 'burwood east': 'Outer East',
  'forest hill': 'Outer East', alamein: 'Outer East', hartwell: 'Outer East', willison: 'Outer East',
  riversdale: 'Outer East', croydon: 'Outer East', kilsyth: 'Outer East', montrose: 'Outer East',
  mooroolbark: 'Outer East', lilydale: 'Outer East', 'chirnside park': 'Outer East', 'the basin': 'Outer East',
  upwey: 'Outer East', tecoma: 'Outer East', belgrave: 'Outer East', 'ferny creek': 'Outer East',
  doncaster: 'Outer East', 'doncaster east': 'Outer East', templestowe: 'Outer East',
  'templestowe lower': 'Outer East', warrandyte: 'Outer East', bulleen: 'Outer East', eaglemont: 'Outer East',
  ivanhoe: 'Outer East', 'ivanhoe east': 'Outer East', heidelberg: 'Outer East',
  // South East
  mordialloc: 'South East', aspendale: 'South East', edithvale: 'South East', chelsea: 'South East',
  bonbeach: 'South East', carrum: 'South East', 'carrum downs': 'South East', 'patterson lakes': 'South East',
  seaford: 'South East', frankston: 'South East', 'frankston south': 'South East',
  'frankston north': 'South East', 'mount eliza': 'South East', langwarrin: 'South East', skye: 'South East',
  springvale: 'South East', 'noble park': 'South East', dandenong: 'South East', keysborough: 'South East',
  'dingley village': 'South East', braeside: 'South East', westall: 'South East',
  'sandown village': 'South East', cranbourne: 'South East', hallam: 'South East',
  'narre warren': 'South East', berwick: 'South East', officer: 'South East', beaconsfield: 'South East',
  pakenham: 'South East', 'east pakenham': 'South East', moorabbin: 'South East', bentleigh: 'South East',
  'bentleigh east': 'South East', mckinnon: 'South East', ormond: 'South East', glenhuntly: 'South East',
  carnegie: 'South East', murrumbeena: 'South East', hughesdale: 'South East', cheltenham: 'South East',
  highett: 'South East',
  // North
  broadmeadows: 'North', jacana: 'North', craigieburn: 'North', 'roxburgh park': 'North',
  coolaroo: 'North', campbellfield: 'North', tullamarine: 'North', 'gladstone park': 'North',
  greenvale: 'North', gowrie: 'North', upfield: 'North', epping: 'North', 'south morang': 'North',
  'mill park': 'North', bundoora: 'North', thomastown: 'North', lalor: 'North', mernda: 'North',
  doreen: 'North', wollert: 'North', eltham: 'North', 'diamond creek': 'North', 'wattle glen': 'North',
  hurstbridge: 'North', research: 'North', greensborough: 'North', watsonia: 'North', whittlesea: 'North',
  // West
  'middle footscray': 'West', sunbury: 'West', 'diggers rest': 'West', watergardens: 'West',
  'taylors lakes': 'West', 'caroline springs': 'West', delahey: 'West', sydenham: 'West',
  hillside: 'West', kealba: 'West', williamstown: 'West', newport: 'West', spotswood: 'West',
  altona: 'West', 'altona north': 'West', 'altona meadows': 'West', laverton: 'West',
  'williams landing': 'West', 'point cook': 'West', werribee: 'West', 'werribee south': 'West',
  'hoppers crossing': 'West', tarneit: 'West', truganina: 'West', 'wyndham vale': 'West',
  melton: 'West', 'melton south': 'West', 'melton west': 'West', 'st albans': 'West',
  'saint albans': 'West', 'deer park': 'West', albion: 'West', ardeer: 'West', ginifer: 'West',
};

function regionOf(suburb) {
  if (!suburb) return null;
  return SUBURB_REGIONS[suburb.trim().toLowerCase()] ?? null;
}

// --- Free-event inference ------------------------------------------------
// Most sources never actually say whether an event is free. Rather than leave
// everything "unknown", we flag a conservative set of cases where it's a safe
// bet: specific venues that are consistently free-entry, and event-name
// patterns (open mic, trivia, etc.) that are free almost by definition. This
// is an inference, not a fact — it's labelled "Likely free" (never plain
// "Free") and the UI carries a disclaimer. Extend LIKELY_FREE_VENUES as you
// personally know of others; the name patterns are general conventions about
// event types, not guesses about any one specific unknown fact.
const LIKELY_FREE_VENUES = new Set(['brunswick artists bar'].map((v) => v.toLowerCase()));

const LIKELY_FREE_NAME_PATTERNS = [
  /open mic/i,
  /\bjam\s*(night|session)?\b/i,
  /trivia/i,
  /quiz night/i,
  /poetry reading/i,
  /spoken word/i,
  /artist talk/i,
  /vinyl (night|session)/i,
];

function inferPrice(event) {
  if (event.price !== 'unknown') return event.price; // trust explicit 'free'/'paid' data as-is
  if (event.venue && LIKELY_FREE_VENUES.has(event.venue.trim().toLowerCase())) return 'likely_free';
  if (LIKELY_FREE_NAME_PATTERNS.some((re) => re.test(event.name))) return 'likely_free';
  return 'unknown';
}

// Theatre/musical seasons repeat the same show under many session rows (e.g.
// "Steel Magnolias" playing 20+ nights). For Arts & Theatre only, collapse each
// (name, venue) group down to its single nearest-upcoming row, and stretch
// date_end to the last known session so the row can show "Until <date>"
// instead of a single showtime. Other categories are left untouched.
function collapseTheatreRuns(events) {
  const passthrough = [];
  const groups = new Map();

  for (const event of events) {
    if (event.category !== 'Arts & Theatre') {
      passthrough.push(event);
      continue;
    }
    const key = `${event.name}|${event.venue}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  const collapsed = [...groups.values()].map((group) => {
    group.sort((a, b) => a.date_start.localeCompare(b.date_start));
    const nearest = group[0];
    const lastSessionEnd = group.reduce((latest, e) => {
      const end = e.date_end ?? e.date_start;
      return end > latest ? end : latest;
    }, nearest.date_end ?? nearest.date_start);

    return { ...nearest, date_end: group.length > 1 ? lastSessionEnd : nearest.date_end, isRun: group.length > 1 };
  });

  return [...passthrough, ...collapsed].sort((a, b) => a.date_start.localeCompare(b.date_start));
}

async function fetchUpcomingEvents() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/events`);
  url.searchParams.set('select', '*');
  url.searchParams.set('date_start', `gte.${todayISO()}`);
  url.searchParams.set('order', 'date_start.asc');
  url.searchParams.set('limit', '5000');

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
  const rows = await res.json();
  const normalized = rows.map((e) => ({
    ...e,
    category: normalizeCategory(e.category),
    suburb: normalizeSuburb(e.suburb),
    price: inferPrice(e),
  }));
  return collapseTheatreRuns(normalized);
}

function formatDayHeader(dateStart) {
  return new Date(dateStart + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatDateRange(dateStart, dateEnd) {
  if (!dateEnd || dateEnd === dateStart) return null;
  const opts = { day: 'numeric', month: 'short' };
  const end = new Date(dateEnd + 'T00:00:00').toLocaleDateString('en-AU', opts);
  return `Until ${end}`;
}

// Minimal monochrome line-icon fallback, used whenever an event has no
// image. Keyed by canonical category; anything unmapped falls through to
// a generic "star" glyph.
const CATEGORY_ICONS = {
  Music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'Arts & Theatre': '<path d="M4 3c3 3 3 6 0 9s-3 6 0 9M20 3c-3 3-3 6 0 9s3 6 0 9"/>',
  Sports: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  Exhibition: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-4 4-3-3-5 5"/>',
};
const DEFAULT_ICON = '<path d="M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1"/>';

function categoryIconSvg(category) {
  const inner = CATEGORY_ICONS[category] ?? DEFAULT_ICON;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${inner}</svg>`;
}

function populateFilterOptions() {
  const suburbs = [...new Set(allEvents.map((e) => e.suburb).filter(Boolean))].sort();
  const categories = [...new Set(allEvents.map((e) => e.category).filter(Boolean))].sort();
  const regionsPresent = new Set(allEvents.map((e) => regionOf(e.suburb)).filter(Boolean));
  const regions = REGION_ORDER.filter((r) => regionsPresent.has(r));

  for (const region of regions) {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    regionFilter.appendChild(option);
  }

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  }

  for (const suburb of suburbs) {
    const label = document.createElement('label');
    label.className = 'multiselect__option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = suburb;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedSuburbs.add(suburb);
      else selectedSuburbs.delete(suburb);
      updateSuburbToggleLabel();
      applyFilters();
    });
    const labelText = document.createElement('span');
    labelText.textContent = suburb;
    label.append(checkbox, labelText);
    suburbPanel.appendChild(label);
  }
}

function updateSuburbToggleLabel() {
  if (selectedSuburbs.size === 0) suburbToggle.textContent = 'All suburbs';
  else if (selectedSuburbs.size <= 2) suburbToggle.textContent = [...selectedSuburbs].join(', ');
  else suburbToggle.textContent = `${selectedSuburbs.size} suburbs`;
}

function positionSuburbPanel() {
  const rect = suburbToggle.getBoundingClientRect();
  const panelWidth = suburbPanel.offsetWidth || 200;
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - panelWidth - 8);
  suburbPanel.style.top = `${rect.bottom + 4}px`;
  suburbPanel.style.left = `${left}px`;
}

suburbToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  suburbPanel.hidden = !suburbPanel.hidden;
  if (!suburbPanel.hidden) positionSuburbPanel();
});

document.addEventListener('click', (e) => {
  if (!suburbPanel.hidden && !e.target.closest('#suburb-multiselect')) suburbPanel.hidden = true;
});

function buildThumbLink(event) {
  const link = document.createElement('a');
  link.href = event.source_url ?? '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'event-row__thumb-link';

  function showFallbackIcon() {
    link.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'event-row__thumb event-row__thumb--fallback';
    div.innerHTML = categoryIconSvg(event.category);
    link.appendChild(div);
  }

  if (event.image_url) {
    const img = document.createElement('img');
    img.className = 'event-row__thumb';
    img.src = event.image_url;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', showFallbackIcon, { once: true });
    link.appendChild(img);
  } else {
    showFallbackIcon();
  }

  return link;
}

function renderEventRow(event) {
  const row = document.createElement('article');
  row.className = 'event-row';

  const untilText = formatDateRange(event.date_start, event.date_end);
  const timeText = event.event_time ? event.event_time.slice(0, 5) : null;

  const metaParts = [event.venue ?? 'Venue TBA'];
  if (event.suburb && event.suburb !== 'unknown') metaParts.push(event.suburb);
  if (event.isRun) {
    // A collapsed theatre/musical run: show the season's end date instead of
    // a single showtime, since this row now represents many sessions.
    if (untilText) metaParts.push(untilText);
  } else {
    if (timeText) metaParts.push(timeText);
    if (untilText) metaParts.push(untilText);
  }

  row.appendChild(buildThumbLink(event));

  const body = document.createElement('div');
  body.className = 'event-row__body';
  body.innerHTML = `
    <h3 class="event-row__title">
      <a href="${event.source_url ?? '#'}" target="_blank" rel="noopener noreferrer">${event.name}</a>
    </h3>
    <p class="event-row__meta">${metaParts.join(' · ')}</p>
  `;
  row.appendChild(body);

  const priceBadge = { free: 'Free', likely_free: 'Likely free', paid: 'Paid' }[event.price];

  if (event.category || priceBadge) {
    const tags = document.createElement('div');
    tags.className = 'event-row__tags';
    tags.innerHTML = `
      ${event.category ? `<span class="badge">${event.category}</span>` : ''}
      ${priceBadge ? `<span class="badge badge--price">${priceBadge}</span>` : ''}
    `;
    row.appendChild(tags);
  }

  return row;
}

function renderAgenda(events) {
  agenda.innerHTML = '';
  resultCount.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;

  if (events.length === 0) {
    agenda.innerHTML = '<p class="empty-state">No events match those filters.</p>';
    return;
  }

  let currentDay = null;
  let dayList = null;

  for (const event of events) {
    if (event.date_start !== currentDay) {
      currentDay = event.date_start;
      const group = document.createElement('section');
      group.className = 'day-group';
      const header = document.createElement('h2');
      header.className = 'day-header';
      header.textContent = formatDayHeader(currentDay);
      dayList = document.createElement('div');
      dayList.className = 'day-list';
      group.append(header, dayList);
      agenda.appendChild(group);
    }
    dayList.appendChild(renderEventRow(event));
  }
}

function matchesRange(event) {
  if (activeRange === 'all') return true;
  if (activeRange === 'today') return event.date_start === todayISO();
  if (activeRange === 'tomorrow') return event.date_start === addDays(todayISO(), 1);
  if (activeRange === 'weekend') {
    const { friday, sunday } = upcomingWeekend();
    return event.date_start >= friday && event.date_start <= sunday;
  }
  return true;
}

function applyFilters() {
  const region = regionFilter.value;
  const category = categoryFilter.value;
  const search = searchInput.value.trim().toLowerCase();

  const filtered = allEvents.filter((e) => {
    if (!matchesRange(e)) return false;
    if (freeOnly && e.price !== 'free' && e.price !== 'likely_free') return false;
    if (region && regionOf(e.suburb) !== region) return false;
    if (selectedSuburbs.size > 0 && !selectedSuburbs.has(e.suburb)) return false;
    if (category && e.category !== category) return false;
    if (search && !`${e.name} ${e.venue ?? ''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  renderAgenda(filtered);
}

for (const el of [regionFilter, categoryFilter]) el.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

quickFilters.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip[data-range]');
  if (!chip) return;
  activeRange = chip.dataset.range;
  for (const c of quickFilters.querySelectorAll('.chip[data-range]')) c.classList.toggle('is-active', c === chip);
  applyFilters();
});

freeFilter.addEventListener('click', () => {
  freeOnly = !freeOnly;
  freeFilter.classList.toggle('is-active', freeOnly);
  applyFilters();
});

async function init() {
  try {
    allEvents = await fetchUpcomingEvents();
    status.remove();
    populateFilterOptions();
    renderAgenda(allEvents);
  } catch (err) {
    status.textContent = `Something went wrong loading events: ${err.message}`;
    status.classList.add('status--error');
  }
}

init();
