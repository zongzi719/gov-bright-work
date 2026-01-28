import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Pencil, Eraser, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DocumentDetailProps {
  document: {
    id: string;
    flowName: string;
    flowColor: string;
    title: string;
    submitter: string;
    submitTime: string;
    currentNode: string;
    status: string;
  };
  onBack: () => void;
}

type TabType = "approval" | "content" | "history";

const DocumentDetail = ({ document, onBack }: DocumentDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("approval");

  const tabs = [
    { id: "approval" as TabType, label: "签批单" },
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
          <span className="text-sm font-medium text-slate-800 truncate flex-1">发文审批</span>
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
                    ? "text-green-700 bg-green-50"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button className="px-2 py-1 text-xs border border-orange-400 text-orange-500 rounded hover:bg-orange-50 whitespace-nowrap">
              退回
            </button>
            <button className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded whitespace-nowrap">
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 - 填满剩余空间 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "approval" && (
          <ApprovalSlip document={document} />
        )}
        {activeTab === "content" && (
          <div className="h-full">
            <DocumentContentViewer />
          </div>
        )}
        {activeTab === "history" && (
          <CirculationHistory />
        )}
      </div>
    </div>
  );
};

// 流转记录组件 - 使用真实领导数据
const CirculationHistory = () => {
  const records = [
    { 
      from: "钱国庆（局长）", 
      fromTime: "2025-01-15 09:30", 
      to: "何振国（局长）", 
      toTime: "2025-01-15 10:15",
      action: "已阅，请继续办理"
    },
    { 
      from: "何振国（局长）", 
      fromTime: "2025-01-15 10:15", 
      to: "冯志远（局长）", 
      toTime: "2025-01-15 11:00",
      action: "同意发文"
    },
    { 
      from: "冯志远（局长）", 
      fromTime: "2025-01-15 11:00", 
      to: "李明华（主任）", 
      toTime: "2025-01-15 14:30",
      action: "请办公室核稿"
    },
    { 
      from: "李明华（主任）", 
      fromTime: "2025-01-15 14:30", 
      to: "刘晓燕（副主任）", 
      toTime: "2025-01-15 16:00",
      action: "已核稿，请审核"
    },
    { 
      from: "刘晓燕（副主任）", 
      fromTime: "2025-01-15 16:00", 
      to: "卫国强（局长）", 
      toTime: "2025-01-16 09:00",
      action: "呈领导签发"
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
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-200" />
              <div className="absolute left-[-3px] top-1.5 w-2 h-2 rounded-full bg-green-500" />
              
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

// 签批单组件 - 优化布局和字体
const ApprovalSlip = ({ document }: { document: DocumentDetailProps["document"] }) => {
  return (
    <div className="p-3">
      <div className="bg-white rounded-lg p-3">
        {/* 标题 */}
        <h2 className="text-center text-base font-bold text-green-700 mb-3">发文审批单</h2>

        {/* 发文字号 */}
        <div className="text-xs text-slate-600 mb-3 flex items-center">
          <span className="text-slate-500">发文字号：</span>
          <span className="border-b border-dashed border-slate-300 flex-1 ml-1 pb-0.5">昌党办发〔2025〕12号</span>
        </div>

        {/* 主表格 */}
        <div className="border border-green-500 text-xs">
          {/* 第一行：签发、办公室领导意见、会稿 */}
          <div className="flex border-b border-green-500">
            <div className="w-12 shrink-0 border-r border-green-500 p-2 flex items-center justify-center bg-green-50">
              <span className="text-green-700 font-medium text-center leading-tight">签发</span>
            </div>
            <div className="flex-1 border-r border-green-500 p-2">
              <div className="font-medium text-slate-700 mb-1">办公室领导意见：</div>
              <div className="min-h-[50px] text-slate-500 text-[11px]">
                同意发文
              </div>
              <div className="text-right text-slate-400 text-[10px]">钱国庆 2025.01.17</div>
            </div>
            <div className="w-12 shrink-0 p-2 flex items-center justify-center bg-green-50">
              <span className="text-green-700 font-medium">会稿</span>
            </div>
          </div>

          {/* 第二行：标题 */}
          <div className="flex border-b border-green-500">
            <div className="w-12 shrink-0 border-r border-green-500 p-2 flex items-center justify-center bg-green-50">
              <span className="text-green-700 font-medium">标题</span>
            </div>
            <div className="flex-1 p-2 text-slate-800 leading-snug">
              {document.title}
            </div>
          </div>

          {/* 第三行：主送 */}
          <div className="flex border-b border-green-500">
            <div className="w-12 shrink-0 border-r border-green-500 p-2 flex items-center justify-center bg-green-50">
              <span className="text-green-700 font-medium">主送</span>
            </div>
            <div className="flex-1 p-2 text-slate-600">
              各县市区党委、人民政府，州直各部门
            </div>
          </div>

          {/* 第四行：抄送 */}
          <div className="flex border-b border-green-500">
            <div className="w-12 shrink-0 border-r border-green-500 p-2 flex items-center justify-center bg-green-50">
              <span className="text-green-700 font-medium">抄送</span>
            </div>
            <div className="flex-1 p-2 text-slate-600">
              州纪委监委，州人大常委会办公室
            </div>
          </div>

          {/* 第五行：拟稿、清样打印 */}
          <div className="flex border-b border-green-500">
            <div className="flex-1 border-r border-green-500 p-2">
              <span className="text-slate-500">拟稿：</span>
              <span className="text-slate-700">李明华</span>
            </div>
            <div className="flex-1 p-2">
              <span className="text-slate-500">清样打印：</span>
              <span className="text-slate-700">刘晓燕</span>
            </div>
          </div>

          {/* 第六行：核稿、送签 */}
          <div className="flex border-b border-green-500">
            <div className="flex-1 border-r border-green-500 p-2">
              <span className="text-slate-500">核稿：</span>
              <span className="text-slate-700">冯志远</span>
            </div>
            <div className="flex-1 p-2">
              <span className="text-slate-500">送签：</span>
              <span className="text-slate-700">何振国</span>
            </div>
          </div>

          {/* 第七行：审核领导、挂号 */}
          <div className="flex border-b border-green-500">
            <div className="flex-1 border-r border-green-500 p-2">
              <span className="text-slate-500">审核领导：</span>
              <span className="text-slate-700">卫国强</span>
            </div>
            <div className="flex-1 p-2">
              <span className="text-slate-500">挂号：</span>
              <span className="text-slate-700">2025-0012</span>
            </div>
          </div>

          {/* 第八行：密级、紧急程度 */}
          <div className="flex border-b border-green-500">
            <div className="flex-1 border-r border-green-500 p-2">
              <span className="text-slate-500">密级：</span>
              <span className="text-blue-600">内部</span>
            </div>
            <div className="flex-1 p-2">
              <span className="text-slate-500">紧急程度：</span>
              <span className="text-blue-600">普通</span>
            </div>
          </div>

          {/* 第九行：印制份数、印制日期 */}
          <div className="flex">
            <div className="flex-1 border-r border-green-500 p-2">
              <span className="text-slate-500">印制份数：</span>
              <span className="text-slate-700">200份</span>
            </div>
            <div className="flex-1 p-2">
              <span className="text-slate-500">印制日期：</span>
              <span className="text-slate-700">2025-01-18</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 正文查看器 - 带批注功能（修复保存问题）
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

// 用于持久化存储的key
const STORAGE_KEY = "document_annotations_send";

const DocumentContentViewer = () => {
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

  const documentContent = `关于印发《2025年度党风廉政建设工作要点》的通知

各县市区党委、人民政府，州直各部门：

　　现将《2025年度党风廉政建设工作要点》印发给你们，请认真贯彻执行。

一、总体要求

　　坚持以习近平新时代中国特色社会主义思想为指导，深入贯彻党的二十大精神，认真落实中央纪委全会部署，持续深化全面从严治党。

二、主要任务

　　（一）强化政治监督。紧紧围绕党中央重大决策部署，加强对"国之大者"落实情况的监督检查。

　　（二）深化作风建设。持续纠治"四风"，特别是形式主义、官僚主义问题。

　　（三）加强廉洁教育。深入开展党纪学习教育，筑牢思想防线。`;

  // Resize canvas
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
        // 使用 destination-out 模式，只擦除画布上的内容，不影响底层文字
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
      
      // 恢复默认模式
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
    // 保存到localStorage
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
            昌党办发〔2025〕12号 &nbsp;&nbsp; 内部文件
          </div>
          {documentContent}
          <div className="text-xs text-slate-400 mt-6 pt-2 border-t flex justify-between">
            <span>第1页 共3页</span>
            <span>2025/01/17 10:44</span>
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

export default DocumentDetail;
