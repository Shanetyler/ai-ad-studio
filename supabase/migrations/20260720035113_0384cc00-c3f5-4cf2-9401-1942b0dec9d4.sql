
-- Add video pipeline fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS video_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS supabase_video_path text,
  ADD COLUMN IF NOT EXISTS mux_asset_id text,
  ADD COLUMN IF NOT EXISTS mux_playback_id text,
  ADD COLUMN IF NOT EXISTS mux_upload_id text,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS generated_model text,
  ADD COLUMN IF NOT EXISTS credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aspect_ratio text NOT NULL DEFAULT '16:9',
  ADD COLUMN IF NOT EXISTS render_error text;

-- Public read of mux_playback_id via a dedicated view? Keep private; playback IDs are public tokens once shared.

-- Allow webhook (service role) to update; RLS bypass applies. Just ensure grant for service_role.
GRANT ALL ON public.projects TO service_role;

-- Index for webhook lookup
CREATE INDEX IF NOT EXISTS projects_mux_upload_idx ON public.projects(mux_upload_id);
CREATE INDEX IF NOT EXISTS projects_mux_asset_idx ON public.projects(mux_asset_id);

-- Enable Realtime on projects
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
