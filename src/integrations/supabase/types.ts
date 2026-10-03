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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      advice_log: {
        Row: {
          advice: string
          created_at: string
          date: string
          id: string
          resource_ids: string[]
          stats: Json
          user_id: string
        }
        Insert: {
          advice?: string
          created_at?: string
          date?: string
          id?: string
          resource_ids?: string[]
          stats?: Json
          user_id?: string
        }
        Update: {
          advice?: string
          created_at?: string
          date?: string
          id?: string
          resource_ids?: string[]
          stats?: Json
          user_id?: string
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string
          date: string
          id: string
          source: string
          status: string
          user_id: string
        }
        Insert: {
          application_id: string
          date?: string
          id?: string
          source?: string
          status: string
          user_id?: string
        }
        Update: {
          application_id?: string
          date?: string
          id?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_date: string | null
          company: string
          created_at: string
          id: string
          listing_id: string
          notes: string
          role: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_date?: string | null
          company: string
          created_at?: string
          id?: string
          listing_id: string
          notes?: string
          role: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          applied_date?: string | null
          company?: string
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string
          role?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coffee_chats: {
        Row: {
          company: string
          contact_name: string
          created_at: string
          date: string | null
          follow_up_date: string | null
          id: string
          notes: string
          outcome: string
          referral: boolean | null
          user_id: string
        }
        Insert: {
          company?: string
          contact_name: string
          created_at?: string
          date?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string
          outcome?: string
          referral?: boolean | null
          user_id?: string
        }
        Update: {
          company?: string
          contact_name?: string
          created_at?: string
          date?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string
          outcome?: string
          referral?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      email_suggestions: {
        Row: {
          company: string | null
          confidence: number | null
          created_at: string
          email_type: string | null
          event_datetime: string | null
          evidence: string | null
          gmail_message_id: string
          id: string
          kind: string
          role: string | null
          state: string
          user_id: string
        }
        Insert: {
          company?: string | null
          confidence?: number | null
          created_at?: string
          email_type?: string | null
          event_datetime?: string | null
          evidence?: string | null
          gmail_message_id: string
          id?: string
          kind?: string
          role?: string | null
          state?: string
          user_id?: string
        }
        Update: {
          company?: string | null
          confidence?: number | null
          created_at?: string
          email_type?: string | null
          event_datetime?: string | null
          evidence?: string | null
          gmail_message_id?: string
          id?: string
          kind?: string
          role?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          title: string
          user_id?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_notices: {
        Row: {
          evidence_quote: string | null
          id: string
          opportunity_id: string
          source_url: string | null
          text: string
        }
        Insert: {
          evidence_quote?: string | null
          id: string
          opportunity_id: string
          source_url?: string | null
          text: string
        }
        Update: {
          evidence_quote?: string | null
          id?: string
          opportunity_id?: string
          source_url?: string | null
          text?: string
        }
        Relationships: []
      }
      plan_opportunity_dates: {
        Row: {
          application_deadline: string | null
          application_url: string | null
          opportunity_id: string
          start_date: string | null
        }
        Insert: {
          application_deadline?: string | null
          application_url?: string | null
          opportunity_id: string
          start_date?: string | null
        }
        Update: {
          application_deadline?: string | null
          application_url?: string | null
          opportunity_id?: string
          start_date?: string | null
        }
        Relationships: []
      }
      plan_progress: {
        Row: {
          id: string
          item_key: string
          opportunity_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_key: string
          opportunity_id: string
          status: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          item_key?: string
          opportunity_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_requirements: {
        Row: {
          created_at: string
          due_after: string | null
          due_after_days: number | null
          due_date: string | null
          evidence_quote: string | null
          id: string
          kind: string
          label: string
          note: string | null
          opportunity_id: string
          required: boolean
          source: string
          source_url: string | null
          stage: string
          status: string
        }
        Insert: {
          created_at?: string
          due_after?: string | null
          due_after_days?: number | null
          due_date?: string | null
          evidence_quote?: string | null
          id: string
          kind: string
          label: string
          note?: string | null
          opportunity_id: string
          required?: boolean
          source?: string
          source_url?: string | null
          stage: string
          status?: string
        }
        Update: {
          created_at?: string
          due_after?: string | null
          due_after_days?: number | null
          due_date?: string | null
          evidence_quote?: string | null
          id?: string
          kind?: string
          label?: string
          note?: string | null
          opportunity_id?: string
          required?: boolean
          source?: string
          source_url?: string | null
          stage?: string
          status?: string
        }
        Relationships: []
      }
      plan_user_requirements: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          opportunity_id: string
          required: boolean
          stage: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          opportunity_id: string
          required?: boolean
          stage?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          opportunity_id?: string
          required?: boolean
          stage?: string
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          id: string
          notes: string
          tag: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          tag?: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          tag?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
