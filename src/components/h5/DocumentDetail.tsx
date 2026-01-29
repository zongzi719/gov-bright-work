import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import PdfAnnotationViewer from "./PdfAnnotationViewer";

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
            <PdfAnnotationViewer storageKey={`doc_send_${document.id}`} title={document.title} />
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

export default DocumentDetail;
