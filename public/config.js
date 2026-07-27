// Safe to expose publicly: this is the "publishable" key, meant for client-side use.
// Row Level Security on the `events` table (see sql/001_init.sql) is what actually
// restricts access — reads are public, writes require the separate secret key that
// never leaves the backend ingestion scripts.
export const SUPABASE_URL = 'https://rxkssxofkotuwoqiwnft.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BL2Vh0U60zTkdqplDbuhBQ_TT1h36Ze';
