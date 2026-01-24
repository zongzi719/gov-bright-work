export interface FormField {
  id: string;
  template_id: string;
  field_type: string;
  field_name: string;
  field_label: string;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  field_options: string[] | null;
  col_span?: number; // 1 or 2 (半行或整行)
}

export interface FieldTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
}

export interface BusinessFormConfig {
  business_type: string;
  defaultFields: Omit<FormField, 'id' | 'template_id'>[];
}
