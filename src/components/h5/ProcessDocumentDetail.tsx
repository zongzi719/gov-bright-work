import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Pencil, Eraser, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProcessDocumentDetailProps {
  document: {
    id: string;
    title: string;
    submitter: string;
    submitTime: string;
    status: string;
  };
  onBack: () => void;
}

type TabType = "approval" | "content" | "history";

const ProcessDocumentDetail = ({ document, onBack }: ProcessDocumentDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("approval");

  const tabs = [
    { id: "approval" as TabType, label: "呈批单" },
    { id: "content" as TabType, label: "正文" },
    { id: "history" as TabType, label: "流转记录" },
  ];

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* 顶部固定操作栏 */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        {/* 第一行：返回 + 标题 */}
        <div className="flex items-center h-11 px-2 border-b border-slate-100">
          <button onClick={onBack} className="p-2 -ml-1 shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <span className="text-sm font-medium text-slate-800 truncate flex-1">公文办理</span>
        </div>
        
        {/* 第二行：标签导航 + 操作按钮 */}
        <div className="flex items-center justify-between h-10 px-2">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "text-red-700 bg-red-50"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center shrink-0">
            <button className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded whitespace-nowrap">
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 - 填满剩余空间 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "approval" && (
          <SubmissionSlip document={document} />
        )}
        {activeTab === "content" && (
          <div className="h-full">
            <ProcessContentViewer title={document.title} />
          </div>
        )}
        {activeTab === "history" && (
          <CirculationHistory />
        )}
      </div>
    </div>
  );
};

