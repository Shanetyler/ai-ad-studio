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
      assets: {
        Row: {
          created_at: string
          duration_s: number | null
          external_url: string | null
          id: string
          kind: string
          meta: Json | null
          owner_id: string
          project_id: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          duration_s?: number | null
          external_url?: string | null
          id?: string
          kind: string
          meta?: Json | null
          owner_id: string
          project_id?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          duration_s?: number | null
          external_url?: string | null
          id?: string
          kind?: string
          meta?: Json | null
          owner_id?: string
          project_id?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          kind: string
          meta: Json | null
          owner_id: string
          storage_path: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          kind: string
          meta?: Json | null
          owner_id: string
          storage_path: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json | null
          owner_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          extracted_json: Json | null
          guidelines_md: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string | null
          secondary_color: string | null
          tagline: string | null
          tone: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          extracted_json?: Json | null
          guidelines_md?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          tone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          extracted_json?: Json | null
          guidelines_md?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          tone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          job_id: string | null
          reason: string
          stripe_event_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          job_id?: string | null
          reason: string
          stripe_event_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          job_id?: string | null
          reason?: string
          stripe_event_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          cost_credits: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input_json: Json | null
          kind: Database["public"]["Enums"]["job_kind"]
          model_id: string | null
          output_json: Json | null
          owner_id: string
          progress: number
          project_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          cost_credits?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_json?: Json | null
          kind: Database["public"]["Enums"]["job_kind"]
          model_id?: string | null
          output_json?: Json | null
          owner_id: string
          progress?: number
          project_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          cost_credits?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_json?: Json | null
          kind?: Database["public"]["Enums"]["job_kind"]
          model_id?: string | null
          output_json?: Json | null
          owner_id?: string
          progress?: number
          project_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_brand_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_brand_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_brand_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          brand_id: string | null
          brief: string | null
          created_at: string
          id: string
          owner_id: string
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          brief?: string | null
          created_at?: string
          id?: string
          owner_id: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          brief?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          beats_json: Json | null
          created_at: string
          duration_s: number | null
          hook: string | null
          id: string
          owner_id: string
          project_id: string
          title: string | null
          voiceover_text: string | null
        }
        Insert: {
          beats_json?: Json | null
          created_at?: string
          duration_s?: number | null
          hook?: string | null
          id?: string
          owner_id: string
          project_id: string
          title?: string | null
          voiceover_text?: string | null
        }
        Update: {
          beats_json?: Json | null
          created_at?: string
          duration_s?: number | null
          hook?: string | null
          id?: string
          owner_id?: string
          project_id?: string
          title?: string | null
          voiceover_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboards: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          project_id: string
          scenes_json: Json
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          project_id: string
          scenes_json: Json
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string
          scenes_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "storyboards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          monthly_credit_grant: number
          seats: number
          status: string | null
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          tier: Database["public"]["Enums"]["sub_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          monthly_credit_grant?: number
          seats?: number
          status?: string | null
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          tier?: Database["public"]["Enums"]["sub_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          monthly_credit_grant?: number
          seats?: number
          status?: string | null
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          tier?: Database["public"]["Enums"]["sub_tier"]
          updated_at?: string
          user_id?: string
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
      credit_balance: { Args: { _user_id: string }; Returns: number }
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
      job_kind:
        | "brand_research"
        | "script"
        | "storyboard"
        | "image"
        | "video"
        | "tts"
        | "music"
        | "edit"
      job_status: "queued" | "running" | "succeeded" | "failed" | "canceled"
      sub_tier: "free" | "pro" | "business" | "enterprise"
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
      app_role: ["admin", "user"],
      job_kind: [
        "brand_research",
        "script",
        "storyboard",
        "image",
        "video",
        "tts",
        "music",
        "edit",
      ],
      job_status: ["queued", "running", "succeeded", "failed", "canceled"],
      sub_tier: ["free", "pro", "business", "enterprise"],
    },
  },
} as const
