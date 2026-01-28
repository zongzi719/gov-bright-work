import { useState } from "react";
import { ArrowLeft, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import DocumentContentViewer from "./DocumentContentViewer";

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
    { id: "approval" as TabType, label: "签批单", icon: "📋" },
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

          {/* 右侧按钮 */}
          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 text-sm border border-orange-400 text-orange-500 rounded-lg hover:bg-orange-50">
              退回
            </button>
            <button className="px-4 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg">
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "approval" && (
          <ApprovalSlip document={document} />
        )}
        {activeTab === "content" && (
          <div className="bg-background rounded-lg overflow-hidden h-[calc(100vh-140px)]">
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

// 流转记录组件
const CirculationHistory = () => {
  const records = [
    { from: "张三（办公室）", fromTime: "2025-01-15 09:30", to: "李四（综合科）", toTime: "2025-01-15 10:15" },
    { from: "李四（综合科）", fromTime: "2025-01-15 10:15", to: "王五（财务部）", toTime: "2025-01-15 11:00" },
    { from: "王五（财务部）", fromTime: "2025-01-15 11:00", to: "赵六（法规科）", toTime: "2025-01-15 14:30" },
    { from: "赵六（法规科）", fromTime: "2025-01-15 14:30", to: "陈树龙（办公室主任）", toTime: "2025-01-15 16:00" },
    { from: "陈树龙（办公室主任）", fromTime: "2025-01-15 16:00", to: "刘主任（分管领导）", toTime: "2025-01-16 09:00" },
    { from: "刘主任（分管领导）", fromTime: "2025-01-16 09:00", to: "周局长（签发）", toTime: "2025-01-16 10:30" },
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

// 签批单组件
const ApprovalSlip = ({ document }: { document: DocumentDetailProps["document"] }) => {
  return (
    <div className="bg-background rounded-lg p-5">
      {/* 标题 */}
      <h2 className="text-center text-xl font-bold mb-5">发文审批单</h2>

      {/* 发文字号 */}
      <div className="mb-4 text-sm">
        <span className="text-muted-foreground">发文字号：</span>
        <span className="border-b border-dashed border-muted-foreground/50 inline-block min-w-24 ml-2">昌党办发〔2025〕12号</span>
      </div>

      {/* 主表格 */}
      <div className="border-2 border-green-500 text-sm">
        {/* 第一行：签发、办公室领导意见、会稿 */}
        <div className="flex border-b border-green-500">
          <div className="w-20 shrink-0 border-r border-green-500 p-3 flex items-start">
            <span className="font-medium">签发：</span>
          </div>
          <div className="flex-1 border-r border-green-500 p-3 min-h-28">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">办公室领导意见：</span>
              <div className="flex gap-2">
                <Eye className="w-5 h-5 text-red-400" />
                <FileText className="w-5 h-5 text-red-400" />
              </div>
            </div>
            <div className="bg-muted/50 rounded p-3 min-h-14 flex items-end justify-center">
              <span className="text-sm text-muted-foreground">陈树龙 2025.11.17</span>
            </div>
          </div>
          <div className="w-20 shrink-0 p-3">
            <span className="font-medium">会稿：</span>
          </div>
        </div>

        {/* 第二行：标题 */}
        <div className="flex border-b border-green-500">
          <div className="w-20 shrink-0 border-r border-green-500 p-3 flex items-center">
            <span className="font-medium">标　题：</span>
          </div>
          <div className="flex-1 p-3">
            <span className="font-medium">{document.title}</span>
          </div>
        </div>

        {/* 第三行：主送 */}
        <div className="flex border-b border-green-500">
          <div className="w-20 shrink-0 border-r border-green-500 p-3 flex items-center">
            <span className="font-medium">主　送：</span>
          </div>
          <div className="flex-1 p-3 min-h-12">
            <span>各县市区党委、人民政府，州直各部门</span>
          </div>
        </div>

        {/* 第四行：抄送 */}
        <div className="flex border-b border-green-500">
          <div className="w-20 shrink-0 border-r border-green-500 p-3 flex items-center">
            <span className="font-medium">抄　送：</span>
          </div>
          <div className="flex-1 p-3 min-h-12">
            <span>州纪委监委，州人大常委会办公室，州政协办公室</span>
          </div>
        </div>

        {/* 第五行：拟稿、清样打印 */}
        <div className="flex border-b border-green-500">
          <div className="flex-1 border-r border-green-500 p-3">
            <span className="font-medium">拟稿：</span>
            <span className="ml-2 text-muted-foreground">黄思艺</span>
          </div>
          <div className="flex-1 p-3">
            <span className="font-medium">清样打印：</span>
            <span className="ml-2 text-muted-foreground">张玉</span>
          </div>
        </div>

        {/* 第六行：核稿、送签 */}
        <div className="flex border-b border-green-500">
          <div className="flex-1 border-r border-green-500 p-3">
            <span className="font-medium">核稿：</span>
            <span className="ml-2 text-muted-foreground">李明华</span>
          </div>
          <div className="flex-1 p-3">
            <span className="font-medium">送签：</span>
            <span className="ml-2 text-muted-foreground">王秀英</span>
          </div>
        </div>

        {/* 第七行：审核领导、挂号 */}
        <div className="flex border-b border-green-500">
          <div className="flex-1 border-r border-green-500 p-3">
            <span className="font-medium">审核领导：</span>
            <span className="ml-2 text-muted-foreground">周明</span>
          </div>
          <div className="flex-1 p-3">
            <span className="font-medium">挂号：</span>
            <span className="ml-2 text-muted-foreground">2025-0012</span>
          </div>
        </div>

        {/* 第八行：密级、定密审批、紧急程度、终校 */}
        <div className="flex border-b border-green-500">
          <div className="border-r border-green-500 p-3">
            <span className="font-medium">密级：</span>
            <span className="ml-1 text-blue-600">内部</span>
          </div>
          <div className="border-r border-green-500 p-3 flex-1">
            <span className="font-medium">定密审批：</span>
            <span className="ml-1 text-muted-foreground">刘主任</span>
          </div>
          <div className="border-r border-green-500 p-3">
            <span className="font-medium">紧急程度：</span>
            <span className="ml-1 text-blue-600">普通</span>
          </div>
          <div className="p-3">
            <span className="font-medium">终校：</span>
            <span className="ml-1 text-muted-foreground">张玉</span>
          </div>
        </div>

        {/* 第九行：是否内网审批、印制份数、印制日期 */}
        <div className="flex">
          <div className="border-r border-green-500 p-3">
            <span className="font-medium">是否内网审批：</span>
            <span className="ml-1 text-blue-600">是（✓）否（）</span>
          </div>
          <div className="border-r border-green-500 p-3 flex-1">
            <span className="font-medium">印制份数：</span>
            <span className="ml-1 text-muted-foreground">200份</span>
          </div>
          <div className="p-3 flex-1">
            <span className="font-medium">印制日期：</span>
            <span className="ml-1 text-muted-foreground">2025-11-18</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;
