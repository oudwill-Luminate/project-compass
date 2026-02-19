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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          description: string
          id: string
          project_id: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          project_id: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      buckets: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          owner_id: string | null
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id?: string | null
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string | null
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buckets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          label: string
          position: number
          task_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          label: string
          position?: number
          task_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          label?: string
          position?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          note: string
          stakeholder_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          note?: string
          stakeholder_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          note?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          hourly_rate: number
          id: string
          job_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          hourly_rate?: number
          id: string
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          hourly_rate?: number
          id?: string
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_goals: {
        Row: {
          created_at: string
          id: string
          position: number
          progress: number
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          progress?: number
          project_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          progress?: number
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          charter_markdown: string
          contingency_percent: number
          created_at: string
          created_by: string
          id: string
          include_weekends: boolean
          name: string
          updated_at: string
        }
        Insert: {
          charter_markdown?: string
          contingency_percent?: number
          created_at?: string
          created_by: string
          id?: string
          include_weekends?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          charter_markdown?: string
          contingency_percent?: number
          created_at?: string
          created_by?: string
          id?: string
          include_weekends?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["risk_action_type"]
          created_at: string
          description: string
          due_date: string | null
          id: string
          owner_id: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["risk_action_type"]
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          owner_id?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["risk_action_type"]
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          owner_id?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_actions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_snapshots: {
        Row: {
          created_at: string
          critical_count: number
          high_count: number
          id: string
          low_count: number
          medium_count: number
          project_id: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          critical_count?: number
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          project_id: string
          snapshot_date?: string
        }
        Update: {
          created_at?: string
          critical_count?: number
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          project_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_sentiment_history: {
        Row: {
          created_at: string
          id: string
          recorded_at: string
          sentiment: string
          stakeholder_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recorded_at?: string
          sentiment?: string
          stakeholder_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recorded_at?: string
          sentiment?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_sentiment_history_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          communication_plan: string
          created_at: string
          engagement: Database["public"]["Enums"]["engagement_level"]
          id: string
          interest: number
          last_communication_date: string | null
          name: string
          position: number
          power: number
          project_id: string
          role: string
          sentiment: string
          updated_at: string
        }
        Insert: {
          communication_plan?: string
          created_at?: string
          engagement?: Database["public"]["Enums"]["engagement_level"]
          id?: string
          interest?: number
          last_communication_date?: string | null
          name?: string
          position?: number
          power?: number
          project_id: string
          role?: string
          sentiment?: string
          updated_at?: string
        }
        Update: {
          communication_plan?: string
          created_at?: string
          engagement?: Database["public"]["Enums"]["engagement_level"]
          id?: string
          interest?: number
          last_communication_date?: string | null
          name?: string
          position?: number
          power?: number
          project_id?: string
          role?: string
          sentiment?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          dependency_type: Database["public"]["Enums"]["dependency_type"]
          id: string
          predecessor_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          id?: string
          predecessor_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          id?: string
          predecessor_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_exclusions: {
        Row: {
          created_at: string
          id: string
          task_a_id: string
          task_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_a_id: string
          task_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_a_id?: string
          task_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_exclusions_task_a_id_fkey"
            columns: ["task_a_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_exclusions_task_b_id_fkey"
            columns: ["task_b_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_cost: number
          baseline_end_date: string | null
          baseline_start_date: string | null
          bucket_id: string
          buffer_days: number
          buffer_position: string
          constraint_date: string | null
          constraint_type: Database["public"]["Enums"]["schedule_constraint"]
          created_at: string
          dependency_type: Database["public"]["Enums"]["dependency_type"]
          depends_on: string | null
          effort_hours: number
          end_date: string
          estimated_cost: number
          flagged_as_risk: boolean
          id: string
          is_milestone: boolean
          owner_id: string | null
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          realized_cost: number
          responsible: string | null
          risk_description: string
          risk_impact: number
          risk_probability: number
          start_date: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number
          baseline_end_date?: string | null
          baseline_start_date?: string | null
          bucket_id: string
          buffer_days?: number
          buffer_position?: string
          constraint_date?: string | null
          constraint_type?: Database["public"]["Enums"]["schedule_constraint"]
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          depends_on?: string | null
          effort_hours?: number
          end_date?: string
          estimated_cost?: number
          flagged_as_risk?: boolean
          id?: string
          is_milestone?: boolean
          owner_id?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          realized_cost?: number
          responsible?: string | null
          risk_description?: string
          risk_impact?: number
          risk_probability?: number
          start_date?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number
          baseline_end_date?: string | null
          baseline_start_date?: string | null
          bucket_id?: string
          buffer_days?: number
          buffer_position?: string
          constraint_date?: string | null
          constraint_type?: Database["public"]["Enums"]["schedule_constraint"]
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          depends_on?: string | null
          effort_hours?: number
          end_date?: string
          estimated_cost?: number
          flagged_as_risk?: boolean
          id?: string
          is_milestone?: boolean
          owner_id?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          realized_cost?: number
          responsible?: string | null
          risk_description?: string
          risk_impact?: number
          risk_probability?: number
          start_date?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_working_days: {
        Args: { _days: number; _include_weekends: boolean; _start: string }
        Returns: string
      }
      cascade_task_dates: {
        Args: {
          _include_weekends: boolean
          _new_end: string
          _new_start: string
          _task_id: string
        }
        Returns: number
      }
      get_project_id_from_bucket: {
        Args: { _bucket_id: string }
        Returns: string
      }
      get_project_id_from_stakeholder: {
        Args: { _stakeholder_id: string }
        Returns: string
      }
      get_project_id_from_task: { Args: { _task_id: string }; Returns: string }
      is_project_editor: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      next_working_day: {
        Args: { _d: string; _include_weekends: boolean }
        Returns: string
      }
      working_days_diff: {
        Args: { _end: string; _include_weekends: boolean; _start: string }
        Returns: number
      }
    }
    Enums: {
      dependency_type: "FS" | "FF" | "SS" | "SF"
      engagement_level:
        | "unaware"
        | "resistant"
        | "neutral"
        | "supportive"
        | "leading"
      project_role: "owner" | "editor" | "viewer"
      risk_action_type: "mitigation" | "contingency"
      schedule_constraint:
        | "ASAP"
        | "SNET"
        | "SNLT"
        | "MSO"
        | "MFO"
        | "FNET"
        | "FNLT"
      task_priority: "critical" | "high" | "medium" | "low"
      task_status: "done" | "working" | "stuck" | "not-started"
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
      dependency_type: ["FS", "FF", "SS", "SF"],
      engagement_level: [
        "unaware",
        "resistant",
        "neutral",
        "supportive",
        "leading",
      ],
      project_role: ["owner", "editor", "viewer"],
      risk_action_type: ["mitigation", "contingency"],
      schedule_constraint: [
        "ASAP",
        "SNET",
        "SNLT",
        "MSO",
        "MFO",
        "FNET",
        "FNLT",
      ],
      task_priority: ["critical", "high", "medium", "low"],
      task_status: ["done", "working", "stuck", "not-started"],
    },
  },
} as const
