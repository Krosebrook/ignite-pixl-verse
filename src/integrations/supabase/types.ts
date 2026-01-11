export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          event_category: string
          event_type: string
          id: string
          metadata: Json | null
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          event_category: string
          event_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          event_category?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          content_data: Json | null
          content_url: string | null
          created_at: string | null
          human_edited: boolean | null
          id: string
          layers: Json | null
          license: string | null
          metadata: Json | null
          name: string
          org_id: string
          platform_config: Json | null
          provenance: Json | null
          quality_tier: string | null
          resolution_config: Json | null
          thumbnail_url: string | null
          type: string
          user_id: string
        }
        Insert: {
          content_data?: Json | null
          content_url?: string | null
          created_at?: string | null
          human_edited?: boolean | null
          id?: string
          layers?: Json | null
          license?: string | null
          metadata?: Json | null
          name: string
          org_id: string
          platform_config?: Json | null
          provenance?: Json | null
          quality_tier?: string | null
          resolution_config?: Json | null
          thumbnail_url?: string | null
          type: string
          user_id: string
        }
        Update: {
          content_data?: Json | null
          content_url?: string | null
          created_at?: string | null
          human_edited?: boolean | null
          id?: string
          layers?: Json | null
          license?: string | null
          metadata?: Json | null
          name?: string
          org_id?: string
          platform_config?: Json | null
          provenance?: Json | null
          quality_tier?: string | null
          resolution_config?: Json | null
          thumbnail_url?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_codes: {
        Row: {
          codes: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codes?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codes?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          brand_voice: string
          colors: Json | null
          created_at: string | null
          fonts: Json | null
          guidelines: string | null
          id: string
          logo_url: string | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          brand_voice?: string
          colors?: Json | null
          created_at?: string | null
          fonts?: Json | null
          guidelines?: string | null
          id?: string
          logo_url?: string | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          brand_voice?: string
          colors?: Json | null
          created_at?: string | null
          fonts?: Json | null
          guidelines?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_goals: {
        Row: {
          campaign_id: string
          created_at: string | null
          current_value: number | null
          deadline: string | null
          goal_type: string
          id: string
          target_value: number
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          goal_type: string
          id?: string
          target_value: number
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          goal_type?: string
          id?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_goals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          assets: Json | null
          budget_cents: number | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          metrics: Json | null
          name: string
          objective: string | null
          org_id: string
          platforms: Json | null
          schedule_config: Json | null
          segments: Json | null
          spent_cents: number | null
          start_date: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assets?: Json | null
          budget_cents?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          metrics?: Json | null
          name: string
          objective?: string | null
          org_id: string
          platforms?: Json | null
          schedule_config?: Json | null
          segments?: Json | null
          spent_cents?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assets?: Json | null
          budget_cents?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          metrics?: Json | null
          name?: string
          objective?: string | null
          org_id?: string
          platforms?: Json | null
          schedule_config?: Json | null
          segments?: Json | null
          spent_cents?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_layers: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_template: boolean | null
          layer_type: string
          name: string
          org_id: string
          platform: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_template?: boolean | null
          layer_type: string
          name: string
          org_id: string
          platform: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_template?: boolean | null
          layer_type?: string
          name?: string
          org_id?: string
          platform?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_layers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_aggregates: {
        Row: {
          avg_duration_ms: number | null
          count: number | null
          created_at: string | null
          date: string
          event_type: string
          id: string
          metadata: Json | null
          org_id: string
          total_duration_ms: number | null
        }
        Insert: {
          avg_duration_ms?: number | null
          count?: number | null
          created_at?: string | null
          date: string
          event_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          total_duration_ms?: number | null
        }
        Update: {
          avg_duration_ms?: number | null
          count?: number | null
          created_at?: string | null
          date?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          total_duration_ms?: number | null
        }
        Relationships: []
      }
      incident_updates: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          message: string | null
          new_value: string | null
          previous_value: string | null
          update_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          message?: string | null
          new_value?: string | null
          previous_value?: string | null
          update_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          message?: string | null
          new_value?: string | null
          previous_value?: string | null
          update_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          alert_id: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json | null
          org_id: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source_name: string | null
          source_type: string | null
          started_at: string
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_id?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source_name?: string | null
          source_type?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_id?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source_name?: string | null
          source_type?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string
          access_token_encrypted: string | null
          created_at: string
          encryption_version: number | null
          expires_at: string | null
          id: string
          last_sync_at: string | null
          metadata: Json | null
          org_id: string
          provider: string
          refresh_token: string | null
          refresh_token_encrypted: string | null
          scope: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          access_token_encrypted?: string | null
          created_at?: string
          encryption_version?: number | null
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          org_id: string
          provider: string
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          access_token_encrypted?: string | null
          created_at?: string
          encryption_version?: number | null
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          org_id?: string
          provider?: string
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_rate_limits: {
        Row: {
          action: string
          attempt_count: number
          block_count: number
          blocked_until: string | null
          first_attempt_at: string
          id: string
          ip_address: string
          last_attempt_at: string
        }
        Insert: {
          action: string
          attempt_count?: number
          block_count?: number
          blocked_until?: string | null
          first_attempt_at?: string
          id?: string
          ip_address: string
          last_attempt_at?: string
        }
        Update: {
          action?: string
          attempt_count?: number
          block_count?: number
          blocked_until?: string | null
          first_attempt_at?: string
          id?: string
          ip_address?: string
          last_attempt_at?: string
        }
        Relationships: []
      }
      library_installs: {
        Row: {
          backup_snapshot: Json | null
          id: string
          installed_at: string
          installed_by: string | null
          item_id: string
          org_id: string
          version: string
        }
        Insert: {
          backup_snapshot?: Json | null
          id?: string
          installed_at?: string
          installed_by?: string | null
          item_id: string
          org_id: string
          version: string
        }
        Update: {
          backup_snapshot?: Json | null
          id?: string
          installed_at?: string
          installed_by?: string | null
          item_id?: string
          org_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_installs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_installs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          author: string | null
          created_at: string
          id: string
          kind: string
          license: string
          name: string
          payload: Json
          publication_status: string | null
          slug: string
          summary: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          version: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          kind: string
          license?: string
          name: string
          payload: Json
          publication_status?: string | null
          slug: string
          summary?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          kind?: string
          license?: string
          name?: string
          payload?: Json
          publication_status?: string | null
          slug?: string
          summary?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          browser: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_new_device: boolean | null
          location: string | null
          notification_sent: boolean | null
          os: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_new_device?: boolean | null
          location?: string | null
          notification_sent?: boolean | null
          os?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_new_device?: boolean | null
          location?: string | null
          notification_sent?: boolean | null
          os?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketplace_items: {
        Row: {
          content: Json
          created_at: string | null
          creator_id: string | null
          description: string | null
          downloads: number | null
          id: string
          name: string
          price_cents: number | null
          thumbnail_url: string | null
          type: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          downloads?: number | null
          id?: string
          name: string
          price_cents?: number | null
          thumbnail_url?: string | null
          type: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          downloads?: number | null
          id?: string
          name?: string
          price_cents?: number | null
          thumbnail_url?: string | null
          type?: string
        }
        Relationships: []
      }
      marketplace_purchases: {
        Row: {
          amount_cents: number
          downloaded_at: string | null
          id: string
          item_id: string
          org_id: string
          payment_status: string
          purchase_date: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          downloaded_at?: string | null
          id?: string
          item_id: string
          org_id: string
          payment_status?: string
          purchase_date?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          downloaded_at?: string | null
          id?: string
          item_id?: string
          org_id?: string
          payment_status?: string
          purchase_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items_preview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_purchases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          login_alerts_enabled: boolean
          new_device_alerts_enabled: boolean
          security_alerts_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_alerts_enabled?: boolean
          new_device_alerts_enabled?: boolean
          security_alerts_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_alerts_enabled?: boolean
          new_device_alerts_enabled?: boolean
          security_alerts_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          locale: string
          name: string
          owner_id: string
          slug: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          locale?: string
          name: string
          owner_id: string
          slug: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          locale?: string
          name?: string
          owner_id?: string
          slug?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_step: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_step?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_step?: number
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          asset_id: string | null
          campaign_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          org_id: string
          platform: string
          posted_url: string | null
          result: Json | null
          retries: number | null
          scheduled_at: string
          status: string
        }
        Insert: {
          asset_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          platform: string
          posted_url?: string | null
          result?: Json | null
          retries?: number | null
          scheduled_at: string
          status?: string
        }
        Update: {
          asset_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          platform?: string
          posted_url?: string | null
          result?: Json | null
          retries?: number | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_activity_log: {
        Row: {
          browser: string | null
          created_at: string
          device_type: string | null
          event_category: string
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          location: string | null
          metadata: Json | null
          os: string | null
          risk_score: number | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          event_category?: string
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json | null
          os?: string | null
          risk_score?: number | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          event_category?: string
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json | null
          os?: string | null
          risk_score?: number | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_questions: {
        Row: {
          created_at: string
          id: string
          questions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          questions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          questions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string | null
          criteria: Json
          description: string | null
          estimated_reach: number | null
          id: string
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json
          description?: string | null
          estimated_reach?: number | null
          id?: string
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json
          description?: string | null
          estimated_reach?: number | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          is_public: boolean | null
          name: string
          org_id: string | null
          thumbnail_url: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          org_id?: string | null
          thumbnail_url?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          org_id?: string | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_credits: {
        Row: {
          features: Json | null
          hard_limit_tokens: number
          image_generations_limit: number | null
          image_generations_used: number | null
          max_resolution: string | null
          month_start: string
          org_id: string
          plan: string
          updated_at: string
          used_tokens: number
          video_minutes_limit: number | null
          video_minutes_used: number | null
        }
        Insert: {
          features?: Json | null
          hard_limit_tokens?: number
          image_generations_limit?: number | null
          image_generations_used?: number | null
          max_resolution?: string | null
          month_start?: string
          org_id: string
          plan?: string
          updated_at?: string
          used_tokens?: number
          video_minutes_limit?: number | null
          video_minutes_used?: number | null
        }
        Update: {
          features?: Json | null
          hard_limit_tokens?: number
          image_generations_limit?: number | null
          image_generations_used?: number | null
          max_resolution?: string | null
          month_start?: string
          org_id?: string
          plan?: string
          updated_at?: string
          used_tokens?: number
          video_minutes_limit?: number | null
          video_minutes_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_credits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passkeys: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          device_type: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: Json | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: Json | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string
          location: string | null
          os: string | null
          session_token: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location?: string | null
          os?: string | null
          session_token: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location?: string | null
          os?: string | null
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_totp: {
        Row: {
          created_at: string | null
          id: string
          secret: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          secret: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          secret?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      integrations_admin_view: {
        Row: {
          access_token_status: string | null
          created_at: string | null
          encryption_version: number | null
          expires_at: string | null
          id: string | null
          metadata: Json | null
          org_id: string | null
          provider: string | null
          refresh_token_status: string | null
          scope: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_status?: never
          created_at?: string | null
          encryption_version?: number | null
          expires_at?: string | null
          id?: string | null
          metadata?: Json | null
          org_id?: string | null
          provider?: string | null
          refresh_token_status?: never
          scope?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_status?: never
          created_at?: string | null
          encryption_version?: number | null
          expires_at?: string | null
          id?: string | null
          metadata?: Json | null
          org_id?: string | null
          provider?: string | null
          refresh_token_status?: never
          scope?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_items_preview: {
        Row: {
          created_at: string | null
          creator_id: string | null
          description: string | null
          downloads: number | null
          id: string | null
          name: string | null
          price_cents: number | null
          thumbnail_url: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          downloads?: number | null
          id?: string | null
          name?: string | null
          price_cents?: number | null
          thumbnail_url?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          downloads?: number | null
          id?: string | null
          name?: string | null
          price_cents?: number | null
          thumbnail_url?: string | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aggregate_daily_events: { Args: never; Returns: undefined }
      check_ip_rate_limit: {
        Args: {
          p_action: string
          p_block_minutes?: number
          p_ip_address: string
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      create_org_with_owner: {
        Args: {
          p_locale?: string
          p_name: string
          p_slug: string
          p_timezone?: string
        }
        Returns: string
      }
      decrypt_integration_token: {
        Args: {
          p_encryption_key: string
          p_integration_id: string
          p_token_type: string
        }
        Returns: string
      }
      get_event_summary: {
        Args: { p_end_date?: string; p_org_id: string; p_start_date?: string }
        Returns: {
          avg_duration_ms: number
          event_type: string
          total_count: number
          unique_users: number
        }[]
      }
      get_marketplace_content: { Args: { p_item_id: string }; Returns: Json }
      increment_usage_tokens: {
        Args: { p_org_id: string; p_tokens: number }
        Returns: Json
      }
      increment_video_usage: {
        Args: { p_minutes: number; p_org_id: string }
        Returns: Json
      }
      is_member_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_of_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      reset_ip_rate_limit: {
        Args: { p_action: string; p_ip_address: string }
        Returns: undefined
      }
      user_org_ids: {
        Args: { _user_id: string }
        Returns: {
          org_id: string
        }[]
      }
      write_encrypted_integration: {
        Args: {
          p_access_token: string
          p_encryption_key?: string
          p_expires_at?: string
          p_metadata?: Json
          p_org_id: string
          p_provider: string
          p_refresh_token?: string
          p_scope?: string
        }
        Returns: string
      }
    }
    Enums: {
      incident_severity: "critical" | "major" | "minor" | "warning"
      incident_status:
        | "open"
        | "investigating"
        | "identified"
        | "monitoring"
        | "resolved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      incident_severity: ["critical", "major", "minor", "warning"],
      incident_status: [
        "open",
        "investigating",
        "identified",
        "monitoring",
        "resolved",
      ],
    },
  },
} as const
