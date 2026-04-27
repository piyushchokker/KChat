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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          ret_session_id: string | null
          roll_number: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          ret_session_id?: string | null
          roll_number?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          ret_session_id?: string | null
          roll_number?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          academic_level: string[] | null
          // removed academic_year
          // removed allow_ai_usage
          applicable_to: string[] | null
          // removed change_summary
          chunk_count: number | null
          course: string | null
          created_at: string
          document_type: string
          effective_from: string
          effective_till: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          issuing_authority: string
          keywords: string[] | null
          // removed library_type
          processing_message: string | null
          // removed regulation
          school: string | null
          semester: string | null
          storage_path: string
          // removed student_intent_mapping
          title: string
          updated_at: string
          uploaded_by: string | null
          // removed version
          // removed visibility
        }
        Insert: {
          academic_level?: string[] | null
          // removed academic_year
          // removed allow_ai_usage
          applicable_to?: string[] | null
          // removed change_summary
          chunk_count?: number | null
          course?: string | null
          created_at?: string
          document_type: string
          effective_from: string
          effective_till: string
          file_name: string
          file_size?: number
          file_url: string
          id?: string
          issuing_authority: string
          keywords?: string[] | null
          // removed library_type
          processing_message?: string | null
          // removed regulation
          school?: string | null
          semester?: string | null
          storage_path: string
          // removed student_intent_mapping
          title: string
          updated_at?: string
          uploaded_by?: string | null
          // removed version
          // removed visibility
        }
        Update: {
          academic_level?: string[] | null
          // removed academic_year
          // removed allow_ai_usage
          applicable_to?: string[] | null
          // removed change_summary
          chunk_count?: number | null
          course?: string | null
          created_at?: string
          document_type?: string
          effective_from?: string
          effective_till?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          issuing_authority?: string
          keywords?: string[] | null
          // removed library_type
          processing_message?: string | null
          // removed regulation
          school?: string | null
          semester?: string | null
          storage_path?: string
          // removed student_intent_mapping
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          // removed version
          // removed visibility
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_metadata_types: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_metadata_schools: {
        Row: {
          course_key: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          course_key: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          course_key?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_metadata_courses: {
        Row: {
          academic_level: string
          course_code: string
          created_at: string
          id: string
          max_semesters: number | null
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_level: string
          course_code: string
          created_at?: string
          id?: string
          max_semesters?: number | null
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_level?: string
          course_code?: string
          created_at?: string
          id?: string
          max_semesters?: number | null
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_metadata_courses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "document_metadata_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      file_job: {
        Row: {
          id: string
          status: string
          retries: number
        }
        Insert: {
          id: string
          status?: string
          retries?: number
        }
        Update: {
          id?: string
          status?: string
          retries?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          confidence: number | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sources: Json | null
        }
        Insert: {
          confidence?: number | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
        }
        Update: {
          confidence?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      resolved_knowledge: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          ticket_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          ticket_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolved_knowledge_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          confidence_score: number | null
          conversation_id: string | null
          created_at: string
          id: string
          priority: string
          query: string
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          priority?: string
          query: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          priority?: string
          query?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profile_cache: {
        Row: {
          auth_id: string
          course: string | null
          created_at: string
          department: string | null
          id: string
          raw_details: Json
          roll_number: string
          school: string | null
          student_email: string | null
          student_name: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_id: string
          course?: string | null
          created_at?: string
          department?: string | null
          id?: string
          raw_details?: Json
          roll_number: string
          school?: string | null
          student_email?: string | null
          student_name?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_id?: string
          course?: string | null
          created_at?: string
          department?: string | null
          id?: string
          raw_details?: Json
          roll_number?: string
          school?: string | null
          student_email?: string | null
          student_name?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profile_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }

      users: {
        Row: {
          auth_id: string
          course: string | null
          created_at: string
          department: string | null
          designation: string | null
          email: string
          id: string
          image_url: string | null
          is_allowed: boolean
          name: string
          program: string | null
          role: string
          roll_number: string | null
          school: string | null
          updated_at: string
        }
        Insert: {
          auth_id: string
          course?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email: string
          id?: string
          image_url?: string | null
          is_allowed?: boolean
          name: string
          program?: string | null
          role: string
          roll_number?: string | null
          school?: string | null
          updated_at?: string
        }
        Update: {
          auth_id?: string
          course?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string
          id?: string
          image_url?: string | null
          is_allowed?: boolean
          name?: string
          program?: string | null
          role?: string
          roll_number?: string | null
          school?: string | null
          updated_at?: string
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
