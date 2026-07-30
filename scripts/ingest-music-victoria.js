import { load } from 'cheerio';
import { dedupeKey, loadVenueMap, loadExistingEventKeys, insertEvents } from './lib/supabase.js';
import { MELBOURNE_METRO_SUBURBS } from './lib/melbourne-suburbs.js';

const GIG_GUIDE_URL = 'https://www.musicvictoria.com.au/resources/gig-guide/';
const USER_AGENT = 'Mozilla/5.0 (compatible; NaarmEventsBot/1.0)';

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Header text looks like "Wednesday | 29 July 2026" — day name is redundant,
// we just need the "29 July 2026" part.
function parseDateTitle(text) {
  const datePart = text.split('|').pop().trim();
  const match = datePart.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const monthIndex = MONTHS[monthName.toLowerCase()];
  if (monthIndex === undefined) return null;
  const d = new Date(Number(year), monthIndex, Number(day));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Venue Name, Suburb" — reliable for ~99% of listings (checked against the full feed).
function splitVenue(venueText) {
  const lastComma = venueText.lastIndexOf(',');
  if (lastComma === -1) return { venue: venueText.trim(), suburbFromSource: null };
  return {
    venue: venueText.slice(0, lastComma).trim(),
    suburbFromSource: venueText.slice(lastComma + 1).trim(),
  };
}

async function fetchGigGuideHtml() {
  const res = await fetch(GIG_GUIDE_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Music Victoria gig guide fetch failed (${res.status})`);
  return res.text();
}

// The whole gig guide (no pagination) lives under one .gigs container as alternating
// <h2 class="date-title"> / <div class="date-grid"> pairs, one pair per date.
function parseGigGuide(html) {
  const $ = load(html);
  const results = [];
  let currentDate = null;

  $('.gigs').children().each((_, el) => {
    const $el = $(el);
    if ($el.hasClass('date-title')) {
      currentDate = parseDateTitle($el.text().trim());
      return;
    }
    if (!$el.hasClass('date-grid') || !currentDate) return;

    $el.find('.event').each((_, eventEl) => {
      const $event = $(eventEl);
      const name = $event.find('.name').text().trim();
      const venueText = $event.find('.venue').text().trim();
      const sourceUrl = $event.find('.tickets a').attr('href') || null;
      if (!name || !venueText) return;
      results.push({ name, dateStart: currentDate, venueText, sourceUrl });
    });
  });

  return results;
}

// Music Victoria covers all of Victoria, not just Melbourne. When the source explicitly
// names a suburb, only keep it if it's a known Melbourne-metro suburb — a regional town
// showing up here is confirmed out-of-scope, not just "unknown", so we skip it outright
// rather than inserting it with a misleading suburb value.
function mapEvent(raw, venueMap) {
  const { venue, suburbFromSource } = splitVenue(raw.venueText);
  if (suburbFromSource && !MELBOURNE_METRO_SUBURBS.has(suburbFromSource.toLowerCase())) return null;

  const venueInfo = venueMap.get(venue.toLowerCase());

  return {
    name: raw.name,
    date_start: raw.dateStart,
    date_end: null,
    event_time: null, // not shown on this listing
    venue,
    suburb: suburbFromSource || venueInfo?.suburb || 'unknown',
    category: 'Music', // this is specifically a music gig guide
    price: 'unknown', // every listing just says "Buy Tickets", no free/paid indication
    source_url: raw.sourceUrl,
    source_name: 'music_victoria',
    image_url: venueInfo?.image_url ?? null,
  };
}

async function main() {
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

  console.log('Fetching venues and existing events from Supabase...');
  const [venueMap, existingKeys] = await Promise.all([loadVenueMap(), loadExistingEventKeys()]);

  console.log('Fetching Music Victoria gig guide (single page, no pagination needed)...');
  const html = await fetchGigGuideHtml();
  const rawEvents = parseGigGuide(html).filter((e) => e.dateStart >= todayISO);

  const toInsert = [];
  const seenThisRun = new Set();
  let skippedDuplicate = 0;
  let skippedNonMelbourne = 0;
  let unknownSuburb = 0;

  for (const raw of rawEvents) {
    const mapped = mapEvent(raw, venueMap);
    if (!mapped) {
      skippedNonMelbourne++;
      continue;
    }

    const key = dedupeKey(mapped.name, mapped.date_start, mapped.venue);
    if (existingKeys.has(key) || seenThisRun.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seenThisRun.add(key);

    if (mapped.suburb === 'unknown') unknownSuburb++;

    toInsert.push(mapped);
  }

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} new events...`);
    await insertEvents(toInsert);
  }

  console.log('\n--- Summary ---');
  console.log(`Upcoming gigs found:       ${rawEvents.length}`);
  console.log(`Inserted:                  ${toInsert.length}`);
  console.log(`Skipped (duplicates):      ${skippedDuplicate}`);
  console.log(`Skipped (outside Melbourne):${skippedNonMelbourne}`);
  console.log(`Unknown suburb (inserted): ${unknownSuburb}`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
