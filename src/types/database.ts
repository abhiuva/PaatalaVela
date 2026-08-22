export type EmbedStatus = "unchecked" | "available" | "unavailable" | "embedding_disabled" | "region_restricted";
export type AdminRole = "admin" | "editor";
export type TakedownStatus = "new" | "reviewing" | "accepted" | "rejected";
export type AnalyticsEventName =
  | "radio_session_started"
  | "radio_session_ended"
  | "radio_paused"
  | "song_started"
  | "song_completed"
  | "song_skipped"
  | "player_error"
  | "channel_changed"
  | "manual_mode_started"
  | "returned_to_live"
  | "scheduled_channel_transitioned"
  | "playback_resynchronised"
  | "fallback_catalogue_used"
  | "whatsapp_share_clicked"
  | "youtube_source_clicked"
  | "schedule_viewed"
  | "song_request_started"
  | "song_request_submitted"
  | "sponsor_impression"
  | "sponsor_clicked"
  | "takedown_form_opened"
  | "channel_impression"
  | "channel_selected"
  | "listening_duration_recorded";
export type SponsorPlacementType = "homepage" | "channel" | "now_playing" | "schedule" | "footer";
export type SponsorCampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed";
export type SongRequestStatus = "new" | "reviewing" | "accepted" | "rejected" | "duplicate";
export type YouTubeImportStatus = "pending" | "imported" | "rejected" | "duplicate" | "unavailable";
export type YouTubeImportAvailability = "available" | "unavailable" | "private" | "deleted" | "embedding_disabled";
export type FeedbackCategory = "music_selection" | "playback" | "channel_experience" | "design" | "performance" | "other";
export type SentimentStatus = "pending" | "processing" | "completed" | "failed" | "manually_reviewed";
export type SentimentLabel = "positive" | "neutral" | "negative" | "mixed";
export type ListenerPlayerState = "playing" | "paused" | "stopped";
export type ChannelMode = "scheduled" | "on_demand";

