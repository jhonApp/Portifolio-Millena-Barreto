
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alternatives": {
                  Row: {
                    "id": string,"position": number,"question_id": string,"style": string,"text": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"position": number,"question_id": string,"style": string,"text": string,"weight"?: number
                  }
                  Update: {
                    "id"?: string,"position"?: number,"question_id"?: string,"style"?: string,"text"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "alternatives_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"answers": {
                  Row: {
                    "alternative_id": string,"answered_at": string,"attempt_id": string,"id": string,"question_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alternative_id": string,"answered_at"?: string,"attempt_id": string,"id"?: string,"question_id": string,"version_id": string
                  }
                  Update: {
                    "alternative_id"?: string,"answered_at"?: string,"attempt_id"?: string,"id"?: string,"question_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_alternative_id_fkey"
      columns: ["alternative_id"]
isOneToOne: false
      referencedRelation: "alternatives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "purchase_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "questionnaire_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_errors": {
                  Row: {
                    "context": Json | null,"created_at": string,"id": string,"message": string,"order_id": string | null,"resolved_at": string | null,"step": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: Json | null,"created_at"?: string,"id"?: string,"message": string,"order_id"?: string | null,"resolved_at"?: string | null,"step": string
                  }
                  Update: {
                    "context"?: Json | null,"created_at"?: string,"id"?: string,"message"?: string,"order_id"?: string | null,"resolved_at"?: string | null,"step"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_errors_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_records": {
                  Row: {
                    "accepted_at": string,"attempt_id": string,"consent_text": string,"consent_text_version": string,"created_at": string,"customer_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"attempt_id": string,"consent_text": string,"consent_text_version": string,"created_at"?: string,"customer_id": string,"id"?: string
                  }
                  Update: {
                    "accepted_at"?: string,"attempt_id"?: string,"consent_text"?: string,"consent_text_version"?: string,"created_at"?: string,"customer_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_records_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: true
      referencedRelation: "purchase_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_records_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"content_templates": {
                  Row: {
                    "block": string | null,"body": string,"created_at": string,"id": string,"kind": string,"position": number,"secondary_style": string | null,"style": string | null,"updated_at": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block"?: string | null,"body": string,"created_at"?: string,"id"?: string,"kind": string,"position"?: number,"secondary_style"?: string | null,"style"?: string | null,"updated_at"?: string,"version_id": string
                  }
                  Update: {
                    "block"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"position"?: number,"secondary_style"?: string | null,"style"?: string | null,"updated_at"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_templates_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"content_versions": {
                  Row: {
                    "created_at": string,"id": string,"published_at": string | null,"status": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"published_at"?: string | null,"status": string,"updated_at"?: string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"published_at"?: string | null,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"name": string,"updated_at": string,"whatsapp": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"name": string,"updated_at"?: string,"whatsapp": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"whatsapp"?: string
                  }
                  Relationships: [
                    
                  ]
                },"deletion_requests": {
                  Row: {
                    "completed_at": string | null,"confirmed_at": string | null,"created_at": string,"email": string | null,"expires_at": string,"id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at": string,"id"?: string,"token_hash": string
                  }
                  Update: {
                    "completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"deliveries": {
                  Row: {
                    "attempts": number,"channel": string,"created_at": string,"id": string,"last_error": string | null,"marked_by": string | null,"next_attempt_at": string | null,"order_id": string,"sent_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": string,"created_at"?: string,"id"?: string,"last_error"?: string | null,"marked_by"?: string | null,"next_attempt_at"?: string | null,"order_id": string,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"id"?: string,"last_error"?: string | null,"marked_by"?: string | null,"next_attempt_at"?: string | null,"order_id"?: string,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deliveries_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_cents": number,"approved_at": string | null,"attempt_id": string,"created_at": string,"delivered_at": string | null,"failure_reason": string | null,"id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"approved_at"?: string | null,"attempt_id": string,"created_at"?: string,"delivered_at"?: string | null,"failure_reason"?: string | null,"id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"approved_at"?: string | null,"attempt_id"?: string,"created_at"?: string,"delivered_at"?: string | null,"failure_reason"?: string | null,"id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "purchase_attempts"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"expires_at": string,"id": string,"order_id": string,"paid_at": string | null,"pix_br_code": string | null,"pix_qr_image": string | null,"provider": string,"provider_charge_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"expires_at": string,"id"?: string,"order_id": string,"paid_at"?: string | null,"pix_br_code"?: string | null,"pix_qr_image"?: string | null,"provider"?: string,"provider_charge_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"expires_at"?: string,"id"?: string,"order_id"?: string,"paid_at"?: string | null,"pix_br_code"?: string | null,"pix_qr_image"?: string | null,"provider"?: string,"provider_charge_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_attempts": {
                  Row: {
                    "created_at": string,"customer_id": string,"delivery_preference": string,"expires_at": string,"id": string,"ip_hash": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"delivery_preference": string,"expires_at"?: string,"id"?: string,"ip_hash"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"delivery_preference"?: string,"expires_at"?: string,"id"?: string,"ip_hash"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_attempts_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"questionnaire_versions": {
                  Row: {
                    "created_at": string,"id": string,"published_at": string | null,"status": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"published_at"?: string | null,"status": string,"updated_at"?: string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"published_at"?: string | null,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"questions": {
                  Row: {
                    "id": string,"position": number,"text": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"position": number,"text": string,"version_id": string
                  }
                  Update: {
                    "id"?: string,"position"?: number,"text"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "questionnaire_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"result_tokens": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"order_id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"order_id": string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"order_id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_tokens_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"results": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"id": string,"order_id": string,"pdf_path": string | null,"points": NonNullable<Json>,"predominant_style": string,"secondary_style": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"id"?: string,"order_id": string,"pdf_path"?: string | null,"points": NonNullable<Json>,"predominant_style": string,"secondary_style": string,"version_id": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"order_id"?: string,"pdf_path"?: string | null,"points"?: NonNullable<Json>,"predominant_style"?: string,"secondary_style"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "results_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "questionnaire_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "event_id": string,"event_type": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"event_type": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
