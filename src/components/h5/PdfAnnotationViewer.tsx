import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Eraser, Save, Upload, FileText, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// 配置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  pageNumber: number; // 批注所在的页码
}

interface PdfAnnotationViewerProps {
  storageKey: string;
  title?: string;
}

const PdfAnnotationViewer = ({ storageKey, title }: PdfAnnotationViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [pathsByPage, setPathsByPage] = useState<Record<number, DrawPath[]>>({});

  // 默认PDF文件路径
  const defaultPdfUrl = "/documents/default-document.pdf";
  const defaultPdfName = "关于印发《2025年度党风廉政建设工作要点》的通知.pdf";

  // 从localStorage加载保存的批注和PDF信息
  useEffect(() => {
    const savedPaths = localStorage.getItem(`${storageKey}_paths_v2`);
    const savedPdf = localStorage.getItem(`${storageKey}_pdf`);
    const savedPdfName = localStorage.getItem(`${storageKey}_pdf_name`);
    
    if (savedPaths) {
      try {
        setPathsByPage(JSON.parse(savedPaths));
      } catch {
        // ignore
      }
    }
    
    if (savedPdf) {
      setPdfUrl(savedPdf);
      setPdfFileName(savedPdfName || defaultPdfName);
    } else {
      setPdfUrl(defaultPdfUrl);
      setPdfFileName(defaultPdfName);
    }
  }, [storageKey]);

  const handleSave = () => {
    localStorage.setItem(`${storageKey}_paths_v2`, JSON.stringify(pathsByPage));
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
      setPathsByPage({});
      toast.success(`已加载: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
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
          <span>上传</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={!pdfUrl || scale <= 0.5}
            className={cn(
              "p-1 rounded text-xs transition-colors",
              !pdfUrl || scale <= 0.5
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={!pdfUrl || scale >= 3.0}
            className={cn(
              "p-1 rounded text-xs transition-colors",
              !pdfUrl || scale >= 3.0
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

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
        className="flex-1 relative overflow-auto bg-slate-200"
      >
        {!pdfUrl ? (
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
          <div className="flex flex-col items-center py-4">
            {/* PDF文件信息 */}
            <div className="sticky top-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm mb-4">
              {pdfFileName || "PDF文件"} - {numPages} 页
            </div>
            
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
                </div>
              }
              error={
                <div className="text-red-500 p-4 text-center">
                  PDF加载失败，请重新上传
                </div>
              }
            >
              {Array.from(new Array(numPages), (_, index) => (
                <PdfPageWithAnnotation
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  scale={scale}
                  activeTool={activeTool}
                  paths={pathsByPage[index + 1] || []}
                  onPathsChange={(newPaths) => {
                    setPathsByPage(prev => ({
                      ...prev,
                      [index + 1]: newPaths
                    }));
                  }}
                />
              ))}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
};

// 单页PDF + 批注组件
interface PdfPageWithAnnotationProps {
  pageNumber: number;
  scale: number;
  activeTool: ToolType;
  paths: DrawPath[];
  onPathsChange: (paths: DrawPath[]) => void;
}

const PdfPageWithAnnotation = ({
  pageNumber,
  scale,
  activeTool,
  paths,
  onPathsChange,
}: PdfPageWithAnnotationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // 重绘Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || pageSize.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 设置canvas实际大小
    canvas.width = pageSize.width * scale;
    canvas.height = pageSize.height * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 使用临时canvas来处理橡皮擦逻辑
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // 第一遍：绘制所有铅笔笔迹（应用缩放）
    paths.forEach((path) => {
      if (path.points.length < 2 || path.tool !== "pencil") return;
      
      tempCtx.beginPath();
      tempCtx.globalCompositeOperation = "source-over";
      tempCtx.strokeStyle = path.color;
      tempCtx.lineWidth = path.lineWidth * scale;
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      tempCtx.moveTo(path.points[0].x * scale, path.points[0].y * scale);
      for (let i = 1; i < path.points.length; i++) {
        tempCtx.lineTo(path.points[i].x * scale, path.points[i].y * scale);
      }
      tempCtx.stroke();
    });

    // 第二遍：用橡皮擦除
    paths.forEach((path) => {
      if (path.points.length < 2 || path.tool !== "eraser") return;
      
      tempCtx.beginPath();
      tempCtx.globalCompositeOperation = "destination-out";
      tempCtx.lineWidth = path.lineWidth * scale;
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      tempCtx.moveTo(path.points[0].x * scale, path.points[0].y * scale);
      for (let i = 1; i < path.points.length; i++) {
        tempCtx.lineTo(path.points[i].x * scale, path.points[i].y * scale);
      }
      tempCtx.stroke();
    });

    ctx.drawImage(tempCanvas, 0, 0);
  }, [paths, scale, pageSize]);

  useEffect(() => {
    redrawCanvas();
  }, [paths, scale, pageSize, redrawCanvas]);

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      // 存储的是相对于原始PDF尺寸的坐标
      return {
        x: (touch.clientX - rect.left) / scale,
        y: (touch.clientY - rect.top) / scale,
      };
    } else {
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
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

    // 实时绘制预览
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeTool === "pencil" && newPath.length >= 2) {
      const lastIndex = newPath.length - 1;
      ctx.beginPath();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(newPath[lastIndex - 1].x * scale, newPath[lastIndex - 1].y * scale);
      ctx.lineTo(newPath[lastIndex].x * scale, newPath[lastIndex].y * scale);
      ctx.stroke();
    } else if (activeTool === "eraser" && newPath.length >= 2) {
      // 橡皮擦预览
      redrawCanvas();
      ctx.beginPath();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 20 * scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(newPath[0].x * scale, newPath[0].y * scale);
      for (let i = 1; i < newPath.length; i++) {
        ctx.lineTo(newPath[i].x * scale, newPath[i].y * scale);
      }
      ctx.stroke();
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
          pageNumber,
        },
      ];
      onPathsChange(newPaths);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  const onPageLoadSuccess = (page: { width: number; height: number }) => {
    setPageSize({ width: page.width, height: page.height });
  };

  return (
    <div className="relative mb-4 shadow-lg bg-white">
      <Page
        pageNumber={pageNumber}
        scale={scale}
        onLoadSuccess={onPageLoadSuccess}
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute top-0 left-0",
          activeTool ? "cursor-crosshair" : "pointer-events-none"
        )}
        style={{
          width: pageSize.width * scale,
          height: pageSize.height * scale,
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        第 {pageNumber} 页
      </div>
    </div>
  );
};

export default PdfAnnotationViewer;
