import { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, Eraser, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ToolType = "pencil" | "eraser" | null;

interface Point {
  x: number;
  y: number;
}

interface DrawPath {
  points: Point[];
  tool: "pencil" | "eraser";
  color: string;
  lineWidth: number;
}

const DocumentContentViewer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  // Mock document content
  const documentContent = `无人驾驶航空器飞行管理暂行条例 国务院文件 中国政府网

大型。

第三条　无人驾驶航空器飞行管理工作应当坚持和加强党的领导，坚持总体国家安全观，坚持安全第一、服务发展、分类管理、协同监管的原则。

第四条　国家空中交通管理领导机构统一领导全国无人驾驶航空器飞行管理工作，组织协调解决无人驾驶航空器管理工作中的重大问题。

国务院民用航空、公安、工业和信息化、市场监督管理等部门按照职责分工负责全国无人驾驶航空器有关管理工作。

县级以上地方人民政府及其有关部门按照职责分工负责本行政区域内无人驾驶航空器有关管理工作。

各级空中交通管理机构按照职责分工负责本责任区内无人驾驶航空器飞行管理工作。

第五条　国家鼓励无人驾驶航空器科研创新及其成果的推广应用，促进无人驾驶航空器与大数据、人工智能等新技术融合创新。县级以上人民政府及其有关部门应当为无人驾驶航空器科研创新及其成果的推广应用提供支持。

国家在确保安全的前提下积极创新空域供给和使用机制，完善无人驾驶航空器飞行配套基础设施和服务体系。

第六条　无人驾驶航空器有关行业协会应当通过制定、实施团体标准等方式加强行业自律，宣传无人驾驶航空器管理法律法规及有关知识，增强有关单位和人员依法开展无人驾驶航空器飞行以及有关活动的意识。`;

  // Resize canvas to match container
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Redraw all paths
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    paths.forEach((path) => {
      if (path.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = path.tool === "eraser" ? "#ffffff" : path.color;
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  }, [paths]);

  useEffect(() => {
    redrawCanvas();
  }, [paths, redrawCanvas]);

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    if (!activeTool) return;
    e.preventDefault();
    
    const point = getCoordinates(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentPath([point]);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || !activeTool) return;
    e.preventDefault();

    const point = getCoordinates(e);
    if (!point) return;

    const newPath = [...currentPath, point];
    setCurrentPath(newPath);

    // Draw current stroke
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (newPath.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = activeTool === "eraser" ? "#ffffff" : "#ff0000";
      ctx.lineWidth = activeTool === "eraser" ? 20 : 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const lastIndex = newPath.length - 1;
      ctx.moveTo(newPath[lastIndex - 1].x, newPath[lastIndex - 1].y);
      ctx.lineTo(newPath[lastIndex].x, newPath[lastIndex].y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !activeTool) return;

    if (currentPath.length > 1) {
      setPaths([
        ...paths,
        {
          points: currentPath,
          tool: activeTool,
          color: "#ff0000",
          lineWidth: activeTool === "eraser" ? 20 : 2,
        },
      ]);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleSave = () => {
    toast.success("批注已保存");
  };

  const tools = [
    { id: "pencil" as ToolType, label: "铅笔", icon: Pencil },
    { id: "eraser" as ToolType, label: "橡皮擦", icon: Eraser },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-4 px-4 py-2 border-b bg-muted/30">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded transition-colors",
              activeTool === tool.id
                ? "text-red-500 bg-red-50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tool.icon className="w-5 h-5" />
            <span className="text-xs">{tool.label}</span>
          </button>
        ))}
        <button
          onClick={handleSave}
          className="flex flex-col items-center gap-1 p-2 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <Save className="w-5 h-5" />
          <span className="text-xs">保存</span>
        </button>
      </div>

      {/* Document Content with Canvas Overlay */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-white"
      >
        {/* Document Text Layer */}
        <div className="p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap select-none">
          <div className="text-xs text-muted-foreground mb-4 border-b pb-2">
            无人驾驶航空器飞行管理暂行条例 国务院文件 中国政府网 &nbsp;&nbsp;&nbsp;&nbsp; https://www.gov.cn/...
          </div>
          {documentContent.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-4 text-justify indent-8">
              {paragraph}
            </p>
          ))}
          <div className="text-xs text-muted-foreground mt-8 pt-2 border-t flex justify-between">
            <span>第3页 共24页</span>
            <span>2024/1/9 13:31</span>
          </div>
        </div>

        {/* Canvas Drawing Layer */}
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 w-full h-full",
            activeTool ? "cursor-crosshair" : "pointer-events-none"
          )}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default DocumentContentViewer;
