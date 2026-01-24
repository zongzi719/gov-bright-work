import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Trash2, Edit, Type } from "lucide-react";
import { fieldTypeConfig } from "./fieldConfig";
import type { FormField } from "./types";

interface FieldItemProps {
  field: FormField;
  onEdit: (field: FormField) => void;
  onDelete: (id: string) => void;
  onColSpanChange: (id: string, colSpan: number) => void;
}

const FieldItem = ({ field, onEdit, onDelete, onColSpanChange }: FieldItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const config = fieldTypeConfig[field.field_type as keyof typeof fieldTypeConfig];
  const Icon = config?.icon || Type;
  const colSpan = field.col_span || 2;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg group border border-transparent hover:border-border ${
        colSpan === 1 ? "col-span-1" : "col-span-2"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{field.field_label}</span>
          {field.is_required && (
            <Badge variant="destructive" className="text-xs shrink-0">必填</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {config?.label} · {field.field_name}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Select
          value={colSpan.toString()}
          onValueChange={(v) => onColSpanChange(field.id, parseInt(v))}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">半行</SelectItem>
            <SelectItem value="2">整行</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(field)}
        >
          <Edit className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(field.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default FieldItem;