export type Database = {
  public: {
    Tables: {
      channels: {
        Row: {
          id: string;
          slug: string;
          name: string;
          telugu_name: string;
          positioning: string;
          start_hour: number;
          end_hour: number;
          background_image_url: string | null;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          display_order: number;
          scheduled: boolean;
          channel_mode: ChannelMode;
          primary_language_code: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          telugu_name: string;
          positioning: string;
          start_hour: number;
          end_hour: number;
          background_image_url?: string | null;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          display_order: number;
          scheduled?: boolean;
          channel_mode?: ChannelMode;
          primary_language_code?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["channels"]["Insert"]>;
        Relationships: [];
      };
      content_languages: {
        Row: { code: string; name: string; native_name: string; display_order: number; active: boolean };
        Insert: { code: string; name: string; native_name: string; display_order: number; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["content_languages"]["Insert"]>;
        Relationships: [];
      };
      content_eras: {
        Row: { code: string; name: string; start_year: number | null; end_year: number | null; display_order: number; active: boolean };
        Insert: { code: string; name: string; start_year?: number | null; end_year?: number | null; display_order: number; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["content_eras"]["Insert"]>;
        Relationships: [];
      };
      content_moods: {
        Row: { code: string; name: string; display_order: number; active: boolean };
        Insert: { code: string; name: string; display_order: number; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["content_moods"]["Insert"]>;
        Relationships: [];
      };
      content_occasions: {
        Row: { code: string; name: string; display_order: number; active: boolean };
        Insert: { code: string; name: string; display_order: number; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["content_occasions"]["Insert"]>;
        Relationships: [];
      };
      songs: {
        Row: {
          id: string;
          title: string;
          telugu_title: string | null;
          film: string;
          release_year: number;
          singers: string[];
          composer: string;
          lyricist: string | null;
          youtube_video_id: string;
          youtube_url: string;
          duration_seconds: number | null;
          spotify_url: string | null;
          youtube_music_url: string | null;
          editorial_note: string | null;
          editorial_note_telugu: string | null;
          language_code: string;
          era_code: string;
          song_story: string | null;
          context: string | null;
          thumbnail_url: string | null;
          embed_status: EmbedStatus;
          last_checked_at: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          telugu_title?: string | null;
          film: string;
          release_year: number;
          singers: string[];
          composer: string;
          lyricist?: string | null;
          youtube_video_id: string;
          youtube_url: string;
          duration_seconds?: number | null;
          spotify_url?: string | null;
          youtube_music_url?: string | null;
          editorial_note?: string | null;
          editorial_note_telugu?: string | null;
          language_code: string;
          era_code: string;
          song_story?: string | null;
          context?: string | null;
          thumbnail_url?: string | null;
          embed_status?: EmbedStatus;
          last_checked_at?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["songs"]["Insert"]>;
        Relationships: [];
      };
      channel_songs: {
        Row: {
          id: string;
          channel_id: string;
          song_id: string;
          sequence: number;
          weight: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          song_id: string;
          sequence: number;
          weight?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["channel_songs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "channel_songs_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_songs_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      song_moods: {
        Row: { song_id: string; mood_code: string; created_at: string };
        Insert: { song_id: string; mood_code: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["song_moods"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "song_moods_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_moods_mood_code_fkey";
            columns: ["mood_code"];
            isOneToOne: false;
            referencedRelation: "content_moods";
            referencedColumns: ["code"];
          },
        ];
      };
      song_occasions: {
        Row: { song_id: string; occasion_code: string; created_at: string };
        Insert: { song_id: string; occasion_code: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["song_occasions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "song_occasions_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_occasions_occasion_code_fkey";
            columns: ["occasion_code"];
            isOneToOne: false;
            referencedRelation: "content_occasions";
            referencedColumns: ["code"];
          },
        ];
      };
      catalogue_admin_events: {
        Row: { id: string; action: "channel_unlinked" | "song_soft_deleted" | "assignment_moved"; song_id: string | null; channel_id: string | null; actor_id: string | null; details: Record<string, unknown>; created_at: string };
        Insert: { id?: string; action: "channel_unlinked" | "song_soft_deleted" | "assignment_moved"; song_id?: string | null; channel_id?: string | null; actor_id?: string | null; details?: Record<string, unknown>; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["catalogue_admin_events"]["Insert"]>;
        Relationships: [];
      };
      admin_profiles: {
        Row: {
          id: string;
          display_name: string;
          role: AdminRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role: AdminRole;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_profiles"]["Insert"]>;
        Relationships: [];
      };
      takedown_requests: {
        Row: {
          id: string;
          song_id: string | null;
          claimant_name: string;
          claimant_email: string;
          rights_holder: string;
          request_details: string;
          evidence_url: string | null;
          status: TakedownStatus;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          song_id?: string | null;
          claimant_name: string;
          claimant_email: string;
          rights_holder: string;
          request_details: string;
          evidence_url?: string | null;
          status?: TakedownStatus;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["takedown_requests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "takedown_requests_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      listening_events: {
        Row: {
          id: string;
          anonymous_session_id: string;
          event_name: AnalyticsEventName;
          channel_id: string | null;
          song_id: string | null;
          playback_mode: "live" | "manual" | null;
          properties: Record<string, unknown>;
          occurred_at: string;
          event_date_ist: string;
          created_at: string;
          is_test: boolean;
        };
        Insert: {
          id?: string;
          anonymous_session_id: string;
          event_name: AnalyticsEventName;
          channel_id?: string | null;
          song_id?: string | null;
          playback_mode?: "live" | "manual" | null;
          properties?: Record<string, unknown>;
          occurred_at?: string;
          event_date_ist?: string;
          created_at?: string;
          is_test?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["listening_events"]["Insert"]>;
        Relationships: [];
      };
      feedback_submissions: {
        Row: {
          id: string;
          rating: number;
          comment: string | null;
          category: FeedbackCategory | null;
          channel_id: string | null;
          song_id: string | null;
          page_path: string | null;
          anonymous_session_id: string | null;
          app_version: string | null;
          submission_token_hash: string;
          sentiment_status: SentimentStatus;
          sentiment_label: SentimentLabel | null;
          sentiment_score: number | null;
          sentiment_confidence: number | null;
          sentiment_summary: string | null;
          detected_themes: string[] | null;
          sentiment_analyzed_at: string | null;
          sentiment_error_code: string | null;
          admin_sentiment_override: SentimentLabel | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rating: number;
          comment?: string | null;
          category?: FeedbackCategory | null;
          channel_id?: string | null;
          song_id?: string | null;
          page_path?: string | null;
          anonymous_session_id?: string | null;
          app_version?: string | null;
          submission_token_hash: string;
          sentiment_status?: SentimentStatus;
          sentiment_label?: SentimentLabel | null;
          sentiment_score?: number | null;
          sentiment_confidence?: number | null;
          sentiment_summary?: string | null;
          detected_themes?: string[] | null;
          sentiment_analyzed_at?: string | null;
          sentiment_error_code?: string | null;
          admin_sentiment_override?: SentimentLabel | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback_submissions"]["Insert"]>;
        Relationships: [];
      };
      active_listener_sessions: {
        Row: {
          session_hash: string;
          channel_id: string | null;
          song_id: string | null;
          player_state: ListenerPlayerState;
          first_seen_at: string;
          last_seen_at: string;
          expires_at: string;
          is_test: boolean;
          heartbeat_window_started_at: string;
          heartbeat_count: number;
        };
        Insert: {
          session_hash: string;
          channel_id?: string | null;
          song_id?: string | null;
          player_state: ListenerPlayerState;
          first_seen_at?: string;
          last_seen_at?: string;
          expires_at: string;
          is_test?: boolean;
          heartbeat_window_started_at?: string;
          heartbeat_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["active_listener_sessions"]["Insert"]>;
        Relationships: [];
      };
      daily_channel_metrics: {
        Row: {
          metric_date_ist: string;
          channel_id: string;
          listening_sessions: number;
          unique_anonymous_sessions: number;
          songs_started: number;
          songs_completed: number;
          listening_seconds: number;
          skips: number;
          player_errors: number;
          shares: number;
          fallback_catalogue_uses: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_channel_metrics"]["Row"]> & { metric_date_ist: string; channel_id: string };
        Update: Partial<Database["public"]["Tables"]["daily_channel_metrics"]["Insert"]>;
        Relationships: [];
      };
      sponsors: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          website_url: string;
          contact_name: string | null;
          contact_email: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          website_url: string;
          contact_name?: string | null;
          contact_email?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sponsors"]["Insert"]>;
        Relationships: [];
      };
      sponsor_campaigns: {
        Row: {
          id: string;
          sponsor_id: string;
          campaign_name: string;
          placement_type: SponsorPlacementType;
          channel_id: string | null;
          headline: string;
          description: string | null;
          image_url: string | null;
          destination_url: string;
          start_at: string;
          end_at: string;
          priority: number;
          status: SponsorCampaignStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sponsor_id: string;
          campaign_name: string;
          placement_type: SponsorPlacementType;
          channel_id?: string | null;
          headline: string;
          description?: string | null;
          image_url?: string | null;
          destination_url: string;
          start_at: string;
          end_at: string;
          priority?: number;
          status?: SponsorCampaignStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sponsor_campaigns"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sponsor_campaigns_sponsor_id_fkey";
            columns: ["sponsor_id"];
            isOneToOne: false;
            referencedRelation: "sponsors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sponsor_campaigns_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_sponsor_metrics: {
        Row: {
          metric_date_ist: string;
          campaign_id: string;
          impressions: number;
          clicks: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_sponsor_metrics"]["Row"]> & { metric_date_ist: string; campaign_id: string };
        Update: Partial<Database["public"]["Tables"]["daily_sponsor_metrics"]["Insert"]>;
        Relationships: [];
      };
      song_requests: {
        Row: {
          id: string;
          song_name: string;
          film_name: string;
          singer: string | null;
          youtube_url: string | null;
          requested_channel_id: string;
          reason: string | null;
          status: SongRequestStatus;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          song_name: string;
          film_name: string;
          singer?: string | null;
          youtube_url?: string | null;
          requested_channel_id: string;
          reason?: string | null;
          status?: SongRequestStatus;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["song_requests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "song_requests_requested_channel_id_fkey";
            columns: ["requested_channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      youtube_import_queue: {
        Row: {
          id: string;
          youtube_video_id: string;
          youtube_url: string;
          playlist_id: string | null;
          source_title: string;
          source_description: string | null;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          uploader: string | null;
          published_at: string | null;
          availability: YouTubeImportAvailability;
          embeddable: boolean;
          duplicate_song_id: string | null;
          suggested_metadata: Record<string, unknown>;
          channel_id: string | null;
          sequence: number | null;
          status: YouTubeImportStatus;
          imported_song_id: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          youtube_video_id: string;
          youtube_url: string;
          playlist_id?: string | null;
          source_title: string;
          source_description?: string | null;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          uploader?: string | null;
          published_at?: string | null;
          availability?: YouTubeImportAvailability;
          embeddable?: boolean;
          duplicate_song_id?: string | null;
          suggested_metadata?: Record<string, unknown>;
          channel_id?: string | null;
          sequence?: number | null;
          status?: YouTubeImportStatus;
          imported_song_id?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["youtube_import_queue"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "youtube_import_queue_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "youtube_import_queue_duplicate_song_id_fkey";
            columns: ["duplicate_song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "youtube_import_queue_imported_song_id_fkey";
            columns: ["imported_song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reorder_channel_assignments: {
        Args: {
          p_channel_id: string;
          p_assignment_ids: string[];
        };
        Returns: undefined;
      };
      delete_old_listening_events: {
        Args: {
          retention_days?: number;
        };
        Returns: number;
      };
      daily_tuned_listener_count: {
        Args: { p_date: string };
        Returns: number;
      };
      upsert_listener_presence: {
        Args: {
          p_session_hash: string;
          p_channel_id: string | null;
          p_song_id: string | null;
          p_player_state: ListenerPlayerState;
          p_expires_at: string;
          p_is_test?: boolean;
        };
        Returns: undefined;
      };
      delete_expired_listener_sessions: {
        Args: Record<string, never>;
        Returns: number;
      };
      unlink_channel_song: {
        Args: { p_assignment_id: string; p_actor_id: string };
        Returns: Record<string, unknown>;
      };
      soft_delete_catalogue_song: {
        Args: { p_song_id: string; p_actor_id: string; p_confirmation: string };
        Returns: Record<string, unknown>;
      };
      move_channel_song: {
        Args: { p_assignment_id: string; p_target_channel_id: string; p_sequence: number; p_actor_id: string };
        Returns: Record<string, unknown>;
      };
    };
    Enums: {
      embed_status: EmbedStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type DbChannel = Database["public"]["Tables"]["channels"]["Row"];
export type DbSong = Database["public"]["Tables"]["songs"]["Row"];
export type DbChannelSong = Database["public"]["Tables"]["channel_songs"]["Row"];
export type DbAdminProfile = Database["public"]["Tables"]["admin_profiles"]["Row"];
export type DbTakedownRequest = Database["public"]["Tables"]["takedown_requests"]["Row"];
export type DbYouTubeImportQueue = Database["public"]["Tables"]["youtube_import_queue"]["Row"];
export type DbFeedbackSubmission = Database["public"]["Tables"]["feedback_submissions"]["Row"];
export type DbActiveListenerSession = Database["public"]["Tables"]["active_listener_sessions"]["Row"];
