import { load } from 'cheerio';
import { dedupeKey, loadVenueMap, loadExistingEventKeys, insertEvents } from './lib/supabase.js';
import { RRR_USER_AGENT, resolveMoreInfoUrl } from './lib/rrr.js';

const RRR_BASE_URL = 'https://www.rrr.org.au';
const GIG_GUIDE_CALENDAR_ID = 2;
const MAX_PAGES = 20; // safety cap; real loop stops as soon as a page has no cards
const REQUEST_DELAY_MS = 500; // be polite, this is a small community station's site

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// RRR's teaser cards show dates like "Monday, 27 July" or a range "31 July – 1 August" — no year.
// We infer the year from today's date: if the parsed day+month has already passed by more than a
// month, assume it means next year (handles the Dec -> Jan rollover for events near year-end).
function resolveYear(day, monthIndex, referenceDate) {
  const candidate = new Date(referenceDate.getFullYear(), monthIndex, day);
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - 30);
  if (candidate < cutoff) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
}

function parseDayMonth(text, referenceDate) {
  const match = text.trim().match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthIndex = MONTHS[match[2].toLowerCase()];
  if (monthIndex === undefined) return null;
  const date = resolveYear(day, monthIndex, referenceDate);
  return date.toISOString().slice(0, 10);
}

function parseRrrDate(rawText, referenceDate) {
  const text = rawText.trim();
  if (!text) return { dateStart: null, dateEnd: null };

  // Range, e.g. "31 July – 1 August" (no weekday prefix on ranges)
  if (text.includes('–')) {
    const [startPart, endPart] = text.split('–').map((s) => s.trim());
    return { dateStart: parseDayMonth(startPart, referenceDate), dateEnd: parseDayMonth(endPart, referenceDate) };
  }

  // Single date, e.g. "Monday, 27 July"
  const parts = text.split(',').map((s) => s.trim());
  const dayMonthPart = parts.length > 1 ? parts[1] : parts[0];
  return { dateStart: parseDayMonth(dayMonthPart, referenceDate), dateEnd: null };
}

async function fetchGigGuidePage(page) {
  const url = new URL(`${RRR_BASE_URL}/events`);
  url.searchParams.set('calendar_ids[]', String(GIG_GUIDE_CALENDAR_ID));
  url.searchParams.set('page', String(page));

  const res = await fetch(url, { headers: { 'User-Agent': RRR_USER_AGENT } });
  if (!res.ok) throw new Error(`RRR events page ${page} failed (${res.status})`);
  return res.text();
}

function parseGigGuideCards(html, referenceDate) {
  const $ = load(html);
  const results = [];

  $('.grid-col--3').each((_, el) => {
    const $card = $(el);
    const name = $card.find('.card__title a').text().trim();
    const href = $card.find('.card__title a').attr('href');
    const dateText = $card.find('span.card__meta > div').eq(0).text().trim();
    const venueText = $card.find('span.card__meta > div').eq(1).text().trim();
    const category = $card.find('.card__label').text().trim() || null;
    const imageUrl = $card.find('img').attr('src') || null;

    if (!name || !href) return;

    const { dateStart, dateEnd } = parseRrrDate(dateText, referenceDate);
    results.push({
      name,
      dateStart,
      dateEnd,
      venue: venueText || null,
      category,
      imageUrl,
      sourceUrl: RRR_BASE_URL + href,
    });
  });

  return results;
}

async function fetchAllGigGuideEvents() {
  const referenceDate = new Date();
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchGigGuidePage(page);
    const cards = parseGigGuideCards(html, referenceDate);
    if (cards.length === 0) break;
    all.push(...cards);
    await sleep(REQUEST_DELAY_MS);
  }
  return all;
}

function mapRrrEvent(card, venueMap) {
  if (!card.name || !card.dateStart) return null; // required fields — skip undated cards

  const venueInfo = card.venue ? venueMap.get(card.venue.trim().toLowerCase()) : null;

  return {
    name: card.name,
    date_start: card.dateStart,
    date_end: card.dateEnd,
    event_time: null, // not shown on RRR's listing page
    venue: card.venue,
    suburb: venueInfo?.suburb ?? 'unknown',
    category: card.category,
    price: 'unknown', // not shown on RRR's listing page
    source_url: card.sourceUrl, // may get replaced with a resolved "more info" link below
    source_name: 'rrr_gig_guide',
    image_url: card.imageUrl ?? venueInfo?.image_url ?? null,
  };
}

async function main() {
  console.log('Fetching venues and existing events from Supabase...');
  const [venueMap, existingKeys] = await Promise.all([loadVenueMap(), loadExistingEventKeys()]);

  console.log('Scraping RRR Gig Guide (this fetches multiple pages, one request at a time)...');
  const cards = await fetchAllGigGuideEvents();

  const toInsert = [];
  const seenThisRun = new Set();
  let skippedNoDate = 0;
  let skippedDuplicate = 0;
  let unknownSuburb = 0;

  for (const card of cards) {
    const mapped = mapRrrEvent(card, venueMap);
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
    console.log(`Resolving "more info" links for ${toInsert.length} new events (one request each, be patient)...`);
    for (const event of toInsert) {
      event.source_url = await resolveMoreInfoUrl(event.source_url);
      await sleep(REQUEST_DELAY_MS);
    }

    console.log(`Inserting ${toInsert.length} new events...`);
    await insertEvents(toInsert);
  }

  console.log('\n--- Summary ---');
  console.log(`Fetched from RRR Gig Guide: ${cards.length}`);
  console.log(`Inserted:                   ${toInsert.length}`);
  console.log(`Skipped (duplicates):       ${skippedDuplicate}`);
  console.log(`Skipped (no usable date):   ${skippedNoDate}`);
  console.log(`Unknown suburb (inserted):  ${unknownSuburb}`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
