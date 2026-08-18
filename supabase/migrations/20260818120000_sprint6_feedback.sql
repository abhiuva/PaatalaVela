create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  category text check (category is null or category in (
    'music_selection', 'playback', 'channel_experience', 'design', 'performance', 'other'
  )),
  channel_id uuid references public.channels(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  page_path text check (page_path is null or char_length(page_path) <= 300),
  anonymous_session_id text check (anonymous_session_id is null or char_length(anonymous_session_id) <= 120),
  app_version text check (app_version is null or char_length(app_version) <= 120),
  submission_token_hash text not null unique check (char_length(submission_token_hash) = 64),
  sentiment_status text not null default 'pending' check (sentiment_status in (
    'pending', 'processing', 'completed', 'failed', 'manually_reviewed'
  )),
  sentiment_label text check (sentiment_label is null or sentiment_label in (
    'positive', 'neutral', 'negative', 'mixed'
  )),
  sentiment_score numeric check (sentiment_score is null or sentiment_score between -1 and 1),
  sentiment_confidence numeric check (sentiment_confidence is null or sentiment_confidence between 0 and 1),
  sentiment_summary text check (sentiment_summary is null or char_length(sentiment_summary) <= 500),
  detected_themes text[],
  sentiment_analyzed_at timestamptz,
  sentiment_error_code text check (sentiment_error_code is null or char_length(sentiment_error_code) <= 80),
  admin_sentiment_override text check (admin_sentiment_override is null or admin_sentiment_override in (
    'positive', 'neutral', 'negative', 'mixed'
  )),
  created_at timestamptz not null default now()
);

create index if not exists feedback_submissions_created_at_idx on public.feedback_submissions (created_at desc);
create index if not exists feedback_submissions_rating_idx on public.feedback_submissions (rating);
create index if not exists feedback_submissions_sentiment_idx on public.feedback_submissions (sentiment_label);
create index if not exists feedback_submissions_category_idx on public.feedback_submissions (category);
create index if not exists feedback_submissions_channel_idx on public.feedback_submissions (channel_id);
create index if not exists feedback_submissions_song_idx on public.feedback_submissions (song_id);

alter table public.feedback_submissions enable row level security;

create policy "Active administrators read feedback"
on public.feedback_submissions for select
using (public.is_active_admin());

create policy "Active administrators update feedback"
on public.feedback_submissions for update
using (public.is_active_admin())
with check (public.is_active_admin());

-- Public roles receive no policies. Inserts use the controlled server endpoint;
-- service-role access bypasses RLS without exposing the credential to a browser.

alter table public.listening_events
add column if not exists is_test boolean not null default false;

alter table public.listening_events drop constraint if exists listening_events_event_name_check;
alter table public.listening_events add constraint listening_events_event_name_check check (event_name in (
  'radio_session_started', 'radio_session_ended', 'radio_paused', 'song_started', 'song_completed', 'song_skipped',
  'player_error', 'channel_changed', 'manual_mode_started', 'returned_to_live', 'scheduled_channel_transitioned',
  'playback_resynchronised', 'fallback_catalogue_used', 'whatsapp_share_clicked', 'youtube_source_clicked',
  'schedule_viewed', 'song_request_started', 'song_request_submitted', 'sponsor_impression', 'sponsor_clicked',
  'takedown_form_opened'
));

create index if not exists listening_events_test_created_idx
on public.listening_events (is_test, created_at desc);
