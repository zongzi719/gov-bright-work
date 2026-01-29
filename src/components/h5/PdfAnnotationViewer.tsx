import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Eraser, Save, Upload, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb } from "pdf-lib";

// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

type ToolType = "pencil" | "eraser" | null;

interface Point {
  x: number;
  y: number;
}

interface InkAnnotation {
  pageIndex: number;
  paths: Point[][]; // PDF坐标系中的路径
  color: [number, number, number];
  lineWidth: number;
}

interface PdfAnnotationViewerProps {
  storageKey: string;
  title?: string;
}

const PdfAnnotationViewer = ({ storageKey, title }: PdfAnnotationViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  
  // PDF 相关状态
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pageViewport, setPageViewport] = useState<pdfjsLib.PageViewport | null>(null);
  
  // 批注存储 - 按页面索引存储
  const [annotations, setAnnotations] = useState<InkAnnotation[]>([]);

  // 默认PDF
  const defaultPdfUrl = "/documents/default-document.pdf";
  const defaultPdfName = "关于印发《2025年度党风廉政建设工作要点》的通知.pdf";

  // 加载PDF文件
  const loadPdf = useCallback(async (source: string | ArrayBuffer) => {
    try {
      let loadingTask;
      if (typeof source === "string") {
        loadingTask = pdfjsLib.getDocument(source);
      } else {
        loadingTask = pdfjsLib.getDocument({ data: source });
        setPdfBytes(source);
      }
      
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load PDF:", error);
      toast.error("PDF加载失败");
    }
  }, []);

  // 初始化 - 加载默认PDF或已保存的PDF
  useEffect(() => {
    const savedAnnotations = localStorage.getItem(`${storageKey}_annotations`);
    const savedPdfName = localStorage.getItem(`${storageKey}_pdf_name`);
    
    if (savedAnnotations) {
      try {
        setAnnotations(JSON.parse(savedAnnotations));
      } catch {
        // ignore
      }
    }
    
    if (savedPdfName) {
      setPdfFileName(savedPdfName);
    } else {
      setPdfFileName(defaultPdfName);
    }
    
    // 加载默认PDF
    loadPdf(defaultPdfUrl);
  }, [storageKey, loadPdf]);

  // 渲染当前页面
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !annotationCanvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      setPageViewport(viewport);

      const canvas = canvasRef.current;
      const annotationCanvas = annotationCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const annotationCtx = annotationCanvas.getContext("2d");
      
      if (!ctx || !annotationCtx) return;

      // 设置画布尺寸
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      annotationCanvas.width = viewport.width;
      annotationCanvas.height = viewport.height;

      // 渲染PDF页面
      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // 渲染当前页的批注
      renderAnnotations(annotationCtx, viewport);
    } catch (error) {
      console.error("Failed to render page:", error);
    }
  }, [pdfDoc, currentPage, scale]);

  // 渲染批注
  const renderAnnotations = useCallback((ctx: CanvasRenderingContext2D, viewport: pdfjsLib.PageViewport) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const pageAnnotations = annotations.filter(a => a.pageIndex === currentPage - 1);
    
    pageAnnotations.forEach((annotation) => {
      annotation.paths.forEach((path) => {
        if (path.length < 2) return;
        
        ctx.beginPath();
        ctx.strokeStyle = `rgb(${annotation.color[0] * 255}, ${annotation.color[1] * 255}, ${annotation.color[2] * 255})`;
        ctx.lineWidth = annotation.lineWidth * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 将PDF坐标转换为屏幕坐标
        const firstPoint = pdfToScreen(path[0], viewport);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        
        for (let i = 1; i < path.length; i++) {
          const point = pdfToScreen(path[i], viewport);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      });
    });
  }, [annotations, currentPage, scale]);

  // 页面变化时重新渲染
  useEffect(() => {
    renderPage();
  }, [renderPage, annotations]);

  // 屏幕坐标转PDF坐标
  const screenToPdf = (point: Point, viewport: pdfjsLib.PageViewport): Point => {
    // PDF坐标系：原点在左下角，Y轴向上
    // 屏幕坐标系：原点在左上角，Y轴向下
    return {
      x: point.x / scale,
      y: (viewport.height - point.y) / scale,
    };
  };

  // PDF坐标转屏幕坐标
  const pdfToScreen = (point: Point, viewport: pdfjsLib.PageViewport): Point => {
    return {
      x: point.x * scale,
      y: viewport.height - point.y * scale,
    };
  };

  // 获取触摸/鼠标坐标
  const getCoordinates = (e: React.TouchEvent | React.MouseEvent): Point | null => {
    const canvas = annotationCanvasRef.current;
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

  // 开始绘制
  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    if (!activeTool || !pageViewport) return;
    e.preventDefault();
    
    const point = getCoordinates(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentPath([point]);
  };

  // 绘制中
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || !activeTool || !pageViewport) return;
    e.preventDefault();

    const point = getCoordinates(e);
    if (!point) return;

    const newPath = [...currentPath, point];
    setCurrentPath(newPath);

    // 实时预览
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 重绘已有批注
    renderAnnotations(ctx, pageViewport);

    // 绘制当前笔画预览
    if (newPath.length >= 2) {
      ctx.beginPath();
      if (activeTool === "pencil") {
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2 * scale;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 20 * scale;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(newPath[0].x, newPath[0].y);
      for (let i = 1; i < newPath.length; i++) {
        ctx.lineTo(newPath[i].x, newPath[i].y);
      }
      ctx.stroke();
    }
  };

  // 结束绘制
  const stopDrawing = () => {
    if (!isDrawing || !activeTool || !pageViewport || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // 将屏幕坐标转换为PDF坐标
    const pdfPath = currentPath.map(p => screenToPdf(p, pageViewport));

    if (activeTool === "pencil") {
      // 添加新的墨迹批注
      const newAnnotation: InkAnnotation = {
        pageIndex: currentPage - 1,
        paths: [pdfPath],
        color: [1, 0, 0], // 红色
        lineWidth: 2,
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    } else if (activeTool === "eraser") {
      // 橡皮擦：删除与当前路径相交的批注
      eraseAnnotations(pdfPath);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  // 橡皮擦逻辑 - 删除相交的批注路径
  const eraseAnnotations = (eraserPath: Point[]) => {
    const eraserBounds = getPathBounds(eraserPath, 10);
    
    setAnnotations(prev => {
      return prev.map(annotation => {
        if (annotation.pageIndex !== currentPage - 1) return annotation;
        
        // 过滤掉与橡皮擦相交的路径
        const remainingPaths = annotation.paths.filter(path => {
          return !pathIntersectsBounds(path, eraserBounds);
        });
        
        return { ...annotation, paths: remainingPaths };
      }).filter(a => a.paths.length > 0);
    });
  };

  // 获取路径边界框
  const getPathBounds = (path: Point[], padding: number) => {
    const xs = path.map(p => p.x);
    const ys = path.map(p => p.y);
    return {
      minX: Math.min(...xs) - padding,
      maxX: Math.max(...xs) + padding,
      minY: Math.min(...ys) - padding,
      maxY: Math.max(...ys) + padding,
    };
  };

  // 检查路径是否与边界框相交
  const pathIntersectsBounds = (path: Point[], bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
    return path.some(p => 
      p.x >= bounds.minX && p.x <= bounds.maxX &&
      p.y >= bounds.minY && p.y <= bounds.maxY
    );
  };

  // 保存批注到 localStorage
  const handleSave = async () => {
    localStorage.setItem(`${storageKey}_annotations`, JSON.stringify(annotations));
    if (pdfFileName) {
      localStorage.setItem(`${storageKey}_pdf_name`, pdfFileName);
    }
    toast.success("批注已保存");
  };

  // 导出带批注的PDF
  const handleExportPdf = async () => {
    if (!pdfBytes && !pdfDoc) {
      toast.error("没有可导出的PDF");
      return;
    }

    try {
      // 获取原始PDF字节
      let originalBytes: ArrayBuffer;
      if (pdfBytes) {
        originalBytes = pdfBytes;
      } else {
        const response = await fetch(defaultPdfUrl);
        originalBytes = await response.arrayBuffer();
      }

      // 使用 pdf-lib 加载PDF
      const pdfLibDoc = await PDFDocument.load(originalBytes);
      const pages = pdfLibDoc.getPages();

      // 添加墨迹批注
      annotations.forEach((annotation) => {
        if (annotation.pageIndex >= pages.length) return;
        
        const page = pages[annotation.pageIndex];
        const { height } = page.getSize();

        annotation.paths.forEach((path) => {
          if (path.length < 2) return;

          // 绘制路径
          for (let i = 1; i < path.length; i++) {
            page.drawLine({
              start: { x: path[i - 1].x, y: path[i - 1].y },
              end: { x: path[i].x, y: path[i].y },
              thickness: annotation.lineWidth,
              color: rgb(annotation.color[0], annotation.color[1], annotation.color[2]),
            });
          }
        });
      });

      // 保存并下载
      const modifiedPdfBytes = await pdfLibDoc.save();
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName || "annotated-document.pdf";
      link.click();
      URL.revokeObjectURL(url);

      toast.success("PDF已导出");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("导出失败");
    }
  };

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("请上传PDF文件");
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    setPdfBytes(arrayBuffer);
    setPdfFileName(file.name);
    setAnnotations([]);
    loadPdf(arrayBuffer);
    toast.success(`已加载: ${file.name}`);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // 翻页
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  // 缩放
  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  const tools = [
    { id: "pencil" as ToolType, label: "铅笔", icon: Pencil },
    { id: "eraser" as ToolType, label: "橡皮", icon: Eraser },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-2 py-2 border-b bg-slate-50 shrink-0 gap-1">
        <button
          onClick={triggerFileUpload}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <Upload className="w-3 h-3" />
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
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              disabled={!pdfDoc}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                !pdfDoc 
                  ? "text-slate-300 cursor-not-allowed"
                  : activeTool === tool.id
                    ? "text-red-500 bg-red-50"
                    : "text-slate-500 hover:text-slate-700"
              )}
            >
              <tool.icon className="w-3 h-3" />
              <span>{tool.label}</span>
            </button>
          ))}
          
          <div className="w-px h-4 bg-slate-300 mx-1" />
          
          <button onClick={zoomOut} disabled={!pdfDoc} className="p-1 text-slate-500 hover:text-slate-700 disabled:text-slate-300">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={!pdfDoc} className="p-1 text-slate-500 hover:text-slate-700 disabled:text-slate-300">
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-slate-300 mx-1" />
          
          <button
            onClick={handleSave}
            disabled={!pdfDoc}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-slate-700 disabled:text-slate-300"
          >
            <Save className="w-3 h-3" />
            <span>保存</span>
          </button>
        </div>
      </div>

      {/* PDF预览区域 */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-slate-200"
      >
        {!pdfDoc ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 mb-4 text-center">
              正在加载PDF文件...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            {/* PDF文件信息 */}
            <div className="mb-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded text-xs text-slate-600 shadow-sm">
              {pdfFileName || "PDF文件"} - 第 {currentPage} / {totalPages} 页
            </div>
            
            {/* PDF画布容器 */}
            <div className="relative shadow-lg">
              {/* PDF内容画布 */}
              <canvas
                ref={canvasRef}
                className="block bg-white"
              />
              
              {/* 批注画布 - 叠加在PDF上 */}
              <canvas
                ref={annotationCanvasRef}
                className={cn(
                  "absolute top-0 left-0",
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
            
            {/* 翻页控制 */}
            {totalPages > 1 && (
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-white shadow text-sm disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-white shadow text-sm disabled:opacity-50"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfAnnotationViewer;
