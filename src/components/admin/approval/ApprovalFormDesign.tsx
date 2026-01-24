import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import ControlLibrary from "./form-design/ControlLibrary";
import FormCanvas from "./form-design/FormCanvas";
import FieldEditDialog from "./form-design/FieldEditDialog";
import { fieldTypeConfig, getDefaultFieldsForBusinessType } from "./form-design/fieldConfig";
import type { FormField } from "./form-design/types";

interface ApprovalFormDesignProps {
  templateId: string;
  businessType?: string;
}

const ApprovalFormDesign = ({ templateId, businessType }: ApprovalFormDesignProps) => {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [initialFieldType, setInitialFieldType] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchFields();
  }, [templateId]);

  const fetchFields = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("approval_form_fields" as any)
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("获取表单字段失败");
      setLoading(false);
      return;
    }

    let loadedFields = (data as unknown as FormField[]) || [];

    // 如果没有字段且有业务类型，加载默认字段
    if (loadedFields.length === 0 && businessType) {
      const defaultFields = getDefaultFieldsForBusinessType(businessType);
      if (defaultFields.length > 0) {
        await initializeDefaultFields(defaultFields);
        return; // initializeDefaultFields 会调用 fetchFields
      }
    }

    setFields(loadedFields);
    setLoading(false);
  };

  const initializeDefaultFields = async (defaultFields: Omit<FormField, 'id' | 'template_id'>[]) => {
    const fieldsToInsert = defaultFields.map(field => ({
      ...field,
      template_id: templateId,
    }));

    const { error } = await supabase
      .from("approval_form_fields" as any)
      .insert(fieldsToInsert);

    if (error) {
      console.error("初始化默认字段失败:", error);
      toast.error("初始化默认字段失败");
    } else {
      toast.success("已加载预设表单字段");
    }
    
    fetchFields();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    // 从控件库拖入新字段
    if (String(active.id).startsWith("control-")) {
      const fieldType = String(active.id).replace("control-", "");
      setInitialFieldType(fieldType);
      setEditingField(null);
      setDialogOpen(true);
      return;
    }

    // 排序已有字段
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = arrayMove(fields, oldIndex, newIndex);
        setFields(newFields);

        // 更新排序到数据库
        const updates = newFields.map((field, index) => ({
          id: field.id,
          sort_order: index + 1,
        }));

        for (const update of updates) {
          await supabase
            .from("approval_form_fields" as any)
            .update({ sort_order: update.sort_order })
            .eq("id", update.id);
        }
      }
    }
  };

  const handleAddField = (type?: string) => {
    setEditingField(null);
    setInitialFieldType(type || "text");
    setDialogOpen(true);
  };

  const handleEditField = (field: FormField) => {
    setEditingField(field);
    setInitialFieldType(undefined);
    setDialogOpen(true);
  };

  const handleSaveField = async (fieldData: Partial<FormField>) => {
    if (editingField) {
      // 更新现有字段
      const { error } = await supabase
        .from("approval_form_fields" as any)
        .update({
          field_type: fieldData.field_type,
          field_label: fieldData.field_label,
          placeholder: fieldData.placeholder,
          is_required: fieldData.is_required,
          field_options: fieldData.field_options,
          col_span: fieldData.col_span,
        })
        .eq("id", editingField.id);

      if (error) {
        toast.error("更新字段失败");
        return;
      }
      toast.success("字段更新成功");
    } else {
      // 添加新字段
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.sort_order)) : 0;
      
      const { error } = await supabase
        .from("approval_form_fields" as any)
        .insert({
          template_id: templateId,
          field_type: fieldData.field_type,
          field_name: fieldData.field_name,
          field_label: fieldData.field_label,
          placeholder: fieldData.placeholder,
          is_required: fieldData.is_required,
          field_options: fieldData.field_options,
          col_span: fieldData.col_span,
          sort_order: maxOrder + 1,
        });

      if (error) {
        toast.error("添加字段失败");
        return;
      }
      toast.success("字段添加成功");
    }

    setDialogOpen(false);
    fetchFields();
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("确定要删除这个字段吗？")) return;

    const { error } = await supabase
      .from("approval_form_fields" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除字段失败");
      return;
    }
    toast.success("字段已删除");
    fetchFields();
  };

  const handleColSpanChange = async (id: string, colSpan: number) => {
    const { error } = await supabase
      .from("approval_form_fields" as any)
      .update({ col_span: colSpan })
      .eq("id", id);

    if (error) {
      toast.error("更新失败");
      return;
    }
    
    setFields(fields.map(f => f.id === id ? { ...f, col_span: colSpan } : f));
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-6">
          <ControlLibrary onAddField={handleAddField} />
          <FormCanvas
            fields={fields}
            onAddField={() => handleAddField()}
            onEditField={handleEditField}
            onDeleteField={handleDeleteField}
            onColSpanChange={handleColSpanChange}
          />
        </div>

        <DragOverlay>
          {activeId && activeId.startsWith("control-") && (
            <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-background shadow-lg">
              {(() => {
                const type = activeId.replace("control-", "");
                const config = fieldTypeConfig[type as keyof typeof fieldTypeConfig];
                if (config) {
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{config.label}</span>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <FieldEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={editingField}
        initialType={initialFieldType}
        onSave={handleSaveField}
      />
    </div>
  );
};

export default ApprovalFormDesign;
