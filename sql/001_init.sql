-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> Run)

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE,
  event_time TEXT,
  venue TEXT,
  suburb TEXT,
  category TEXT,
  price TEXT, -- 'free' | 'paid' | 'unknown'
  source_url TEXT,
  source_name TEXT NOT NULL, -- e.g. 'ticketmaster', 'rrr_gig_guide'
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  venue_name TEXT PRIMARY KEY,
  suburb TEXT NOT NULL
);

INSERT INTO venues (venue_name, suburb) VALUES
  ('The Tote', 'Collingwood'),
  ('Cherry Bar', 'Melbourne CBD'),
  ('The Espy', 'St Kilda'),
  ('The Corner Hotel', 'Richmond'),
  ('Northcote Social Club', 'Northcote'),
  ('The Night Cat', 'Fitzroy'),
  ('The Old Bar', 'Fitzroy'),
  ('Yah Yah''s', 'Fitzroy'),
  ('The Curtin', 'Carlton'),
  ('Jazz Lab', 'Brunswick East'),
  ('The Evelyn Hotel', 'Fitzroy'),
  ('Brunswick Ballroom', 'Brunswick'),
  ('The Substation', 'Newport'),
  ('Northcote Town Hall', 'Northcote'),
  ('Max Watt''s', 'Melbourne CBD'),
  ('170 Russell', 'Melbourne CBD'),
  ('The Forum', 'Melbourne CBD'),
  ('The Comics Lounge', 'North Melbourne'),
  ('Melbourne Town Hall', 'Melbourne CBD'),
  ('NGV', 'Southbank'),
  ('ACCA', 'Southbank'),
  ('Astor Theatre', 'St Kilda'),
  ('Howler', 'Brunswick'),
  ('Croxton Bandroom', 'Thornbury'),
  ('Bar 303', 'Northcote'),
  ('Bar Open', 'Fitzroy'),
  ('Shadow Electric', 'Abbotsford'),
  ('Melbourne Recital Centre', 'Southbank'),
  ('Hamer Hall', 'Southbank'),
  ('Palais Theatre', 'St Kilda'),
  ('Sidney Myer Music Bowl', 'Melbourne (Kings Domain)'),
  ('The Toff in Town', 'Melbourne CBD'),
  ('The Butterfly Club', 'Melbourne CBD')
ON CONFLICT (venue_name) DO NOTHING;

-- Row Level Security: Supabase grants anon/authenticated roles CRUD on public
-- tables by default, so without RLS, anyone holding the publishable key could
-- write directly to these tables via the REST API, bypassing the ingestion
-- script. The service_role key used by our backend scripts bypasses RLS
-- entirely, so this has no effect on the pipeline.

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- events: public read (the site needs to display these), no public writes
CREATE POLICY "Public read access on events"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

-- venues: internal lookup table only, no public policies at all —
-- not exposed via the REST API to anon/authenticated in any way for now.
