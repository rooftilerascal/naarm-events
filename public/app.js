import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const agenda = document.getElementById('agenda');
const status = document.getElementById('status');
const suburbFilter = document.getElementById('filter-suburb');
const categoryFilter = document.getElementById('filter-category');
const sourceFilter = document.getElementById('filter-source');
const searchInput = document.getElementById('filter-search');
const resultCount = document.getElementById('result-count');
const quickFilters = document.getElementById('quick-filters');

let allEvents = [];
let activeRange = 'all';

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
  url.searchParams.set('limit', '1000');

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
  const rows = await res.json();
  const normalized = rows.map((e) => ({ ...e, category: normalizeCategory(e.category), suburb: normalizeSuburb(e.suburb) }));
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

function sourceLabel(sourceName) {
  return {
    ticketmaster: 'Ticketmaster',
    rrr_gig_guide: 'RRR Gig Guide',
    art_openings_melbourne: 'Art Openings Melbourne',
  }[sourceName] ?? sourceName;
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
  const sources = [...new Set(allEvents.map((e) => e.source_name).filter(Boolean))].sort();

  for (const [select, values, labelFn] of [
    [suburbFilter, suburbs, (v) => v],
    [categoryFilter, categories, (v) => v],
    [sourceFilter, sources, sourceLabel],
  ]) {
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labelFn(value);
      select.appendChild(option);
    }
  }
}

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

  if (event.category) {
    const tags = document.createElement('div');
    tags.className = 'event-row__tags';
    tags.innerHTML = `<span class="badge">${event.category}</span>`;
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
  const suburb = suburbFilter.value;
  const category = categoryFilter.value;
  const source = sourceFilter.value;
  const search = searchInput.value.trim().toLowerCase();

  const filtered = allEvents.filter((e) => {
    if (!matchesRange(e)) return false;
    if (suburb && e.suburb !== suburb) return false;
    if (category && e.category !== category) return false;
    if (source && e.source_name !== source) return false;
    if (search && !`${e.name} ${e.venue ?? ''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  renderAgenda(filtered);
}

for (const el of [suburbFilter, categoryFilter, sourceFilter]) el.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

quickFilters.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeRange = chip.dataset.range;
  for (const c of quickFilters.querySelectorAll('.chip')) c.classList.toggle('is-active', c === chip);
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
