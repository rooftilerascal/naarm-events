import 'dotenv/config';
import { dedupeKey, loadVenueMap, loadExistingEventKeys, insertEvents } from './lib/supabase.js';

const { TICKETMASTER_API_KEY } = process.env;
if (!TICKETMASTER_API_KEY) {
  console.error('Missing required env var: TICKETMASTER_API_KEY');
  process.exit(1);
}

const TM_BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';
const PAGE_SIZE = 200;
const MAX_PAGES = 5; // Ticketmaster caps deep paging at page*size <= 1000
const REQUEST_DELAY_MS = 250; // stay under the 5 req/sec free-tier limit

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllTicketmasterEvents() {
  const allEvents = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(TM_BASE_URL);
    url.searchParams.set('apikey', TICKETMASTER_API_KEY);
    url.searchParams.set('countryCode', 'AU');
    url.searchParams.set('city', 'Melbourne');
    url.searchParams.set('size', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ticketmaster API error ${res.status}: ${body}`);
    }
    const data = await res.json();
    const pageEvents = data._embedded?.events ?? [];
    allEvents.push(...pageEvents);

    const totalPages = data.page?.totalPages ?? 1;
    if (page >= totalPages - 1) break;

    await sleep(REQUEST_DELAY_MS);
  }
  return allEvents;
}

function pickImageUrl(images) {
  if (!images || images.length === 0) return null;
  const widescreen = images.filter((img) => img.ratio === '16_9');
  const pool = widescreen.length > 0 ? widescreen : images;
  const best = pool.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a), pool[0]);
  return best.url ?? null;
}

function mapTicketmasterEvent(tmEvent, venueMap) {
  const name = tmEvent.name;
  const dateStart = tmEvent.dates?.start?.localDate ?? null;
  if (!name || !dateStart) return null; // required fields — skip TBA/undated events

  const dateEnd = tmEvent.dates?.end?.localDate ?? null;
  const eventTime = tmEvent.dates?.start?.localTime ?? null;
  const venue = tmEvent._embedded?.venues?.[0]?.name ?? null;
  const category = tmEvent.classifications?.[0]?.segment?.name ?? null;
  const price = tmEvent.priceRanges && tmEvent.priceRanges.length > 0 ? 'paid' : 'unknown';
  const sourceUrl = tmEvent.url ?? null;
  const venueInfo = venue ? venueMap.get(venue.trim().toLowerCase()) : null;
  const imageUrl = pickImageUrl(tmEvent.images) ?? venueInfo?.image_url ?? null;

  const suburb = venueInfo?.suburb ?? 'unknown';

  return {
    name,
    date_start: dateStart,
    date_end: dateEnd,
    event_time: eventTime,
    venue,
    suburb,
    category,
    price,
    source_url: sourceUrl,
    source_name: 'ticketmaster',
    image_url: imageUrl,
  };
}

async function main() {
  console.log('Fetching venues and existing events from Supabase...');
  const [venueMap, existingKeys] = await Promise.all([loadVenueMap(), loadExistingEventKeys()]);

  console.log('Fetching events from Ticketmaster (Melbourne, AU)...');
  const tmEvents = await fetchAllTicketmasterEvents();

  const toInsert = [];
  const seenThisRun = new Set();
  let skippedNoDate = 0;
  let skippedDuplicate = 0;
  let unknownSuburb = 0;

  for (const tmEvent of tmEvents) {
    const mapped = mapTicketmasterEvent(tmEvent, venueMap);
    if (!mapped) {
      skippedNoDate++;
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
  console.log(`Fetched from Ticketmaster: ${tmEvents.length}`);
  console.log(`Inserted:                 ${toInsert.length}`);
  console.log(`Skipped (duplicates):     ${skippedDuplicate}`);
  console.log(`Skipped (no usable date): ${skippedNoDate}`);
  console.log(`Unknown suburb (inserted):${unknownSuburb}`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
