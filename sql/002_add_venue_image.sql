-- Run this once in the Supabase SQL Editor.
-- Adds a place to store a photo per venue, used as a fallback when an event
-- itself has no image (mainly RRR Gig Guide listings). Not populated by any
-- script — see README note in the ingestion scripts for how this gets filled in.

ALTER TABLE venues ADD COLUMN IF NOT EXISTS image_url TEXT;
