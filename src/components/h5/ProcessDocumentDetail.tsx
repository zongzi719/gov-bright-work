import { useState } from "react";
import { ArrowLeft, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DocumentContentViewer from "./DocumentContentViewer";

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
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-1">
            <button onClick={onBack} className="p-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* 左侧标签 */}
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors",
                    activeTab === tab.id
                      ? "text-amber-600 font-medium"
                      : "text-muted-foreground"
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
            <Button 
              size="sm"
              className="h-7 px-4 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              发送
            </Button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeTab === "approval" && (
          <SubmissionSlip document={document} />
        )}
        {activeTab === "content" && (
          <div className="bg-background rounded-lg overflow-hidden h-[calc(100vh-120px)]">
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

// 呈批单组件 - 公文办理专用
const SubmissionSlip = ({ document }: { document: ProcessDocumentDetailProps["document"] }) => {
  return (
    <div className="bg-background rounded-lg p-4">
      {/* 红色标题 */}
      <h2 className="text-center text-base font-bold text-red-600 mb-3">
        中共昌吉回族自治州委员会办公室文件呈批单
      </h2>

      {/* 承办号和收文时间 */}
      <div className="flex justify-between text-xs text-muted-foreground mb-3">
        <span>承办号：2025-16号</span>
        <span>收文时间：2025年8月27日</span>
      </div>

      {/* 主表格 */}
      <div className="border border-red-400 text-sm">
        {/* 第一行：来文单位、文号、主送、密级、内部 */}
        <div className="flex border-b border-red-400">
          <div className="w-14 shrink-0 border-r border-red-400 p-1.5 text-red-600 font-medium flex flex-col items-center justify-center text-center text-xs leading-tight">
            <span>来文</span>
            <span>单位</span>
          </div>
          <div className="flex-1 border-r border-red-400 p-1.5 text-xs"></div>
          <div className="w-10 shrink-0 border-r border-red-400 p-1.5 text-red-600 font-medium flex items-center justify-center text-xs">
            文号
          </div>
          <div className="flex-1 border-r border-red-400 p-1.5 text-xs"></div>
          <div className="w-10 shrink-0 border-r border-red-400 p-1.5 text-red-600 font-medium flex items-center justify-center text-xs">
            主送
          </div>
          <div className="flex-1 border-r border-red-400 p-1.5 text-xs"></div>
          <div className="w-10 shrink-0 border-r border-red-400 p-1.5 text-red-600 font-medium flex items-center justify-center text-xs">
            密级
          </div>
          <div className="w-10 shrink-0 p-1.5 text-red-600 font-medium flex items-center justify-center text-xs">
            内部
          </div>
        </div>

        {/* 第二行：标题 */}
        <div className="flex border-b border-red-400">
          <div className="w-14 shrink-0 border-r border-red-400 p-1.5 text-red-600 font-medium flex items-center justify-center text-xs">
            标题
          </div>
          <div className="flex-1 p-2 text-sm">
            {document.title}
          </div>
        </div>

        {/* 领导批示区域 */}
        <div className="border-b border-red-400">
          <div className="p-2 text-red-600 font-medium text-xs border-b border-red-400">
            领导批示：
          </div>
          <div className="min-h-32 p-3 relative">
            {/* 签章图标 */}
            <div className="absolute right-3 top-3 flex gap-2">
              <Eye className="w-5 h-5 text-red-400" />
              <FileText className="w-5 h-5 text-red-400" />
            </div>
            {/* 签名 */}
            <div className="absolute bottom-3 right-3 text-right">
              <div className="bg-muted/30 px-3 py-1 rounded inline-block">
                <span className="text-xs text-muted-foreground">陈树龙 2025.11.17</span>
              </div>
            </div>
          </div>
        </div>

        {/* 分管领导意见 */}
        <div className="border-b border-red-400">
          <div className="p-2 text-red-600 font-medium text-xs border-b border-red-400">
            分管领导意见：
          </div>
          <div className="min-h-28 p-3 relative">
            {/* 签名 */}
            <div className="absolute bottom-3 right-3 text-right">
              <div className="text-xs text-muted-foreground">
                <span className="mr-4">同意</span>
                <span>黄清辉 2025.11.17</span>
              </div>
            </div>
          </div>
        </div>

        {/* 副秘书长意见 */}
        <div className="border-b border-red-400">
          <div className="p-2 text-red-600 font-medium text-xs border-b border-red-400">
            副秘书长意见：
          </div>
          <div className="min-h-24 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              该文件内容规范，审核材料"工作"，通过文字符合进度，建议如期一、按现有案...
              按照规范审核内容执行发布流程，审核人员及时跟进。文件格式符合规范，可以继续执行。
            </p>
          </div>
        </div>

        {/* 底部信息栏 */}
        <div className="flex text-xs">
          <div className="flex-1 border-r border-red-400 p-2">
            <span className="text-muted-foreground">拟稿时间/会计：</span>
          </div>
          <div className="flex-1 border-r border-red-400 p-2">
            <span className="text-muted-foreground">经办人：</span>
          </div>
          <div className="flex-1 border-r border-red-400 p-2">
            <span className="text-muted-foreground">审核人：</span>
          </div>
          <div className="flex-1 p-2">
            <span className="text-muted-foreground">文印室：</span>
          </div>
        </div>
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
  ];

  return (
    <div className="bg-background rounded-lg p-4">
      <h3 className="text-center text-base font-medium mb-4">流转记录</h3>
      <div className="space-y-3">
        {records.map((record, index) => (
          <div key={index} className="border-l-2 border-primary/30 pl-3 py-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{record.from}</span>
              <span className="text-muted-foreground text-xs">{record.fromTime}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground my-1">
              <span>↓</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{record.to}</span>
              <span className="text-muted-foreground text-xs">{record.toTime}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProcessDocumentDetail;
