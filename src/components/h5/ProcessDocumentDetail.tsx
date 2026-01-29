import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import PdfAnnotationViewer from "./PdfAnnotationViewer";

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
            <PdfAnnotationViewer storageKey={`doc_process_${document.id}`} title={document.title} />
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
