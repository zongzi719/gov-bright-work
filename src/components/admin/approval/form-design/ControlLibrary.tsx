import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldTypeConfig } from "./fieldConfig";

interface DraggableControlProps {
  type: string;
  config: { icon: React.ComponentType<{ className?: string }>; label: string };
  onClick: () => void;
}

const DraggableControl = ({ type, config, onClick }: DraggableControlProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `control-${type}`,
    data: { type, isNew: true },
  });

  const Icon = config.icon;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-grab active:cursor-grabbing transition-colors hover:bg-muted/50 hover:border-primary ${
        isDragging ? "opacity-50 border-primary bg-muted" : ""
      }`}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm">{config.label}</span>
    </div>
  );
};

interface ControlLibraryProps {
  onAddField: (type: string) => void;
}

const ControlLibrary = ({ onAddField }: ControlLibraryProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">控件库</CardTitle>
        <CardDescription>拖拽或点击添加到表单</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(fieldTypeConfig).map(([type, config]) => (
          <DraggableControl
            key={type}
            type={type}
            config={config}
            onClick={() => onAddField(type)}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default ControlLibrary;
