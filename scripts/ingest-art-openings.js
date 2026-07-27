import ical from 'node-ical';
import { dedupeKey, loadVenueMap, loadExistingEventKeys, insertEvents } from './lib/supabase.js';

// Public Google Calendar embedded on https://artopeningsmelbourne.blogspot.com/ — this is
// Google Calendar's own public iCal export feature (the sanctioned way to consume a public
// calendar, same idea as an RSS feed), not a scrape of the blog itself.
const ICS_URL = 'https://calendar.google.com/calendar/ical/charles.artopenings%40gmail.com/public/basic.ics';
const CALENDAR_PAGE_URL = 'https://artopeningsmelbourne.blogspot.com/2019/05/art-openings-melbourne-calendar.html';
const MELBOURNE_TZ = 'Australia/Melbourne';

function melbourneDateISO(date) {
  // en-CA locale conveniently formats as YYYY-MM-DD
  return date.toLocaleDateString('en-CA', { timeZone: MELBOURNE_TZ });
}

function melbourneTime(date) {
  return date.toLocaleTimeString('en-GB', { timeZone: MELBOURNE_TZ, hour: '2-digit', minute: '2-digit' }) + ':00';
}

// Every current entry follows "Venue Name - Exhibition Title" (a handful of older entries in
// the feed don't, but those are all historical and filtered out before we ever get here).
function splitSummary(summary) {
  const sepIndex = summary.indexOf(' - ');
  if (sepIndex === -1) return { venue: null, name: summary.trim() };
  return {
    venue: summary.slice(0, sepIndex).trim(),
    name: summary.slice(sepIndex + 3).trim().replace(/^"|"$/g, ''),
  };
}

function extractUrl(text) {
  const match = text?.match(/https?:\/\/\S+|www\.\S+/);
  return match ? (match[0].startsWith('http') ? match[0] : `https://${match[0]}`) : null;
}

async function fetchUpcomingOpenings(todayISO) {
  const data = await ical.async.fromURL(ICS_URL);
  const events = Object.values(data).filter((e) => e.type === 'VEVENT');
  return events.filter((e) => melbourneDateISO(e.start) >= todayISO);
}

function mapOpeningEvent(event, venueMap) {
  const { venue, name } = splitSummary(event.summary ?? '');
  if (!name) return null;

  const dateStart = melbourneDateISO(event.start);
  const dateEnd = event.end ? melbourneDateISO(event.end) : dateStart;
  const venueInfo = venue ? venueMap.get(venue.toLowerCase()) : null;

  return {
    name,
    date_start: dateStart,
    date_end: dateEnd !== dateStart ? dateEnd : null,
    event_time: melbourneTime(event.start),
    venue,
    suburb: venueInfo?.suburb ?? 'unknown',
    category: 'Exhibition',
    price: 'free', // gallery openings are near-universally free to attend
    source_url: extractUrl(event.description) ?? CALENDAR_PAGE_URL,
    source_name: 'art_openings_melbourne',
    image_url: venueInfo?.image_url ?? null,
  };
}

async function main() {
  const todayISO = melbourneDateISO(new Date());

  console.log('Fetching venues and existing events from Supabase...');
  const [venueMap, existingKeys] = await Promise.all([loadVenueMap(), loadExistingEventKeys()]);

  console.log('Fetching Art Openings Melbourne calendar feed...');
  const upcoming = await fetchUpcomingOpenings(todayISO);

  const toInsert = [];
  const seenThisRun = new Set();
  let skippedNoName = 0;
  let skippedDuplicate = 0;
  let unknownSuburb = 0;

  for (const event of upcoming) {
    const mapped = mapOpeningEvent(event, venueMap);
    if (!mapped) {
      skippedNoName++;
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
  console.log(`Upcoming openings in feed:  ${upcoming.length}`);
  console.log(`Inserted:                   ${toInsert.length}`);
  console.log(`Skipped (duplicates):       ${skippedDuplicate}`);
  console.log(`Skipped (no parseable name):${skippedNoName}`);
  console.log(`Unknown suburb (inserted):  ${unknownSuburb}`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
