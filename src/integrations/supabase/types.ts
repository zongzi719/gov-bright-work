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
      absence_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          contact_id: string
          created_at: string
          end_time: string | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          notes: string | null
          reason: string
          start_time: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          contact_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          notes?: string | null
          reason: string
          start_time: string
          status?: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          notes?: string | null
          reason?: string
          start_time?: string
          status?: Database["public"]["Enums"]["absence_status"]
          type?: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      canteen_menus: {
        Row: {
          breakfast: string[]
          created_at: string
          day_of_week: number
          dinner: string[]
          id: string
          lunch: string[]
          updated_at: string
        }
        Insert: {
          breakfast?: string[]
          created_at?: string
          day_of_week: number
          dinner?: string[]
          id?: string
          lunch?: string[]
          updated_at?: string
        }
        Update: {
          breakfast?: string[]
          created_at?: string
          day_of_week?: number
          dinner?: string[]
          id?: string
          lunch?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_active: boolean
          mobile: string | null
          name: string
          office_location: string | null
          organization_id: string
          phone: string | null
          position: string | null
          sort_order: number
          status: Database["public"]["Enums"]["contact_status"]
          status_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          name: string
          office_location?: string | null
          organization_id: string
          phone?: string | null
          position?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["contact_status"]
          status_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          name?: string
          office_location?: string | null
          organization_id?: string
          phone?: string | null
          position?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["contact_status"]
          status_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_schedule_permissions: {
        Row: {
          can_view_all: boolean
          created_at: string
          id: string
          leader_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_view_all?: boolean
          created_at?: string
          id?: string
          leader_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_view_all?: boolean
          created_at?: string
          id?: string
          leader_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_schedule_permissions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          leader_id: string
          location: string | null
          notes: string | null
          schedule_date: string
          schedule_type: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          leader_id: string
          location?: string | null
          notes?: string | null
          schedule_date: string
          schedule_type?: string
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          leader_id?: string
          location?: string | null
          notes?: string | null
          schedule_date?: string
          schedule_type?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_schedules_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          annual_leave_total: number
          annual_leave_used: number
          contact_id: string
          created_at: string
          id: string
          personal_leave_total: number
          personal_leave_used: number
          sick_leave_total: number
          sick_leave_used: number
          updated_at: string
          year: number
        }
        Insert: {
          annual_leave_total?: number
          annual_leave_used?: number
          contact_id: string
          created_at?: string
          id?: string
          personal_leave_total?: number
          personal_leave_used?: number
          sick_leave_total?: number
          sick_leave_used?: number
          updated_at?: string
          year?: number
        }
        Update: {
          annual_leave_total?: number
          annual_leave_used?: number
          contact_id?: string
          created_at?: string
          id?: string
          personal_leave_total?: number
          personal_leave_used?: number
          sick_leave_total?: number
          sick_leave_used?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          content: string | null
          created_at: string
          department: string
          id: string
          is_pinned: boolean
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          department: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          department?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      office_supplies: {
        Row: {
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          min_stock: number
          name: string
          specification: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          specification?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          specification?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          level: number
          name: string
          parent_id: string | null
          phone: string | null
          short_name: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          level?: number
          name: string
          parent_id?: string | null
          phone?: string | null
          short_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          level?: number
          name?: string
          parent_id?: string | null
          phone?: string | null
          short_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          id: string
          quantity: number
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["purchase_status"]
          supply_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          quantity: number
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["purchase_status"]
          supply_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          quantity?: number
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          supply_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_read: boolean | null
          can_update: boolean | null
          created_at: string | null
          data_scope: Database["public"]["Enums"]["data_scope"] | null
          id: string
          module_label: string
          module_name: string
          role: string
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          data_scope?: Database["public"]["Enums"]["data_scope"] | null
          id?: string
          module_label: string
          module_name: string
          role: string
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          data_scope?: Database["public"]["Enums"]["data_scope"] | null
          id?: string
          module_label?: string
          module_name?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      supply_requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          quantity: number
          requisition_by: string
          status: Database["public"]["Enums"]["requisition_status"]
          supply_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          quantity: number
          requisition_by: string
          status?: Database["public"]["Enums"]["requisition_status"]
          supply_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          quantity?: number
          requisition_by?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          supply_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requisitions_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      absence_status:
        | "pending"
        | "approved"
        | "rejected"
        | "completed"
        | "cancelled"
      absence_type: "out" | "leave" | "business_trip" | "meeting"
      app_role: "admin" | "user"
      contact_status: "on_duty" | "out" | "leave" | "business_trip" | "meeting"
      data_scope: "self" | "department" | "organization" | "all"
      leave_type: "annual" | "sick" | "personal"
      purchase_status: "pending" | "approved" | "rejected" | "completed"
      requisition_status: "pending" | "approved" | "rejected" | "completed"
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
      absence_status: [
        "pending",
        "approved",
        "rejected",
        "completed",
        "cancelled",
      ],
      absence_type: ["out", "leave", "business_trip", "meeting"],
      app_role: ["admin", "user"],
      contact_status: ["on_duty", "out", "leave", "business_trip", "meeting"],
      data_scope: ["self", "department", "organization", "all"],
      leave_type: ["annual", "sick", "personal"],
      purchase_status: ["pending", "approved", "rejected", "completed"],
      requisition_status: ["pending", "approved", "rejected", "completed"],
    },
  },
} as const
