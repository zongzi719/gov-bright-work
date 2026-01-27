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
          companions: string[] | null
          contact_id: string
          contact_phone: string | null
          created_at: string
          destination: string | null
          duration_days: number | null
          duration_hours: number | null
          end_time: string | null
          estimated_cost: number | null
          handover_notes: string | null
          handover_person_id: string | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          notes: string | null
          out_location: string | null
          out_type: string | null
          reason: string
          start_time: string
          status: Database["public"]["Enums"]["absence_status"]
          transport_type: string | null
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          companions?: string[] | null
          contact_id: string
          contact_phone?: string | null
          created_at?: string
          destination?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          end_time?: string | null
          estimated_cost?: number | null
          handover_notes?: string | null
          handover_person_id?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          notes?: string | null
          out_location?: string | null
          out_type?: string | null
          reason: string
          start_time: string
          status?: Database["public"]["Enums"]["absence_status"]
          transport_type?: string | null
          type: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          companions?: string[] | null
          contact_id?: string
          contact_phone?: string | null
          created_at?: string
          destination?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          end_time?: string | null
          estimated_cost?: number | null
          handover_notes?: string | null
          handover_person_id?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          notes?: string | null
          out_location?: string | null
          out_type?: string | null
          reason?: string
          start_time?: string
          status?: Database["public"]["Enums"]["absence_status"]
          transport_type?: string | null
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
          {
            foreignKeyName: "absence_records_handover_person_id_fkey"
            columns: ["handover_person_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_form_fields: {
        Row: {
          col_span: number
          created_at: string
          default_value: string | null
          field_label: string
          field_name: string
          field_options: Json | null
          field_type: string
          id: string
          is_required: boolean
          placeholder: string | null
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          col_span?: number
          created_at?: string
          default_value?: string | null
          field_label: string
          field_name: string
          field_options?: Json | null
          field_type: string
          id?: string
          is_required?: boolean
          placeholder?: string | null
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          col_span?: number
          created_at?: string
          default_value?: string | null
          field_label?: string
          field_name?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean
          placeholder?: string | null
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_form_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "approval_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_instances: {
        Row: {
          business_id: string
          business_type: string
          completed_at: string | null
          created_at: string
          current_node_index: number
          form_data: Json | null
          id: string
          initiator_id: string
          started_at: string
          status: Database["public"]["Enums"]["approval_instance_status"]
          template_id: string
          updated_at: string
          version_id: string
          version_number: number
        }
        Insert: {
          business_id: string
          business_type: string
          completed_at?: string | null
          created_at?: string
          current_node_index?: number
          form_data?: Json | null
          id?: string
          initiator_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["approval_instance_status"]
          template_id: string
          updated_at?: string
          version_id: string
          version_number: number
        }
        Update: {
          business_id?: string
          business_type?: string
          completed_at?: string | null
          created_at?: string
          current_node_index?: number
          form_data?: Json | null
          id?: string
          initiator_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["approval_instance_status"]
          template_id?: string
          updated_at?: string
          version_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_instances_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "approval_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_instances_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "approval_process_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_nodes: {
        Row: {
          approval_mode: string
          approver_ids: string[] | null
          approver_type: string
          condition_expression: Json | null
          created_at: string
          field_permissions: Json | null
          id: string
          node_name: string
          node_type: string
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          approval_mode?: string
          approver_ids?: string[] | null
          approver_type?: string
          condition_expression?: Json | null
          created_at?: string
          field_permissions?: Json | null
          id?: string
          node_name: string
          node_type?: string
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          approval_mode?: string
          approver_ids?: string[] | null
          approver_type?: string
          condition_expression?: Json | null
          created_at?: string
          field_permissions?: Json | null
          id?: string
          node_name?: string
          node_type?: string
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_nodes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "approval_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_process_versions: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          nodes_snapshot: Json
          notes: string | null
          published_at: string
          published_by: string | null
          template_id: string
          version_name: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          nodes_snapshot?: Json
          notes?: string | null
          published_at?: string
          published_by?: string | null
          template_id: string
          version_name: string
          version_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          nodes_snapshot?: Json
          notes?: string | null
          published_at?: string
          published_by?: string | null
          template_id?: string
          version_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_process_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "approval_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_records: {
        Row: {
          approver_id: string
          comment: string | null
          created_at: string
          id: string
          instance_id: string
          node_index: number
          node_name: string
          node_type: string
          processed_at: string | null
          status: Database["public"]["Enums"]["approval_record_status"]
          transferred_to: string | null
          updated_at: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          created_at?: string
          id?: string
          instance_id: string
          node_index: number
          node_name: string
          node_type: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["approval_record_status"]
          transferred_to?: string | null
          updated_at?: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          node_index?: number
          node_name?: string
          node_type?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["approval_record_status"]
          transferred_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_records_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_records_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "approval_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_records_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_templates: {
        Row: {
          allow_transfer: boolean
          allow_withdraw: boolean
          auto_approve_timeout: number | null
          business_type: string
          callback_url: string | null
          category: string
          code: string
          created_at: string
          current_version_id: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean
          last_process_saved_at: string | null
          name: string
          notify_approver: boolean
          notify_initiator: boolean
          updated_at: string
        }
        Insert: {
          allow_transfer?: boolean
          allow_withdraw?: boolean
          auto_approve_timeout?: number | null
          business_type?: string
          callback_url?: string | null
          category?: string
          code: string
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          last_process_saved_at?: string | null
          name: string
          notify_approver?: boolean
          notify_initiator?: boolean
          updated_at?: string
        }
        Update: {
          allow_transfer?: boolean
          allow_withdraw?: boolean
          auto_approve_timeout?: number | null
          business_type?: string
          callback_url?: string | null
          category?: string
          code?: string
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          last_process_saved_at?: string | null
          name?: string
          notify_approver?: boolean
          notify_initiator?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_templates_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "approval_process_versions"
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
          first_work_date: string | null
          id: string
          is_active: boolean
          is_leader: boolean
          mobile: string | null
          name: string
          office_location: string | null
          organization_id: string
          password_hash: string
          phone: string | null
          position: string | null
          security_level: string
          sort_order: number
          status: Database["public"]["Enums"]["contact_status"]
          status_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          first_work_date?: string | null
          id?: string
          is_active?: boolean
          is_leader?: boolean
          mobile?: string | null
          name: string
          office_location?: string | null
          organization_id: string
          password_hash?: string
          phone?: string | null
          position?: string | null
          security_level?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["contact_status"]
          status_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          first_work_date?: string | null
          id?: string
          is_active?: boolean
          is_leader?: boolean
          mobile?: string | null
          name?: string
          office_location?: string | null
          organization_id?: string
          password_hash?: string
          phone?: string | null
          position?: string | null
          security_level?: string
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
          security_level: string
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
          security_level?: string
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
          security_level?: string
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
      purchase_request_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          quantity: number
          request_id: string
          supply_id: string
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          quantity: number
          request_id: string
          supply_id: string
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          quantity?: number
          request_id?: string
          supply_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          id: string
          purchase_date: string
          quantity: number | null
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["purchase_status"]
          supply_id: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          purchase_date?: string
          quantity?: number | null
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["purchase_status"]
          supply_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          purchase_date?: string
          quantity?: number | null
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          supply_id?: string | null
          total_amount?: number | null
          unit_price?: number | null
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
      schedules: {
        Row: {
          contact_id: string
          created_at: string
          end_time: string
          id: string
          location: string | null
          notes: string | null
          schedule_date: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          end_time: string
          id?: string
          location?: string | null
          notes?: string | null
          schedule_date: string
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          end_time?: string
          id?: string
          location?: string | null
          notes?: string | null
          schedule_date?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_requisition_items: {
        Row: {
          created_at: string
          id: string
          quantity: number
          requisition_id: string
          supply_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity: number
          requisition_id: string
          supply_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          requisition_id?: string
          supply_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "supply_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requisition_items_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          quantity: number | null
          requisition_by: string
          requisition_date: string
          status: Database["public"]["Enums"]["requisition_status"]
          supply_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          quantity?: number | null
          requisition_by: string
          requisition_date?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          supply_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          quantity?: number | null
          requisition_by?: string
          requisition_date?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          supply_id?: string | null
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
      todo_items: {
        Row: {
          action_url: string | null
          approval_instance_id: string | null
          approval_version_number: number | null
          assignee_id: string
          business_id: string | null
          business_type: Database["public"]["Enums"]["todo_business_type"]
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          initiator_id: string | null
          priority: Database["public"]["Enums"]["todo_priority"]
          process_notes: string | null
          process_result: string | null
          processed_at: string | null
          processed_by: string | null
          source: Database["public"]["Enums"]["todo_source"]
          source_department: string | null
          source_system: string | null
          status: Database["public"]["Enums"]["todo_status"]
          title: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          approval_instance_id?: string | null
          approval_version_number?: number | null
          assignee_id: string
          business_id?: string | null
          business_type: Database["public"]["Enums"]["todo_business_type"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          initiator_id?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"]
          process_notes?: string | null
          process_result?: string | null
          processed_at?: string | null
          processed_by?: string | null
          source?: Database["public"]["Enums"]["todo_source"]
          source_department?: string | null
          source_system?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          title: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          approval_instance_id?: string | null
          approval_version_number?: number | null
          assignee_id?: string
          business_id?: string | null
          business_type?: Database["public"]["Enums"]["todo_business_type"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          initiator_id?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"]
          process_notes?: string | null
          process_result?: string | null
          processed_at?: string | null
          processed_by?: string | null
          source?: Database["public"]["Enums"]["todo_source"]
          source_department?: string | null
          source_system?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_items_approval_instance_id_fkey"
            columns: ["approval_instance_id"]
            isOneToOne: false
            referencedRelation: "approval_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "contacts"
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
      sync_contact_status: {
        Args: never
        Returns: {
          details: Json
          updated_count: number
        }[]
      }
      verify_contact_login: {
        Args: { p_mobile: string; p_password: string }
        Returns: {
          contact_department: string
          contact_id: string
          contact_mobile: string
          contact_name: string
          contact_position: string
          contact_security_level: string
          organization_name: string
        }[]
      }
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
      approval_instance_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "expired"
      approval_record_status:
        | "pending"
        | "approved"
        | "rejected"
        | "transferred"
      contact_status: "on_duty" | "out" | "leave" | "business_trip" | "meeting"
      data_scope: "self" | "department" | "organization" | "all"
      leave_type: "annual" | "sick" | "personal"
      purchase_status: "pending" | "approved" | "rejected" | "completed"
      requisition_status: "pending" | "approved" | "rejected" | "completed"
      todo_business_type:
        | "absence"
        | "supply_requisition"
        | "purchase_request"
        | "external_approval"
        | "business_trip"
      todo_priority: "urgent" | "normal" | "low"
      todo_source: "internal" | "external"
      todo_status:
        | "pending"
        | "processing"
        | "approved"
        | "rejected"
        | "cancelled"
        | "completed"
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
      approval_instance_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "expired",
      ],
      approval_record_status: [
        "pending",
        "approved",
        "rejected",
        "transferred",
      ],
      contact_status: ["on_duty", "out", "leave", "business_trip", "meeting"],
      data_scope: ["self", "department", "organization", "all"],
      leave_type: ["annual", "sick", "personal"],
      purchase_status: ["pending", "approved", "rejected", "completed"],
      requisition_status: ["pending", "approved", "rejected", "completed"],
      todo_business_type: [
        "absence",
        "supply_requisition",
        "purchase_request",
        "external_approval",
        "business_trip",
      ],
      todo_priority: ["urgent", "normal", "low"],
      todo_source: ["internal", "external"],
      todo_status: [
        "pending",
        "processing",
        "approved",
        "rejected",
        "cancelled",
        "completed",
      ],
    },
  },
} as const
