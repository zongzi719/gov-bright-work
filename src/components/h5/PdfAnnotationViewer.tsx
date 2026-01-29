import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Eraser, Save, Upload, FileText } from "lucide-react";
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

interface PdfAnnotationViewerProps {
  storageKey: string;
  title?: string;
}

const PdfAnnotationViewer = ({ storageKey, title }: PdfAnnotationViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);

  // 默认PDF文件路径
  const defaultPdfUrl = "/documents/default-document.pdf";
  const defaultPdfName = "关于印发《2025年度党风廉政建设工作要点》的通知.pdf";

  // 从localStorage加载保存的批注和PDF信息
  useEffect(() => {
    const savedPaths = localStorage.getItem(`${storageKey}_paths`);
    const savedPdf = localStorage.getItem(`${storageKey}_pdf`);
    const savedPdfName = localStorage.getItem(`${storageKey}_pdf_name`);
    
    if (savedPaths) {
      try {
        setPaths(JSON.parse(savedPaths));
      } catch {
        // ignore
      }
    }
    
    // 如果有保存的PDF则使用保存的，否则使用默认PDF
    if (savedPdf) {
      setPdfUrl(savedPdf);
      setPdfFileName(savedPdfName || defaultPdfName);
    } else {
      // 使用默认PDF
      setPdfUrl(defaultPdfUrl);
      setPdfFileName(defaultPdfName);
    }
  }, [storageKey]);

  // Resize canvas
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(rect.height, 500);
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [pdfUrl]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布（保持透明，让PDF内容可见）
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 分两步渲染：先画所有铅笔笔迹到临时canvas，再用橡皮擦除
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // 第一遍：绘制所有铅笔笔迹
    paths.forEach((path) => {
      if (path.points.length < 2 || path.tool !== "pencil") return;
      
      tempCtx.beginPath();
      tempCtx.globalCompositeOperation = "source-over";
      tempCtx.strokeStyle = path.color;
      tempCtx.lineWidth = path.lineWidth;
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      tempCtx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        tempCtx.lineTo(path.points[i].x, path.points[i].y);
      }
      tempCtx.stroke();
    });

    // 第二遍：用橡皮擦除笔迹（只擦除临时canvas上的内容）
    paths.forEach((path) => {
      if (path.points.length < 2 || path.tool !== "eraser") return;
      
      tempCtx.beginPath();
      tempCtx.globalCompositeOperation = "destination-out";
      tempCtx.lineWidth = path.lineWidth;
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      tempCtx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        tempCtx.lineTo(path.points[i].x, path.points[i].y);
      }
      tempCtx.stroke();
    });

    // 将临时canvas内容复制到主canvas
    ctx.drawImage(tempCanvas, 0, 0);
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
    if (!activeTool || !pdfUrl) return;
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

    if (newPath.length >= 2) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (activeTool === "pencil") {
        // 铅笔：直接在主canvas上绘制
        ctx.beginPath();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const lastIndex = newPath.length - 1;
        ctx.moveTo(newPath[lastIndex - 1].x, newPath[lastIndex - 1].y);
        ctx.lineTo(newPath[lastIndex].x, newPath[lastIndex].y);
        ctx.stroke();
      } else if (activeTool === "eraser") {
        // 橡皮擦：重绘整个canvas以正确显示擦除效果
        // 创建一个包含当前绘制路径的临时paths数组
        const tempPaths = [
          ...paths,
          {
            points: newPath,
            tool: "eraser" as const,
            color: "#ff0000",
            lineWidth: 20,
          },
        ];
        
        // 重绘canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;

        // 绘制所有铅笔笔迹
        tempPaths.forEach((path) => {
          if (path.points.length < 2 || path.tool !== "pencil") return;
          
          tempCtx.beginPath();
          tempCtx.globalCompositeOperation = "source-over";
          tempCtx.strokeStyle = path.color;
          tempCtx.lineWidth = path.lineWidth;
          tempCtx.lineCap = "round";
          tempCtx.lineJoin = "round";

          tempCtx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            tempCtx.lineTo(path.points[i].x, path.points[i].y);
          }
          tempCtx.stroke();
        });

        // 应用所有橡皮擦
        tempPaths.forEach((path) => {
          if (path.points.length < 2 || path.tool !== "eraser") return;
          
          tempCtx.beginPath();
          tempCtx.globalCompositeOperation = "destination-out";
          tempCtx.lineWidth = path.lineWidth;
          tempCtx.lineCap = "round";
          tempCtx.lineJoin = "round";

          tempCtx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            tempCtx.lineTo(path.points[i].x, path.points[i].y);
          }
          tempCtx.stroke();
        });

        ctx.drawImage(tempCanvas, 0, 0);
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !activeTool) return;

    if (currentPath.length > 1) {
      const newPaths = [
        ...paths,
        {
          points: currentPath,
          tool: activeTool,
          color: "#ff0000",
          lineWidth: activeTool === "eraser" ? 20 : 2,
        },
      ];
      setPaths(newPaths);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleSave = () => {
    localStorage.setItem(`${storageKey}_paths`, JSON.stringify(paths));
    if (pdfUrl) {
      localStorage.setItem(`${storageKey}_pdf`, pdfUrl);
    }
    if (pdfFileName) {
      localStorage.setItem(`${storageKey}_pdf_name`, pdfFileName);
    }
    toast.success("批注已保存");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("请上传PDF文件");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPdfUrl(result);
      setPdfFileName(file.name);
      // 清除旧批注
      setPaths([]);
      toast.success(`已加载: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const tools = [
    { id: "pencil" as ToolType, label: "铅笔", icon: Pencil },
    { id: "eraser" as ToolType, label: "橡皮", icon: Eraser },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 shrink-0">
        <button
          onClick={triggerFileUpload}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>上传PDF</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex items-center gap-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              disabled={!pdfUrl}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                !pdfUrl 
                  ? "text-slate-300 cursor-not-allowed"
                  : activeTool === tool.id
                    ? "text-red-500 bg-red-50"
                    : "text-slate-500 hover:text-slate-700"
              )}
            >
              <tool.icon className="w-4 h-4" />
              <span>{tool.label}</span>
            </button>
          ))}
          <button
            onClick={handleSave}
            disabled={!pdfUrl}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
              !pdfUrl 
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Save className="w-4 h-4" />
            <span>保存</span>
          </button>
        </div>
      </div>

      {/* PDF预览区域 */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-slate-100"
      >
        {!pdfUrl ? (
          /* 未上传PDF时的提示界面 */
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 mb-4 text-center">
              请上传PDF文件进行批注
            </p>
            <button
              onClick={triggerFileUpload}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              选择PDF文件
            </button>
          </div>
        ) : (
          /* PDF预览 + 批注层 */
          <>
            {/* PDF文件信息 */}
            <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-600 shadow-sm">
              {pdfFileName || "PDF文件"}
            </div>
            
            {/* PDF embed - 使用embed替代iframe以避免Chrome屏蔽 */}
            <embed
              src={pdfUrl}
              type="application/pdf"
              className="w-full h-full min-h-[500px]"
            />

            {/* 批注Canvas覆盖层 */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default PdfAnnotationViewer;
