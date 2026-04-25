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
      guests: {
        Row: {
          allergies: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_blacklisted: boolean
          is_vip: boolean
          language: string
          last_name: string | null
          marketing_consent: boolean
          no_show_count: number
          notes: string | null
          phone: string | null
          restaurant_id: string
          tags: string[]
          total_visits: number
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_blacklisted?: boolean
          is_vip?: boolean
          language?: string
          last_name?: string | null
          marketing_consent?: boolean
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          tags?: string[]
          total_visits?: number
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_blacklisted?: boolean
          is_vip?: boolean
          language?: string
          last_name?: string | null
          marketing_consent?: boolean
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          tags?: string[]
          total_visits?: number
          updated_at?: string
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
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          restaurant_id: string
          status: Database["public"]["Enums"]["integration_event_status"]
          target: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          restaurant_id: string
          status?: Database["public"]["Enums"]["integration_event_status"]
          target?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          restaurant_id?: string
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
      pre_orders: {
        Row: {
          created_at: string
          id: string
          item_name: string
          note: string | null
          quantity: number
          reservation_id: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          note?: string | null
          quantity?: number
          reservation_id: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          note?: string | null
          quantity?: number
          reservation_id?: string
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
          channel: Database["public"]["Enums"]["reservation_channel"]
          confirmation_code: string | null
          created_at: string
          created_by: string | null
          dietary_notes: string | null
          end_time: string
          guest_id: string | null
          hold_expires_at: string | null
          id: string
          internal_notes: string | null
          occasion: string | null
          party_size: number
          reservation_date: string
          restaurant_id: string
          source_metadata: Json
          special_requests: string | null
          start_time: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reservation_channel"]
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          dietary_notes?: string | null
          end_time: string
          guest_id?: string | null
          hold_expires_at?: string | null
          id?: string
          internal_notes?: string | null
          occasion?: string | null
          party_size: number
          reservation_date: string
          restaurant_id: string
          source_metadata?: Json
          special_requests?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["reservation_channel"]
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          dietary_notes?: string | null
          end_time?: string
          guest_id?: string | null
          hold_expires_at?: string | null
          id?: string
          internal_notes?: string | null
          occasion?: string | null
          party_size?: number
          reservation_date?: string
          restaurant_id?: string
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
      restaurants: {
        Row: {
          address_line1: string | null
          booking_horizon_days: number
          booking_lead_time_minutes: number
          brand_accent: string | null
          brand_primary: string | null
          city: string | null
          country: string
          created_at: string
          default_reservation_minutes: number
          email: string | null
          hold_minutes: number
          id: string
          large_group_threshold: number
          locale: string
          logo_url: string | null
          max_party_size_online: number
          name: string
          phone: string | null
          postal_code: string | null
          slot_duration_minutes: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          booking_horizon_days?: number
          booking_lead_time_minutes?: number
          brand_accent?: string | null
          brand_primary?: string | null
          city?: string | null
          country?: string
          created_at?: string
          default_reservation_minutes?: number
          email?: string | null
          hold_minutes?: number
          id?: string
          large_group_threshold?: number
          locale?: string
          logo_url?: string | null
          max_party_size_online?: number
          name: string
          phone?: string | null
          postal_code?: string | null
          slot_duration_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          booking_horizon_days?: number
          booking_lead_time_minutes?: number
          brand_accent?: string | null
          brand_primary?: string | null
          city?: string | null
          country?: string
          created_at?: string
          default_reservation_minutes?: number
          email?: string | null
          hold_minutes?: number
          id?: string
          large_group_threshold?: number
          locale?: string
          logo_url?: string | null
          max_party_size_online?: number
          name?: string
          phone?: string | null
          postal_code?: string | null
          slot_duration_minutes?: number
          slug?: string
          timezone?: string
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
    }
    Enums: {
      app_role: "owner" | "manager" | "host" | "staff"
      integration_event_status: "pending" | "sent" | "failed"
      large_group_status: "new" | "in_progress" | "confirmed" | "declined"
      reservation_channel:
        | "online"
        | "phone"
        | "walk_in"
        | "ai_host"
        | "manager"
        | "clickwise"
        | "import"
      reservation_status:
        | "hold"
        | "pending"
        | "confirmed"
        | "seated"
        | "finished"
        | "no_show"
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
      integration_event_status: ["pending", "sent", "failed"],
      large_group_status: ["new", "in_progress", "confirmed", "declined"],
      reservation_channel: [
        "online",
        "phone",
        "walk_in",
        "ai_host",
        "manager",
        "clickwise",
        "import",
      ],
      reservation_status: [
        "hold",
        "pending",
        "confirmed",
        "seated",
        "finished",
        "no_show",
        "cancelled",
      ],
      weekday: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  },
} as const