// 呈批单组件 - 优化布局
const SubmissionSlip = ({ document }: { document: ProcessDocumentDetailProps["document"] }) => {
  return (
    <div className="p-3">
      <div className="bg-white rounded-lg p-3">
        {/* 红色标题 */}
        <h2 className="text-center text-base font-bold text-red-600 mb-2">
          文件呈批单
        </h2>

        {/* 承办号和收文时间 */}
        <div className="flex justify-between text-xs text-slate-500 mb-3">
          <span>承办号：2025-16号</span>
          <span>收文时间：2025年01月27日</span>
        </div>

        {/* 主表格 */}
        <div className="border border-red-400 text-xs">
          {/* 第一行：来文单位、文号、密级 */}
          <div className="flex border-b border-red-400">
            <div className="w-14 shrink-0 border-r border-red-400 p-2 flex items-center justify-center bg-red-50">
              <span className="text-red-600 font-medium text-center leading-tight">来文单位</span>
            </div>
            <div className="flex-1 border-r border-red-400 p-2 text-slate-700">
              国务院办公厅
            </div>
            <div className="w-10 shrink-0 border-r border-red-400 p-2 flex items-center justify-center bg-red-50">
              <span className="text-red-600 font-medium">文号</span>
            </div>
            <div className="flex-1 border-r border-red-400 p-2 text-slate-700">
              国办发〔2025〕18号
            </div>
            <div className="w-10 shrink-0 border-r border-red-400 p-2 flex items-center justify-center bg-red-50">
              <span className="text-red-600 font-medium">密级</span>
            </div>
            <div className="w-12 shrink-0 p-2 text-center text-slate-700">
              内部
            </div>
          </div>

          {/* 第二行：标题 */}
          <div className="flex border-b border-red-400">
            <div className="w-14 shrink-0 border-r border-red-400 p-2 flex items-center justify-center bg-red-50">
              <span className="text-red-600 font-medium">标题</span>
            </div>
            <div className="flex-1 p-2 text-slate-800 leading-snug">
              {document.title}
            </div>
          </div>

          {/* 领导批示区域 */}
          <div className="border-b border-red-400">
            <div className="p-2 text-red-600 font-medium border-b border-red-400 bg-red-50">
              领导批示：
            </div>
            <div className="min-h-[60px] p-3 relative">
              <p className="text-xs text-slate-600 leading-relaxed">
                请办公室会同相关部门认真研究，结合我州实际情况提出贯彻落实意见。
              </p>
              <div className="text-right mt-3">
                <span className="text-xs text-slate-400">钱国庆 2025.01.27</span>
              </div>
            </div>
          </div>

          {/* 分管领导意见 */}
          <div className="border-b border-red-400">
            <div className="p-2 text-red-600 font-medium border-b border-red-400 bg-red-50">
              分管领导意见：
            </div>
            <div className="min-h-[50px] p-3 relative">
              <p className="text-xs text-slate-600">同意，请按领导批示执行</p>
              <div className="text-right mt-2">
                <span className="text-xs text-slate-400">何振国 2025.01.27</span>
              </div>
            </div>
          </div>

          {/* 副秘书长意见 */}
          <div className="border-b border-red-400">
            <div className="p-2 text-red-600 font-medium border-b border-red-400 bg-red-50">
              拟办意见：
            </div>
            <div className="min-h-[50px] p-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                建议由政策法规科牵头，会同相关业务科室在15个工作日内提出具体贯彻意见。
              </p>
              <div className="text-right mt-2">
                <span className="text-xs text-slate-400">冯志远 2025.01.27</span>
              </div>
            </div>
          </div>

          {/* 底部信息栏 */}
          <div className="flex">
            <div className="flex-1 border-r border-red-400 p-2">
              <span className="text-slate-500">经办人：</span>
              <span className="text-slate-700">李明华</span>
            </div>
            <div className="flex-1 border-r border-red-400 p-2">
              <span className="text-slate-500">审核：</span>
              <span className="text-slate-700">刘晓燕</span>
            </div>
            <div className="flex-1 p-2">
              <span className="text-slate-500">归档：</span>
              <span className="text-slate-700">待归档</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 正文查看器 - 修复批注保存
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

const STORAGE_KEY = "document_annotations_process";

const ProcessContentViewer = ({ title }: { title: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  // 从localStorage加载保存的批注
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPaths(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const documentContent = `中华人民共和国行政复议法

（1999年4月29日第九届全国人民代表大会常务委员会第九次会议通过　2023年9月1日第十四届全国人民代表大会常务委员会第五次会议修订）

第一章　总则

　　第一条　为了防止和纠正违法的或者不当的行政行为，保护公民、法人和其他组织的合法权益，监督和保障行政机关依法行使职权，发挥行政复议化解行政争议的主渠道作用，推进法治政府建设，根据宪法，制定本法。

　　第二条　公民、法人或者其他组织认为行政机关的行政行为侵犯其合法权益，向行政复议机关提出行政复议申请，行政复议机关办理行政复议案件，适用本法。`;

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(rect.height, 600);
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    paths.forEach((path) => {
      if (path.points.length < 2) return;
      
      ctx.beginPath();
      
      if (path.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = path.color;
      }
      
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
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

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (newPath.length >= 2) {
      ctx.beginPath();
      
      if (activeTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
      }
      
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const lastIndex = newPath.length - 1;
      ctx.moveTo(newPath[lastIndex - 1].x, newPath[lastIndex - 1].y);
      ctx.lineTo(newPath[lastIndex].x, newPath[lastIndex].y);
      ctx.stroke();
      
      ctx.globalCompositeOperation = "source-over";
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    toast.success("批注已保存");
  };

  const tools = [
    { id: "pencil" as ToolType, label: "铅笔", icon: Pencil },
    { id: "eraser" as ToolType, label: "橡皮", icon: Eraser },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-end gap-3 px-3 py-2 border-b bg-slate-50 shrink-0">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
              activeTool === tool.id
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
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>保存</span>
        </button>
      </div>

      {/* 文档内容 */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto"
      >
        <div className="p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap select-none min-h-[600px]">
          <div className="text-xs text-slate-400 mb-3 pb-2 border-b">
            {title} &nbsp;&nbsp; 收文编号：2025-16号
          </div>
          {documentContent}
          <div className="text-xs text-slate-400 mt-6 pt-2 border-t flex justify-between">
            <span>第1页 共12页</span>
            <span>2025/01/27 16:34</span>
          </div>
        </div>

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

// 流转记录组件 - 使用真实领导数据
const CirculationHistory = () => {
  const records = [
    { 
      from: "收发室（卫国强）", 
      fromTime: "2025-01-27 09:00", 
      to: "办公室（李明华）", 
      toTime: "2025-01-27 09:30",
      action: "请登记处理"
    },
    { 
      from: "李明华（主任）", 
      fromTime: "2025-01-27 09:30", 
      to: "冯志远（局长）", 
      toTime: "2025-01-27 10:15",
      action: "呈领导阅示"
    },
    { 
      from: "冯志远（局长）", 
      fromTime: "2025-01-27 10:15", 
      to: "何振国（局长）", 
      toTime: "2025-01-27 14:00",
      action: "请分管领导审核"
    },
    { 
      from: "何振国（局长）", 
      fromTime: "2025-01-27 14:00", 
      to: "钱国庆（局长）", 
      toTime: "2025-01-27 16:30",
      action: "呈主要领导批示"
    },
    { 
      from: "钱国庆（局长）", 
      fromTime: "2025-01-27 16:30", 
      to: "刘晓燕（副主任）", 
      toTime: "2025-01-28 09:00",
      action: "请按批示办理归档"
    },
  ];

  return (
    <div className="p-3">
      <div className="bg-white rounded-lg">
        <h3 className="text-center text-base font-medium py-3 border-b border-slate-100">流转记录</h3>
        <div className="p-3">
          {records.map((record, index) => (
            <div key={index} className="relative pl-4 pb-4 last:pb-0">
              {/* 时间线 */}
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-200" />
              <div className="absolute left-[-3px] top-1.5 w-2 h-2 rounded-full bg-red-500" />
              
              {/* 内容 */}
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{record.from}</span>
                  <span className="text-slate-400">{record.fromTime}</span>
                </div>
                {record.action && (
                  <div className="text-slate-500 italic">"{record.action}"</div>
                )}
                <div className="flex items-center gap-1 text-slate-400">
                  <span>→</span>
                  <span>{record.to}</span>
                  <span className="ml-2">{record.toTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProcessDocumentDetail;
