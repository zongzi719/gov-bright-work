import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import FieldItem from "./FieldItem";
import type { FormField } from "./types";

interface FormCanvasProps {
  fields: FormField[];
  onAddField: () => void;
  onEditField: (field: FormField) => void;
  onDeleteField: (id: string) => void;
  onColSpanChange: (id: string, colSpan: number) => void;
}

const FormCanvas = ({ 
  fields, 
  onAddField, 
  onEditField, 
  onDeleteField, 
  onColSpanChange 
}: FormCanvasProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "form-canvas",
  });

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">表单布局</CardTitle>
            <CardDescription>拖拽调整顺序，点击编辑字段</CardDescription>
          </div>
          <Button size="sm" onClick={onAddField}>
            <Plus className="w-4 h-4 mr-1" />
            添加字段
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={setNodeRef}
          className={`min-h-[200px] rounded-lg transition-colors ${
            isOver ? "bg-primary/5 border-2 border-dashed border-primary" : ""
          }`}
        >
          {fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="mb-2">暂无表单字段</p>
              <p className="text-sm">从左侧控件库拖拽或点击添加</p>
            </div>
          ) : (
            <SortableContext
              items={fields.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-2">
                {fields.map((field) => (
                  <FieldItem
                    key={field.id}
                    field={field}
                    onEdit={onEditField}
                    onDelete={onDeleteField}
                    onColSpanChange={onColSpanChange}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FormCanvas;
