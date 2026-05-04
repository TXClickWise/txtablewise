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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          provider: string | null
          restaurant_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          provider?: string | null
          restaurant_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          provider?: string | null
          restaurant_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      agent_call_logs: {
        Row: {
          agent_id: string | null
          callee_phone: string | null
          caller_phone: string | null
          cost_cents: number | null
          created_at: string
          duration_seconds: number | null
          external_call_id: string | null
          id: string
          metadata: Json
          outcome: string | null
          provider: string | null
          reservation_id: string | null
          restaurant_id: string
          summary: string | null
          transcript_url: string | null
        }
        Insert: {
          agent_id?: string | null
          callee_phone?: string | null
          caller_phone?: string | null
          cost_cents?: number | null
          created_at?: string
          duration_seconds?: number | null
          external_call_id?: string | null
          id?: string
          metadata?: Json
          outcome?: string | null
          provider?: string | null
          reservation_id?: string | null
          restaurant_id: string
          summary?: string | null
          transcript_url?: string | null
        }
        Update: {
          agent_id?: string | null
          callee_phone?: string | null
          caller_phone?: string | null
          cost_cents?: number | null
          created_at?: string
          duration_seconds?: number | null
          external_call_id?: string | null
          id?: string
          metadata?: Json
          outcome?: string | null
          provider?: string | null
          reservation_id?: string | null
          restaurant_id?: string
          summary?: string | null
          transcript_url?: string | null
        }
        Relationships: []
      }
      api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          restaurant_id: string
          revoked_at: string | null
          scopes: string[]
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          restaurant_id: string
          revoked_at?: string | null
          scopes?: string[]
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          restaurant_id?: string
          revoked_at?: string | null
          scopes?: string[]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      clickwise_settings: {
        Row: {
          api_base_url: string | null
          connection_mode: string
          contact_sync_enabled: boolean
          contact_sync_rules: Json
          created_at: string
          custom_field_mapping: Json
          id: string
          last_error: string | null
          last_test_at: string | null
          location_id: string | null
          privacy_options: Json
          restaurant_id: string
          sandbox_mode: boolean
          tag_mapping: Json
          updated_at: string
          workflow_mapping: Json
        }
        Insert: {
          api_base_url?: string | null
          connection_mode?: string
          contact_sync_enabled?: boolean
          contact_sync_rules?: Json
          created_at?: string
          custom_field_mapping?: Json
          id?: string
          last_error?: string | null
          last_test_at?: string | null
          location_id?: string | null
          privacy_options?: Json
          restaurant_id: string
          sandbox_mode?: boolean
          tag_mapping?: Json
          updated_at?: string
          workflow_mapping?: Json
        }
        Update: {
          api_base_url?: string | null
          connection_mode?: string
          contact_sync_enabled?: boolean
          contact_sync_rules?: Json
          created_at?: string
          custom_field_mapping?: Json
          id?: string
          last_error?: string | null
          last_test_at?: string | null
          location_id?: string | null
          privacy_options?: Json
          restaurant_id?: string
          sandbox_mode?: boolean
          tag_mapping?: Json
          updated_at?: string
          workflow_mapping?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clickwise_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      closures: {
        Row: {
          created_at: string
          end_date: string
          end_time: string | null
          id: string
          is_full_day: boolean
          reason: string | null
          restaurant_id: string
          start_date: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean
          reason?: string | null
          restaurant_id: string
          start_date: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean
          reason?: string | null
          restaurant_id?: string
          start_date?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closures_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_policies: {
        Row: {
          amount_cents_per_guest: number
          applies_friday_saturday_only: boolean
          applies_to_special_dates: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          min_party_size: number
          name: string
          refundable_until_hours_before: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents_per_guest?: number
          applies_friday_saturday_only?: boolean
          applies_to_special_dates?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_party_size?: number
          name: string
          refundable_until_hours_before?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents_per_guest?: number
          applies_friday_saturday_only?: boolean
          applies_to_special_dates?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_party_size?: number
          name?: string
          refundable_until_hours_before?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_notes: {
        Row: {
          created_at: string
          created_by: string | null
          guest_id: string
          id: string
          metadata: Json
          note: string
          note_type: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          guest_id: string
          id?: string
          metadata?: Json
          note: string
          note_type?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          guest_id?: string
          id?: string
          metadata?: Json
          note?: string
          note_type?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          allergies: string | null
          clickwise_contact_id: string | null
          created_at: string
          deleted_at: string | null
          dietary_preferences: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          hospitality_notes: string | null
          id: string
          is_blacklisted: boolean
          is_vip: boolean
          language: string
          last_name: string | null
          last_visit_at: string | null
          marketing_consent: boolean
          metadata: Json
          no_show_count: number
          notes: string | null
          phone: string | null
          preferred_channel: string | null
          restaurant_id: string
          seating_preferences: string | null
          source_channel: string | null
          tags: string[]
          total_visits: number
          updated_at: string
          visit_count: number
        }
        Insert: {
          allergies?: string | null
          clickwise_contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dietary_preferences?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hospitality_notes?: string | null
          id?: string
          is_blacklisted?: boolean
          is_vip?: boolean
          language?: string
          last_name?: string | null
          last_visit_at?: string | null
          marketing_consent?: boolean
          metadata?: Json
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          preferred_channel?: string | null
          restaurant_id: string
          seating_preferences?: string | null
          source_channel?: string | null
          tags?: string[]
          total_visits?: number
          updated_at?: string
          visit_count?: number
        }
        Update: {
          allergies?: string | null
          clickwise_contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dietary_preferences?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hospitality_notes?: string | null
          id?: string
          is_blacklisted?: boolean
          is_vip?: boolean
          language?: string
          last_name?: string | null
          last_visit_at?: string | null
          marketing_consent?: boolean
          metadata?: Json
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          preferred_channel?: string | null
          restaurant_id?: string
          seating_preferences?: string | null
          source_channel?: string | null
          tags?: string[]
          total_visits?: number
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "guests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          attempts: number
          clickwise_workflow_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          last_error: string | null
          metadata: Json
          next_retry_at: string | null
          payload: Json
          processed_at: string | null
          restaurant_id: string
          retry_count: number
          status: Database["public"]["Enums"]["integration_event_status"]
          target: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          clickwise_workflow_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          metadata?: Json
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          restaurant_id: string
          retry_count?: number
          status?: Database["public"]["Enums"]["integration_event_status"]
          target?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          clickwise_workflow_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          restaurant_id?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["integration_event_status"]
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          action: string
          api_key_prefix: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          external_reference: string | null
          guest_id: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          metadata: Json
          possible_cause: string | null
          request_payload: Json | null
          reservation_id: string | null
          response_payload: Json | null
          restaurant_id: string
          retry_safe: boolean
          source: string
          status: string
        }
        Insert: {
          action: string
          api_key_prefix?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          external_reference?: string | null
          guest_id?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          possible_cause?: string | null
          request_payload?: Json | null
          reservation_id?: string | null
          response_payload?: Json | null
          restaurant_id: string
          retry_safe?: boolean
          source: string
          status: string
        }
        Update: {
          action?: string
          api_key_prefix?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          external_reference?: string | null
          guest_id?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          possible_cause?: string | null
          request_payload?: Json | null
          reservation_id?: string | null
          response_payload?: Json | null
          restaurant_id?: string
          retry_safe?: boolean
          source?: string
          status?: string
        }
        Relationships: []
      }
      large_group_requests: {
        Row: {
          assigned_to: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          message: string | null
          occasion: string | null
          party_size: number
          preferred_date: string | null
          preferred_time: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["large_group_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          message?: string | null
          occasion?: string | null
          party_size: number
          preferred_date?: string | null
          preferred_time?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["large_group_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          message?: string | null
          occasion?: string | null
          party_size?: number
          preferred_date?: string | null
          preferred_time?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["large_group_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "large_group_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          close_time: string
          created_at: string
          id: string
          is_closed: boolean
          open_time: string
          restaurant_id: string
          updated_at: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          close_time: string
          created_at?: string
          id?: string
          is_closed?: boolean
          open_time: string
          restaurant_id: string
          updated_at?: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          close_time?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          open_time?: string
          restaurant_id?: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_upgrade_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          current_plan: Database["public"]["Enums"]["subscription_plan"]
          id: string
          requested_by: string
          requested_plan: Database["public"]["Enums"]["subscription_plan"]
          requester_note: string | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          current_plan: Database["public"]["Enums"]["subscription_plan"]
          id?: string
          requested_by: string
          requested_plan: Database["public"]["Enums"]["subscription_plan"]
          requester_note?: string | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          current_plan?: Database["public"]["Enums"]["subscription_plan"]
          id?: string
          requested_by?: string
          requested_plan?: Database["public"]["Enums"]["subscription_plan"]
          requester_note?: string | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_upgrade_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pos_connections: {
        Row: {
          access_token_encrypted: string | null
          config: Json
          created_at: string
          display_name: string | null
          external_account_id: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["pos_provider"]
          refresh_token_encrypted: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["pos_connection_status"]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          config?: Json
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["pos_provider"]
          refresh_token_encrypted?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["pos_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          config?: Json
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["pos_provider"]
          refresh_token_encrypted?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["pos_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pos_orders: {
        Row: {
          closed_at: string | null
          created_at: string
          currency: string
          discount_total_cents: number
          external_order_id: string | null
          external_table_id: string | null
          guest_count: number | null
          guest_id: string | null
          id: string
          imported_at: string | null
          match_score: string | null
          matched_at: string | null
          matched_by_user_id: string | null
          matching_status: string
          metadata: Json
          opened_at: string | null
          payment_status: string
          pos_connection_id: string | null
          provider: string
          raw_payload: Json
          receipt_created_at: string | null
          reservation_id: string | null
          restaurant_id: string
          source_type: string
          subtotal_cents: number
          sync_error: string | null
          sync_status: string | null
          table_id: string | null
          tax_total_cents: number
          tip_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          currency?: string
          discount_total_cents?: number
          external_order_id?: string | null
          external_table_id?: string | null
          guest_count?: number | null
          guest_id?: string | null
          id?: string
          imported_at?: string | null
          match_score?: string | null
          matched_at?: string | null
          matched_by_user_id?: string | null
          matching_status?: string
          metadata?: Json
          opened_at?: string | null
          payment_status?: string
          pos_connection_id?: string | null
          provider?: string
          raw_payload?: Json
          receipt_created_at?: string | null
          reservation_id?: string | null
          restaurant_id: string
          source_type?: string
          subtotal_cents?: number
          sync_error?: string | null
          sync_status?: string | null
          table_id?: string | null
          tax_total_cents?: number
          tip_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          currency?: string
          discount_total_cents?: number
          external_order_id?: string | null
          external_table_id?: string | null
          guest_count?: number | null
          guest_id?: string | null
          id?: string
          imported_at?: string | null
          match_score?: string | null
          matched_at?: string | null
          matched_by_user_id?: string | null
          matching_status?: string
          metadata?: Json
          opened_at?: string | null
          payment_status?: string
          pos_connection_id?: string | null
          provider?: string
          raw_payload?: Json
          receipt_created_at?: string | null
          reservation_id?: string | null
          restaurant_id?: string
          source_type?: string
          subtotal_cents?: number
          sync_error?: string | null
          sync_status?: string | null
          table_id?: string | null
          tax_total_cents?: number
          tip_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      pre_order_items: {
        Row: {
          category: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          external_product_id: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          pos_provider: string | null
          price_cents: number | null
          requires_payment: boolean
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          external_product_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          pos_provider?: string | null
          price_cents?: number | null
          requires_payment?: boolean
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          external_product_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          pos_provider?: string | null
          price_cents?: number | null
          requires_payment?: boolean
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pre_orders: {
        Row: {
          created_at: string
          id: string
          item_name: string
          note: string | null
          pre_order_item_id: string | null
          quantity: number
          reservation_id: string
          status: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          note?: string | null
          pre_order_item_id?: string | null
          quantity?: number
          reservation_id: string
          status?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          note?: string | null
          pre_order_item_id?: string | null
          quantity?: number
          reservation_id?: string
          status?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_reminders: {
        Row: {
          channel: string
          clickwise_workflow_id: string | null
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          metadata: Json
          reminder_type: string
          reservation_id: string
          restaurant_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          clickwise_workflow_id?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json
          reminder_type: string
          reservation_id: string
          restaurant_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          clickwise_workflow_id?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json
          reminder_type?: string
          reservation_id?: string
          restaurant_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservation_status_history: {
        Row: {
          changed_by: string | null
          changed_by_type: string
          created_at: string
          id: string
          metadata: Json
          new_status: string
          old_status: string | null
          reason: string | null
          reservation_id: string
          restaurant_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_status: string
          old_status?: string | null
          reason?: string | null
          reservation_id: string
          restaurant_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: string
          old_status?: string | null
          reason?: string | null
          reservation_id?: string
          restaurant_id?: string
        }
        Relationships: []
      }
      reservation_tables: {
        Row: {
          created_at: string
          id: string
          reservation_id: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reservation_id: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reservation_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_tables_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_tables_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancel_token: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          channel: Database["public"]["Enums"]["reservation_channel"]
          clickwise_contact_id: string | null
          clickwise_workflow_status: string | null
          confirmation_code: string | null
          confirmation_status: string
          created_at: string
          created_by: string | null
          deposit_amount_cents: number
          deposit_currency: string
          deposit_policy_notes: string | null
          deposit_required: boolean
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          dietary_notes: string | null
          end_time: string
          external_reference: string | null
          guest_id: string | null
          hold_expires_at: string | null
          id: string
          internal_notes: string | null
          large_group_status: string | null
          magic_token_expires_at: string | null
          manage_token: string | null
          no_show_marked_at: string | null
          no_show_risk: string | null
          no_show_risk_factors: Json
          occasion: string | null
          party_size: number
          payment_status: string | null
          pos_order_id: string | null
          pos_provider: string | null
          pos_receipt_id: string | null
          receipt_total: number | null
          reconfirmation_declined_at: string | null
          reconfirmation_requested_at: string | null
          reconfirmation_status: string
          reconfirmed_at: string | null
          reminder_confirmed_at: string | null
          reminder_sent_at: string | null
          requires_manual_approval: boolean
          reservation_date: string
          restaurant_id: string
          source_label: string | null
          source_metadata: Json
          special_requests: string | null
          start_time: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          cancel_token?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["reservation_channel"]
          clickwise_contact_id?: string | null
          clickwise_workflow_status?: string | null
          confirmation_code?: string | null
          confirmation_status?: string
          created_at?: string
          created_by?: string | null
          deposit_amount_cents?: number
          deposit_currency?: string
          deposit_policy_notes?: string | null
          deposit_required?: boolean
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          dietary_notes?: string | null
          end_time: string
          external_reference?: string | null
          guest_id?: string | null
          hold_expires_at?: string | null
          id?: string
          internal_notes?: string | null
          large_group_status?: string | null
          magic_token_expires_at?: string | null
          manage_token?: string | null
          no_show_marked_at?: string | null
          no_show_risk?: string | null
          no_show_risk_factors?: Json
          occasion?: string | null
          party_size: number
          payment_status?: string | null
          pos_order_id?: string | null
          pos_provider?: string | null
          pos_receipt_id?: string | null
          receipt_total?: number | null
          reconfirmation_declined_at?: string | null
          reconfirmation_requested_at?: string | null
          reconfirmation_status?: string
          reconfirmed_at?: string | null
          reminder_confirmed_at?: string | null
          reminder_sent_at?: string | null
          requires_manual_approval?: boolean
          reservation_date: string
          restaurant_id: string
          source_label?: string | null
          source_metadata?: Json
          special_requests?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          cancel_token?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["reservation_channel"]
          clickwise_contact_id?: string | null
          clickwise_workflow_status?: string | null
          confirmation_code?: string | null
          confirmation_status?: string
          created_at?: string
          created_by?: string | null
          deposit_amount_cents?: number
          deposit_currency?: string
          deposit_policy_notes?: string | null
          deposit_required?: boolean
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          dietary_notes?: string | null
          end_time?: string
          external_reference?: string | null
          guest_id?: string | null
          hold_expires_at?: string | null
          id?: string
          internal_notes?: string | null
          large_group_status?: string | null
          magic_token_expires_at?: string | null
          manage_token?: string | null
          no_show_marked_at?: string | null
          no_show_risk?: string | null
          no_show_risk_factors?: Json
          occasion?: string | null
          party_size?: number
          payment_status?: string | null
          pos_order_id?: string | null
          pos_provider?: string | null
          pos_receipt_id?: string | null
          receipt_total?: number | null
          reconfirmation_declined_at?: string | null
          reconfirmation_requested_at?: string | null
          reconfirmation_status?: string
          reconfirmed_at?: string | null
          reminder_confirmed_at?: string | null
          reminder_sent_at?: string | null
          requires_manual_approval?: boolean
          reservation_date?: string
          restaurant_id?: string
          source_label?: string | null
          source_metadata?: Json
          special_requests?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_modules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address_line1: string | null
          aftercare_enabled: boolean
          allow_guest_notes: boolean
          allow_zone_preference: boolean
          auto_confirm: boolean
          booking_horizon_days: number
          booking_lead_time_minutes: number
          brand_accent: string | null
          brand_primary: string | null
          city: string | null
          country: string
          created_at: string
          custom_widget_domain: string | null
          default_language: string
          default_reservation_minutes: number
          deleted_at: string | null
          deposit_default_amount_cents: number
          deposit_exempt_regulars: boolean
          deposit_exempt_vip: boolean
          deposit_guest_message: string | null
          deposit_voucher_credit_possible: boolean
          email: string | null
          google_review_url: string | null
          hold_minutes: number
          id: string
          is_active: boolean
          is_live: boolean
          large_group_auto_book_max: number
          large_group_cancellation_terms: string | null
          large_group_confirmation_text: string | null
          large_group_default_status: string
          large_group_deposit_recommended_from: number
          large_group_extra_minutes: number
          large_group_manual_approval_from: number
          large_group_minutes: number
          large_group_threshold: number
          legal_name: string | null
          locale: string
          logo_url: string | null
          manual_approval_from_party_size: number | null
          marked_live_at: string | null
          max_covers_per_slot: number | null
          max_new_reservations_per_15min: number | null
          max_party_size_online: number
          metadata: Json
          name: string
          noshow_cancel_message: string | null
          noshow_cancellation_cutoff_minutes: number
          noshow_confirmation_enabled: boolean
          noshow_deposit_rules_prepared: boolean
          noshow_exempt_regulars_prepared: boolean
          noshow_guest_cancel_link_enabled: boolean
          noshow_reconfirm_enabled: boolean
          noshow_reconfirmation_hours_before: number
          noshow_reminder_24h_enabled: boolean
          noshow_reminder_2h_enabled: boolean
          noshow_risk_signal_enabled: boolean
          peak_warning_threshold_pct: number
          phone: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          plan_started_at: string
          plan_type: string | null
          postal_code: string | null
          preorders_allow_free_text: boolean
          preorders_enabled: boolean
          preorders_payment_required: boolean
          public_base_url: string | null
          slot_duration_minutes: number
          slug: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          waitlist_allow_preferred_times: boolean
          waitlist_auto_offer_on_full: boolean
          waitlist_clickwise_message_prepared: boolean
          waitlist_enabled: boolean
          waitlist_response_window_minutes: number
          walkin_ai_quick_seat: boolean
          walkin_default_minutes: number
          walkin_default_zone_id: string | null
          walkin_quick_buttons: boolean
          walkins_enabled: boolean
          webhook_secret: string | null
          webhook_url: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          aftercare_enabled?: boolean
          allow_guest_notes?: boolean
          allow_zone_preference?: boolean
          auto_confirm?: boolean
          booking_horizon_days?: number
          booking_lead_time_minutes?: number
          brand_accent?: string | null
          brand_primary?: string | null
          city?: string | null
          country?: string
          created_at?: string
          custom_widget_domain?: string | null
          default_language?: string
          default_reservation_minutes?: number
          deleted_at?: string | null
          deposit_default_amount_cents?: number
          deposit_exempt_regulars?: boolean
          deposit_exempt_vip?: boolean
          deposit_guest_message?: string | null
          deposit_voucher_credit_possible?: boolean
          email?: string | null
          google_review_url?: string | null
          hold_minutes?: number
          id?: string
          is_active?: boolean
          is_live?: boolean
          large_group_auto_book_max?: number
          large_group_cancellation_terms?: string | null
          large_group_confirmation_text?: string | null
          large_group_default_status?: string
          large_group_deposit_recommended_from?: number
          large_group_extra_minutes?: number
          large_group_manual_approval_from?: number
          large_group_minutes?: number
          large_group_threshold?: number
          legal_name?: string | null
          locale?: string
          logo_url?: string | null
          manual_approval_from_party_size?: number | null
          marked_live_at?: string | null
          max_covers_per_slot?: number | null
          max_new_reservations_per_15min?: number | null
          max_party_size_online?: number
          metadata?: Json
          name: string
          noshow_cancel_message?: string | null
          noshow_cancellation_cutoff_minutes?: number
          noshow_confirmation_enabled?: boolean
          noshow_deposit_rules_prepared?: boolean
          noshow_exempt_regulars_prepared?: boolean
          noshow_guest_cancel_link_enabled?: boolean
          noshow_reconfirm_enabled?: boolean
          noshow_reconfirmation_hours_before?: number
          noshow_reminder_24h_enabled?: boolean
          noshow_reminder_2h_enabled?: boolean
          noshow_risk_signal_enabled?: boolean
          peak_warning_threshold_pct?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          plan_started_at?: string
          plan_type?: string | null
          postal_code?: string | null
          preorders_allow_free_text?: boolean
          preorders_enabled?: boolean
          preorders_payment_required?: boolean
          public_base_url?: string | null
          slot_duration_minutes?: number
          slug: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          waitlist_allow_preferred_times?: boolean
          waitlist_auto_offer_on_full?: boolean
          waitlist_clickwise_message_prepared?: boolean
          waitlist_enabled?: boolean
          waitlist_response_window_minutes?: number
          walkin_ai_quick_seat?: boolean
          walkin_default_minutes?: number
          walkin_default_zone_id?: string | null
          walkin_quick_buttons?: boolean
          walkins_enabled?: boolean
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          aftercare_enabled?: boolean
          allow_guest_notes?: boolean
          allow_zone_preference?: boolean
          auto_confirm?: boolean
          booking_horizon_days?: number
          booking_lead_time_minutes?: number
          brand_accent?: string | null
          brand_primary?: string | null
          city?: string | null
          country?: string
          created_at?: string
          custom_widget_domain?: string | null
          default_language?: string
          default_reservation_minutes?: number
          deleted_at?: string | null
          deposit_default_amount_cents?: number
          deposit_exempt_regulars?: boolean
          deposit_exempt_vip?: boolean
          deposit_guest_message?: string | null
          deposit_voucher_credit_possible?: boolean
          email?: string | null
          google_review_url?: string | null
          hold_minutes?: number
          id?: string
          is_active?: boolean
          is_live?: boolean
          large_group_auto_book_max?: number
          large_group_cancellation_terms?: string | null
          large_group_confirmation_text?: string | null
          large_group_default_status?: string
          large_group_deposit_recommended_from?: number
          large_group_extra_minutes?: number
          large_group_manual_approval_from?: number
          large_group_minutes?: number
          large_group_threshold?: number
          legal_name?: string | null
          locale?: string
          logo_url?: string | null
          manual_approval_from_party_size?: number | null
          marked_live_at?: string | null
          max_covers_per_slot?: number | null
          max_new_reservations_per_15min?: number | null
          max_party_size_online?: number
          metadata?: Json
          name?: string
          noshow_cancel_message?: string | null
          noshow_cancellation_cutoff_minutes?: number
          noshow_confirmation_enabled?: boolean
          noshow_deposit_rules_prepared?: boolean
          noshow_exempt_regulars_prepared?: boolean
          noshow_guest_cancel_link_enabled?: boolean
          noshow_reconfirm_enabled?: boolean
          noshow_reconfirmation_hours_before?: number
          noshow_reminder_24h_enabled?: boolean
          noshow_reminder_2h_enabled?: boolean
          noshow_risk_signal_enabled?: boolean
          peak_warning_threshold_pct?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          plan_started_at?: string
          plan_type?: string | null
          postal_code?: string | null
          preorders_allow_free_text?: boolean
          preorders_enabled?: boolean
          preorders_payment_required?: boolean
          public_base_url?: string | null
          slot_duration_minutes?: number
          slug?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          waitlist_allow_preferred_times?: boolean
          waitlist_auto_offer_on_full?: boolean
          waitlist_clickwise_message_prepared?: boolean
          waitlist_enabled?: boolean
          waitlist_response_window_minutes?: number
          walkin_ai_quick_seat?: boolean
          walkin_default_minutes?: number
          walkin_default_zone_id?: string | null
          walkin_quick_buttons?: boolean
          walkins_enabled?: boolean
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          clickwise_workflow_id: string | null
          created_at: string
          feedback_text: string | null
          feedback_type: string | null
          follow_up_due_at: string | null
          follow_up_owner_id: string | null
          follow_up_status: string | null
          google_review_requested: boolean
          guest_id: string | null
          id: string
          internal_note: string | null
          manager_follow_up_required: boolean
          metadata: Json
          public_review_url: string | null
          reservation_id: string
          responded_at: string | null
          restaurant_id: string
          routed_to: string | null
          satisfaction: number | null
          scheduled_for: string
          sent_at: string | null
          source_channel: string | null
          status: Database["public"]["Enums"]["review_request_status"]
          token: string
          updated_at: string
        }
        Insert: {
          clickwise_workflow_id?: string | null
          created_at?: string
          feedback_text?: string | null
          feedback_type?: string | null
          follow_up_due_at?: string | null
          follow_up_owner_id?: string | null
          follow_up_status?: string | null
          google_review_requested?: boolean
          guest_id?: string | null
          id?: string
          internal_note?: string | null
          manager_follow_up_required?: boolean
          metadata?: Json
          public_review_url?: string | null
          reservation_id: string
          responded_at?: string | null
          restaurant_id: string
          routed_to?: string | null
          satisfaction?: number | null
          scheduled_for: string
          sent_at?: string | null
          source_channel?: string | null
          status?: Database["public"]["Enums"]["review_request_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          clickwise_workflow_id?: string | null
          created_at?: string
          feedback_text?: string | null
          feedback_type?: string | null
          follow_up_due_at?: string | null
          follow_up_owner_id?: string | null
          follow_up_status?: string | null
          google_review_requested?: boolean
          guest_id?: string | null
          id?: string
          internal_note?: string | null
          manager_follow_up_required?: boolean
          metadata?: Json
          public_review_url?: string | null
          reservation_id?: string
          responded_at?: string | null
          restaurant_id?: string
          routed_to?: string | null
          satisfaction?: number | null
          scheduled_for?: string
          sent_at?: string | null
          source_channel?: string | null
          status?: Database["public"]["Enums"]["review_request_status"]
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          max_covers_override: number | null
          max_guests: number | null
          name: string
          restaurant_id: string
          start_time: string
          updated_at: string
          weekdays: Database["public"]["Enums"]["weekday"][]
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          max_covers_override?: number | null
          max_guests?: number | null
          name: string
          restaurant_id: string
          start_time: string
          updated_at?: string
          weekdays?: Database["public"]["Enums"]["weekday"][]
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          max_covers_override?: number | null
          max_guests?: number | null
          name?: string
          restaurant_id?: string
          start_time?: string
          updated_at?: string
          weekdays?: Database["public"]["Enums"]["weekday"][]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      special_days: {
        Row: {
          closes_at: string | null
          created_at: string
          date: string
          id: string
          is_closed: boolean
          metadata: Json
          name: string
          notes: string | null
          opens_at: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          date: string
          id?: string
          is_closed?: boolean
          metadata?: Json
          name: string
          notes?: string | null
          opens_at?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          date?: string
          id?: string
          is_closed?: boolean
          metadata?: Json
          name?: string
          notes?: string | null
          opens_at?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      table_combinations: {
        Row: {
          capacity_max: number
          capacity_min: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          table_ids: string[]
          updated_at: string
        }
        Insert: {
          capacity_max: number
          capacity_min: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          table_ids: string[]
          updated_at?: string
        }
        Update: {
          capacity_max?: number
          capacity_min?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          table_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_combinations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity_max: number
          capacity_min: number
          combinable: boolean
          created_at: string
          height: number
          id: string
          is_active: boolean
          label: string
          pos_x: number
          pos_y: number
          restaurant_id: string
          shape: string
          updated_at: string
          width: number
          zone_id: string | null
        }
        Insert: {
          capacity_max?: number
          capacity_min?: number
          combinable?: boolean
          created_at?: string
          height?: number
          id?: string
          is_active?: boolean
          label: string
          pos_x?: number
          pos_y?: number
          restaurant_id: string
          shape?: string
          updated_at?: string
          width?: number
          zone_id?: string | null
        }
        Update: {
          capacity_max?: number
          capacity_min?: number
          combinable?: boolean
          created_at?: string
          height?: number
          id?: string
          is_active?: boolean
          label?: string
          pos_x?: number
          pos_y?: number
          restaurant_id?: string
          shape?: string
          updated_at?: string
          width?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_agent_settings: {
        Row: {
          agent_id: string | null
          config: Json
          created_at: string
          id: string
          mode: string
          phone_number: string | null
          provider: string
          restaurant_id: string
          system_prompt_notes: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          mode?: string
          phone_number?: string | null
          provider?: string
          restaurant_id: string
          system_prompt_notes?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          mode?: string
          phone_number?: string | null
          provider?: string
          restaurant_id?: string
          system_prompt_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          channel: Database["public"]["Enums"]["reservation_channel"]
          converted_reservation_id: string | null
          created_at: string
          desired_date: string
          desired_time_from: string
          desired_time_to: string
          email: string | null
          expires_at: string | null
          first_name: string
          flexible_minutes: number
          guest_id: string | null
          id: string
          language: string
          last_name: string | null
          marketing_consent: boolean
          matched_at: string | null
          matched_reservation_id: string | null
          matched_start_time: string | null
          matched_table_id: string | null
          notes: string | null
          notified_at: string | null
          party_size: number
          phone: string | null
          restaurant_id: string
          source_metadata: Json
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          zone_preference: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reservation_channel"]
          converted_reservation_id?: string | null
          created_at?: string
          desired_date: string
          desired_time_from: string
          desired_time_to: string
          email?: string | null
          expires_at?: string | null
          first_name: string
          flexible_minutes?: number
          guest_id?: string | null
          id?: string
          language?: string
          last_name?: string | null
          marketing_consent?: boolean
          matched_at?: string | null
          matched_reservation_id?: string | null
          matched_start_time?: string | null
          matched_table_id?: string | null
          notes?: string | null
          notified_at?: string | null
          party_size: number
          phone?: string | null
          restaurant_id: string
          source_metadata?: Json
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          zone_preference?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["reservation_channel"]
          converted_reservation_id?: string | null
          created_at?: string
          desired_date?: string
          desired_time_from?: string
          desired_time_to?: string
          email?: string | null
          expires_at?: string | null
          first_name?: string
          flexible_minutes?: number
          guest_id?: string | null
          id?: string
          language?: string
          last_name?: string | null
          marketing_consent?: boolean
          matched_at?: string | null
          matched_reservation_id?: string | null
          matched_start_time?: string | null
          matched_table_id?: string | null
          notes?: string | null
          notified_at?: string | null
          party_size?: number
          phone?: string | null
          restaurant_id?: string
          source_metadata?: Json
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          zone_preference?: string | null
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean
          label: string
          last_test_at: string | null
          last_test_response_body: string | null
          last_test_response_code: number | null
          last_test_status: string | null
          restaurant_id: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          label: string
          last_test_at?: string | null
          last_test_response_body?: string | null
          last_test_response_code?: number | null
          last_test_status?: string | null
          restaurant_id: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          label?: string
          last_test_at?: string | null
          last_test_response_body?: string | null
          last_test_response_code?: number | null
          last_test_status?: string | null
          restaurant_id?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_restaurant_with_owner: {
        Args: { _name: string; _slug: string; _timezone?: string }
        Returns: string
      }
      has_restaurant_role: {
        Args: {
          _restaurant_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_restaurant_manager: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      is_restaurant_member: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: never; Returns: boolean }
      purge_restaurant_operational_data: {
        Args: { _restaurant_id: string }
        Returns: Json
      }
      restaurant_plan: {
        Args: { _restaurant_id: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "host" | "staff"
      deposit_status:
        | "not_required"
        | "pending"
        | "authorized"
        | "captured"
        | "released"
        | "forfeited"
        | "refunded"
      integration_event_status:
        | "pending"
        | "sent"
        | "failed"
        | "processing"
        | "skipped"
      large_group_status: "new" | "in_progress" | "confirmed" | "declined"
      pos_connection_status: "pending" | "connected" | "error" | "disconnected"
      pos_provider:
        | "loyverse"
        | "lightspeed"
        | "square"
        | "untill"
        | "other"
        | "loyverse_demo"
        | "manual_demo"
        | "manual"
        | "csv_import"
        | "webhook"
        | "vectron"
        | "booq"
        | "twelve"
        | "mpluskassa"
        | "eijsink"
        | "winston"
        | "tebi"
        | "custom_api"
      reservation_channel:
        | "online"
        | "phone"
        | "walk_in"
        | "ai_host"
        | "manager"
        | "clickwise"
        | "import"
        | "whatsapp"
        | "instagram"
        | "google"
        | "qr_table"
        | "walkin_qr"
        | "partner"
        | "returning_guest"
      reservation_status:
        | "hold"
        | "pending"
        | "confirmed"
        | "seated"
        | "finished"
        | "no_show"
        | "cancelled"
        | "completed"
      review_request_status:
        | "pending"
        | "sent"
        | "responded"
        | "skipped"
        | "failed"
        | "ready_to_send"
        | "positive"
        | "neutral"
        | "negative"
        | "follow_up_required"
        | "google_review_invited"
      subscription_plan: "trial" | "basic" | "pro"
      waitlist_status:
        | "waiting"
        | "matched"
        | "notified"
        | "confirmed"
        | "converted"
        | "expired"
        | "cancelled"
      weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
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
      app_role: ["owner", "manager", "host", "staff"],
      deposit_status: [
        "not_required",
        "pending",
        "authorized",
        "captured",
        "released",
        "forfeited",
        "refunded",
      ],
      integration_event_status: [
        "pending",
        "sent",
        "failed",
        "processing",
        "skipped",
      ],
      large_group_status: ["new", "in_progress", "confirmed", "declined"],
      pos_connection_status: ["pending", "connected", "error", "disconnected"],
      pos_provider: [
        "loyverse",
        "lightspeed",
        "square",
        "untill",
        "other",
        "loyverse_demo",
        "manual_demo",
        "manual",
        "csv_import",
        "webhook",
        "vectron",
        "booq",
        "twelve",
        "mpluskassa",
        "eijsink",
        "winston",
        "tebi",
        "custom_api",
      ],
      reservation_channel: [
        "online",
        "phone",
        "walk_in",
        "ai_host",
        "manager",
        "clickwise",
        "import",
        "whatsapp",
        "instagram",
        "google",
        "qr_table",
        "walkin_qr",
        "partner",
        "returning_guest",
      ],
      reservation_status: [
        "hold",
        "pending",
        "confirmed",
        "seated",
        "finished",
        "no_show",
        "cancelled",
        "completed",
      ],
      review_request_status: [
        "pending",
        "sent",
        "responded",
        "skipped",
        "failed",
        "ready_to_send",
        "positive",
        "neutral",
        "negative",
        "follow_up_required",
        "google_review_invited",
      ],
      subscription_plan: ["trial", "basic", "pro"],
      waitlist_status: [
        "waiting",
        "matched",
        "notified",
        "confirmed",
        "converted",
        "expired",
        "cancelled",
      ],
      weekday: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  },
} as const
