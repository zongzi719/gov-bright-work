import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Eye, FileText, Pencil, Eraser, Save } from "lucide-react";
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
    { id: "approval" as TabType, label: "呈批单", icon: "📋" },
    { id: "content" as TabType, label: "正文", icon: "📄" },
    { id: "history" as TabType, label: "流转记录", icon: "📝" },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-background sticky top-0 z-20 border-b">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* 标签导航 - 不压缩 */}
            <div className="flex items-center gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "text-amber-600 bg-amber-50 font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 右侧按钮 - 只有发送 */}
          <div className="flex items-center gap-2">
            <button className="px-5 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg">
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "approval" && (
          <SubmissionSlip document={document} />
        )}
        {activeTab === "content" && (
          <div className="bg-background rounded-lg overflow-hidden h-[calc(100vh-140px)]">
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

// 呈批单组件 - 公文办理专用
const SubmissionSlip = ({ document }: { document: ProcessDocumentDetailProps["document"] }) => {
  return (
    <div className="bg-background rounded-lg p-5">
      {/* 红色标题 */}
      <h2 className="text-center text-lg font-bold text-red-600 mb-4">
        中共昌吉回族自治州委员会办公室文件呈批单
      </h2>

      {/* 承办号和收文时间 */}
      <div className="flex justify-between text-sm text-muted-foreground mb-4">
        <span>承办号：2025-16号</span>
        <span>收文时间：2025年8月27日</span>
      </div>

      {/* 主表格 */}
      <div className="border-2 border-red-400 text-sm">
        {/* 第一行：来文单位、文号、主送、密级 */}
        <div className="flex border-b border-red-400">
          <div className="w-16 shrink-0 border-r border-red-400 p-2.5 text-red-600 font-medium flex flex-col items-center justify-center text-center leading-tight">
            <span>来文</span>
            <span>单位</span>
          </div>
          <div className="flex-1 border-r border-red-400 p-2.5">
            <span>国务院办公厅</span>
          </div>
          <div className="w-12 shrink-0 border-r border-red-400 p-2.5 text-red-600 font-medium flex items-center justify-center">
            文号
          </div>
          <div className="flex-1 border-r border-red-400 p-2.5">
            <span>国办发〔2025〕18号</span>
          </div>
          <div className="w-12 shrink-0 border-r border-red-400 p-2.5 text-red-600 font-medium flex items-center justify-center">
            密级
          </div>
          <div className="w-14 shrink-0 p-2.5 text-center">
            内部
          </div>
        </div>

        {/* 第二行：标题 */}
        <div className="flex border-b border-red-400">
          <div className="w-16 shrink-0 border-r border-red-400 p-2.5 text-red-600 font-medium flex items-center justify-center">
            标题
          </div>
          <div className="flex-1 p-3">
            {document.title}
          </div>
        </div>

        {/* 领导批示区域 */}
        <div className="border-b border-red-400">
          <div className="p-2.5 text-red-600 font-medium border-b border-red-400">
            领导批示：
          </div>
          <div className="min-h-36 p-4 relative">
            {/* 签章图标 */}
            <div className="absolute right-4 top-4 flex gap-2">
              <Eye className="w-5 h-5 text-red-400" />
              <FileText className="w-5 h-5 text-red-400" />
            </div>
            {/* 批示内容 */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              请办公室会同相关部门认真研究，结合我州实际情况提出贯彻落实意见。
            </p>
            {/* 签名 */}
            <div className="absolute bottom-4 right-4 text-right">
              <div className="bg-muted/30 px-4 py-2 rounded inline-block">
                <span className="text-sm text-muted-foreground">陈树龙 2025.08.27</span>
              </div>
            </div>
          </div>
        </div>

        {/* 分管领导意见 */}
        <div className="border-b border-red-400">
          <div className="p-2.5 text-red-600 font-medium border-b border-red-400">
            分管领导意见：
          </div>
          <div className="min-h-32 p-4 relative">
            {/* 签名 */}
            <div className="absolute bottom-4 right-4 text-right">
              <div className="text-sm text-muted-foreground">
                <span className="mr-6">同意，请按领导批示执行</span>
                <span>黄清辉 2025.08.27</span>
              </div>
            </div>
          </div>
        </div>

        {/* 副秘书长意见 */}
        <div className="border-b border-red-400">
          <div className="p-2.5 text-red-600 font-medium border-b border-red-400">
            副秘书长意见：
          </div>
          <div className="min-h-28 p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              该文件内容规范，与我州现行政策一致。建议由政策法规科牵头，会同相关业务科室在15个工作日内提出具体贯彻意见，报分管领导审核后实施。
            </p>
            <div className="text-right mt-4">
              <span className="text-sm text-muted-foreground">周明 2025.08.27</span>
            </div>
          </div>
        </div>

        {/* 底部信息栏 */}
        <div className="flex">
          <div className="flex-1 border-r border-red-400 p-2.5">
            <span className="text-muted-foreground">拟办时间：</span>
            <span className="ml-1">2025-08-27</span>
          </div>
          <div className="flex-1 border-r border-red-400 p-2.5">
            <span className="text-muted-foreground">经办人：</span>
            <span className="ml-1">张玉</span>
          </div>
          <div className="flex-1 border-r border-red-400 p-2.5">
            <span className="text-muted-foreground">审核人：</span>
            <span className="ml-1">李秘书</span>
          </div>
          <div className="flex-1 p-2.5">
            <span className="text-muted-foreground">归档：</span>
            <span className="ml-1">待归档</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 公文办理正文查看器 - OFD格式带批注功能
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

const ProcessContentViewer = ({ title }: { title: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  // 公文办理的OFD文档内容 - 行政复议法相关
  const documentContent = `中华人民共和国行政复议法

（1999年4月29日第九届全国人民代表大会常务委员会第九次会议通过　2023年9月1日第十四届全国人民代表大会常务委员会第五次会议修订）

第一章　总　则

第一条　为了防止和纠正违法的或者不当的行政行为，保护公民、法人和其他组织的合法权益，监督和保障行政机关依法行使职权，发挥行政复议化解行政争议的主渠道作用，推进法治政府建设，根据宪法，制定本法。

第二条　公民、法人或者其他组织认为行政机关的行政行为侵犯其合法权益，向行政复议机关提出行政复议申请，行政复议机关办理行政复议案件，适用本法。

第三条　行政复议工作应当坚持中国共产党的领导，坚持以人民为中心，遵循合法、公正、公开、高效、便民、为民的原则，坚持有错必纠，保障法律、法规、规章的正确实施。

第四条　县级以上各级人民政府应当加强对行政复议工作的领导。

行政复议机关应当加强行政复议工作规范化、专业化、信息化建设。`;

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
      <div className="flex items-center justify-end gap-5 px-5 py-3 border-b bg-muted/30">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-colors",
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
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap select-none">
          <div className="text-sm text-muted-foreground mb-5 border-b pb-3">
            {title} &nbsp;&nbsp;&nbsp;&nbsp; 收文编号：2025-16号
          </div>
          {documentContent.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-5 text-justify indent-8">
              {paragraph}
            </p>
          ))}
          <div className="text-sm text-muted-foreground mt-10 pt-3 border-t flex justify-between">
            <span>第1页 共12页</span>
            <span>2025/8/27 09:00</span>
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

// 流转记录组件
const CirculationHistory = () => {
  const records = [
    { from: "收发室（王小红）", fromTime: "2025-08-27 09:00", to: "办公室（李秘书）", toTime: "2025-08-27 09:30" },
    { from: "办公室（李秘书）", fromTime: "2025-08-27 09:30", to: "副秘书长（周明）", toTime: "2025-08-27 10:15" },
    { from: "副秘书长（周明）", fromTime: "2025-08-27 10:15", to: "分管领导（黄清辉）", toTime: "2025-08-27 14:00" },
    { from: "分管领导（黄清辉）", fromTime: "2025-08-27 14:00", to: "主要领导（陈树龙）", toTime: "2025-08-27 16:30" },
    { from: "主要领导（陈树龙）", fromTime: "2025-08-27 16:30", to: "办公室（归档）", toTime: "2025-08-28 09:00" },
  ];

  return (
    <div className="bg-background rounded-lg p-5">
      <h3 className="text-center text-lg font-medium mb-5">流转记录</h3>
      <div className="space-y-4">
        {records.map((record, index) => (
          <div key={index} className="border-l-2 border-primary/30 pl-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-foreground">{record.from}</span>
              <span className="text-muted-foreground">{record.fromTime}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground my-2 ml-2">
              <span>↓</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-foreground">{record.to}</span>
              <span className="text-muted-foreground">{record.toTime}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProcessDocumentDetail;
