-- Allow the non-sensitive listener shuffle preference transition event.
alter table public.listening_events drop constraint if exists listening_events_event_name_check;
alter table public.listening_events add constraint listening_events_event_name_check check (event_name in (
  'radio_session_started', 'radio_session_ended', 'radio_paused', 'song_started', 'song_completed', 'song_skipped',
  'player_error', 'channel_changed', 'manual_mode_started', 'returned_to_live', 'scheduled_channel_transitioned',
  'playback_resynchronised', 'fallback_catalogue_used', 'whatsapp_share_clicked', 'youtube_source_clicked',
  'schedule_viewed', 'song_request_started', 'song_request_submitted', 'sponsor_impression', 'sponsor_clicked',
  'takedown_form_opened', 'channel_impression', 'channel_selected', 'listening_duration_recorded',
  'shuffle_mode_changed'
));
