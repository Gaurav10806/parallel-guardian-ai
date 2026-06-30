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
      agent_activity: {
        Row: {
          action: string
          agent: string
          created_at: string
          id: string
          summary: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          agent: string
          created_at?: string
          id?: string
          summary: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          agent?: string
          created_at?: string
          id?: string
          summary?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          content: Json
          created_at: string
          id: string
          kind: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          kind: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefs: {
        Row: {
          content: Json
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          date: string
          id?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      productivity_metrics: {
        Row: {
          completed: number
          created_at: string
          date: string
          focus_minutes: number
          id: string
          missed: number
          productivity_score: number
          user_id: string
        }
        Insert: {
          completed?: number
          created_at?: string
          date: string
          focus_minutes?: number
          id?: string
          missed?: number
          productivity_score?: number
          user_id: string
        }
        Update: {
          completed?: number
          created_at?: string
          date?: string
          focus_minutes?: number
          id?: string
          missed?: number
          productivity_score?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_active_date: string | null
          streak_count: number
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_active_date?: string | null
          streak_count?: number
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          streak_count?: number
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reflections: {
        Row: {
          completed_count: number
          created_at: string
          date: string
          id: string
          missed_count: number
          suggestions: Json
          summary: string
          user_id: string
        }
        Insert: {
          completed_count?: number
          created_at?: string
          date: string
          id?: string
          missed_count?: number
          suggestions?: Json
          summary: string
          user_id: string
        }
        Update: {
          completed_count?: number
          created_at?: string
          date?: string
          id?: string
          missed_count?: number
          suggestions?: Json
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          created_at: string
          estimated_minutes: number
          id: string
          order_index: number
          status: string
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          order_index?: number
          status?: string
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          order_index?: number
          status?: string
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          ai_generated: boolean
          category: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          estimated_completion_probability: number
          estimated_minutes: number
          id: string
          priority: number
          procrastination_reason: string | null
          procrastination_risk: number
          rescue_plan_generated: boolean
          risk_detected_at: string | null
          risk_level: string
          status: string
          title: string
          updated_at: string
          urgency_score: number
          user_id: string
        }
        Insert: {
          ai_generated?: boolean
          category?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          estimated_completion_probability?: number
          estimated_minutes?: number
          id?: string
          priority?: number
          procrastination_reason?: string | null
          procrastination_risk?: number
          rescue_plan_generated?: boolean
          risk_detected_at?: string | null
          risk_level?: string
          status?: string
          title: string
          updated_at?: string
          urgency_score?: number
          user_id: string
        }
        Update: {
          ai_generated?: boolean
          category?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          estimated_completion_probability?: number
          estimated_minutes?: number
          id?: string
          priority?: number
          procrastination_reason?: string | null
          procrastination_risk?: number
          rescue_plan_generated?: boolean
          risk_detected_at?: string | null
          risk_level?: string
          status?: string
          title?: string
          updated_at?: string
          urgency_score?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
