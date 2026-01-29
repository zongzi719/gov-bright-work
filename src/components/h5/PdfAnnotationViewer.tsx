import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Eraser, Save, Upload, FileText, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from "lucide-react";
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
  pageNumber: number;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 双指缩放状态
  const [isPinching, setIsPinching] = useState(false);
  const lastPinchDistance = useRef<number>(0);
  const pinchStartScale = useRef<number>(1);

  const defaultPdfUrl = "/documents/default-document.pdf";
  const defaultPdfName = "关于印发《2025年度党风廉政建设工作要点》的通知.pdf";

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

  // 双指缩放处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && !activeTool) {
      setIsPinching(true);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartScale.current = scale;
    }
  }, [activeTool, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching && !activeTool) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (lastPinchDistance.current > 0) {
        const pinchScale = distance / lastPinchDistance.current;
        const newScale = Math.min(Math.max(pinchStartScale.current * pinchScale, 0.5), 3.0);
        setScale(newScale);
      }
    }
  }, [isPinching, activeTool]);

  const handleTouchEnd = useCallback(() => {
    setIsPinching(false);
  }, []);

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
      setScale(1.0);
      setCurrentPage(1);
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
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const tools = [
    { id: "pencil" as ToolType, label: "铅笔", icon: Pencil },
    { id: "eraser" as ToolType, label: "橡皮", icon: Eraser },
  ];

  // 快速缩放预设
  const zoomPresets = [
    { label: "50%", value: 0.5 },
    { label: "100%", value: 1.0 },
    { label: "150%", value: 1.5 },
    { label: "200%", value: 2.0 },
  ];

  return (
    <div className={cn(
      "flex flex-col bg-white transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50" : "h-full"
    )}>
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-slate-50 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={triggerFileUpload}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>上传</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              disabled={!pdfUrl}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors",
                !pdfUrl 
                  ? "text-slate-300 cursor-not-allowed"
                  : activeTool === tool.id
                    ? "text-red-500 bg-red-50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              <tool.icon className="w-3.5 h-3.5" />
              <span>{tool.label}</span>
            </button>
          ))}
          <button
            onClick={handleSave}
            disabled={!pdfUrl}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors",
              !pdfUrl 
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存</span>
          </button>
        </div>
      </div>

      {/* 缩放控制栏 */}
      {pdfUrl && (
        <div className="flex items-center justify-between px-2 py-1 border-b bg-white shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className={cn(
                "p-1 rounded transition-colors",
                scale <= 0.5
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {zoomPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setScale(preset.value)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                    Math.abs(scale - preset.value) < 0.1
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className={cn(
                "p-1 rounded transition-colors",
                scale >= 3.0
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleResetZoom}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="text-[10px] text-slate-500">
            {currentPage}/{numPages} 页 · {Math.round(scale * 100)}%
          </div>
        </div>
      )}

      {/* 批注工具激活提示 */}
      {activeTool && (
        <div className="flex items-center justify-center gap-2 px-2 py-1 bg-amber-50 border-b border-amber-200 shrink-0">
          <span className="text-[10px] text-amber-700">
            {activeTool === "pencil" ? "铅笔模式：单指绘制批注" : "橡皮模式：单指擦除批注"}
          </span>
          <button
            onClick={() => setActiveTool(null)}
            className="text-[10px] text-amber-600 underline"
          >
            退出
          </button>
        </div>
      )}

      {/* PDF预览区域 */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-slate-200 touch-pan-x touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain"
        }}
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
          <div className="flex flex-col items-center py-2 min-w-min">
            {/* PDF文件信息悬浮 */}
            <div className="sticky top-1 z-10 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] text-white shadow-sm mb-2">
              {pdfFileName || "PDF文件"}
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
                  onPageVisible={() => setCurrentPage(index + 1)}
                />
              ))}
            </Document>
            
            {/* 底部提示 */}
            {!activeTool && (
              <div className="text-[10px] text-slate-400 py-2">
                双指缩放 · 单指滑动
              </div>
            )}
          </div>
        )}
      </div>

      {/* 快捷页码导航（全屏模式下显示） */}
      {isFullscreen && numPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-white border-t shrink-0">
          <button
            onClick={() => {
              const container = containerRef.current;
              if (container) container.scrollTop = 0;
              setCurrentPage(1);
            }}
            disabled={currentPage <= 1}
            className={cn(
              "px-3 py-1 rounded text-xs",
              currentPage <= 1 ? "text-slate-300" : "text-slate-600 bg-slate-100"
            )}
          >
            首页
          </button>
          <span className="text-xs text-slate-500">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => {
              const container = containerRef.current;
              if (container) container.scrollTop = container.scrollHeight;
              setCurrentPage(numPages);
            }}
            disabled={currentPage >= numPages}
            className={cn(
              "px-3 py-1 rounded text-xs",
              currentPage >= numPages ? "text-slate-300" : "text-slate-600 bg-slate-100"
            )}
          >
            末页
          </button>
        </div>
      )}
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
  onPageVisible?: () => void;
}

const PdfPageWithAnnotation = ({
  pageNumber,
  scale,
  activeTool,
  paths,
  onPathsChange,
  onPageVisible,
}: PdfPageWithAnnotationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // 页面可见性检测
  useEffect(() => {
    if (!containerRef.current || !onPageVisible) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            onPageVisible();
          }
        });
      },
      { threshold: 0.5 }
    );
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [onPageVisible]);

  // 重绘Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || pageSize.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = pageSize.width * scale;
    canvas.height = pageSize.height * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

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
      // 只处理单指触摸用于绘制
      if (e.touches.length !== 1) return null;
      const touch = e.touches[0];
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
    
    // 多指触摸时不绘制
    if ("touches" in e && e.touches.length !== 1) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const point = getCoordinates(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentPath([point]);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || !activeTool) return;
    
    // 多指触摸时停止绘制
    if ("touches" in e && e.touches.length !== 1) {
      stopDrawing();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    const point = getCoordinates(e);
    if (!point) return;

    const newPath = [...currentPath, point];
    setCurrentPath(newPath);

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
    <div ref={containerRef} className="relative mb-2 shadow-lg bg-white">
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
          touchAction: activeTool ? "none" : "auto",
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
        {pageNumber}
      </div>
    </div>
  );
};

export default PdfAnnotationViewer;
