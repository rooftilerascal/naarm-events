import 'dotenv/config';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

for (const [key, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Talk to PostgREST directly with fetch. @supabase/supabase-js currently mishandles
// Supabase's new sb_secret_/sb_publishable_ key format (the server rejects its
// Authorization header with a bogus "JWT issued at future" error), while plain
// REST calls with the same key work fine.
//
// That said, even with raw fetch, Supabase intermittently rejects the very first
// request of a run with that same "JWT issued at future" (PGRST303) error — seen
// repeatedly across manual runs and now in CI. It's transient and always succeeds
// on retry, so wrap every request with a short retry instead of letting a whole
// scheduled run fail over it.
async function withRetry(fn, { attempts = 3, delayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }
  throw lastErr;
}

export async function supabaseSelect(table, params) {
  return withRetry(async () => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase select on ${table} failed (${res.status}): ${await res.text()}`);
    return res.json();
  });
}

export async function supabaseInsert(table, rows) {
  return withRetry(async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`Supabase insert on ${table} failed (${res.status}): ${await res.text()}`);
  });
}

export async function supabaseUpdate(table, matchParams, patch) {
  return withRetry(async () => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    for (const [k, v] of Object.entries(matchParams)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Supabase update on ${table} failed (${res.status}): ${await res.text()}`);
  });
}

export function dedupeKey(name, dateStart, venue) {
  return [name, dateStart, venue].map((v) => (v ?? '').toString().trim().toLowerCase()).join('|');
}

// Keyed by lowercased venue name. `image_url` is a fallback photo for when an
// event itself has none (mostly RRR listings) — not auto-populated by any
// script; add URLs directly via the Supabase table editor as you source them.
export async function loadVenueMap() {
  const data = await supabaseSelect('venues', { select: 'venue_name,suburb,image_url' });
  return new Map(data.map((v) => [v.venue_name.trim().toLowerCase(), { suburb: v.suburb, image_url: v.image_url }]));
}

export async function loadExistingEventKeys() {
  const data = await supabaseSelect('events', { select: 'name,date_start,venue' });
  return new Set(data.map((e) => dedupeKey(e.name, e.date_start, e.venue)));
}

export async function insertEvents(rows) {
  const CHUNK_SIZE = 200;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await supabaseInsert('events', rows.slice(i, i + CHUNK_SIZE));
  }
}
