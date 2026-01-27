import { useState } from "react";
import { ArrowLeft, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

          {/* 右侧按钮 */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="h-7 px-3 text-xs border-orange-400 text-orange-500 hover:bg-orange-50"
            >
              退回
            </Button>
            <Button 
              size="sm"
              className="h-7 px-3 text-xs bg-green-500 hover:bg-green-600 text-white"
            >
              发送
            </Button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeTab === "approval" && (
          <ApprovalSlip document={document} />
        )}
        {activeTab === "content" && (
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-center text-lg font-medium mb-4">正文内容</h3>
            <p className="text-muted-foreground text-center">暂无正文内容</p>
          </div>
        )}
        {activeTab === "history" && (
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-center text-lg font-medium mb-4">流转记录</h3>
            <p className="text-muted-foreground text-center">暂无流转记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 签批单组件
const ApprovalSlip = ({ document }: { document: DocumentDetailProps["document"] }) => {
  return (
    <div className="bg-background rounded-lg p-4">
      {/* 标题 */}
      <h2 className="text-center text-lg font-bold mb-4">发文审批单</h2>

      {/* 发文字号 */}
      <div className="mb-3 text-sm">
        <span className="text-muted-foreground">发文字号：</span>
        <span className="border-b border-dashed border-muted-foreground/50 inline-block min-w-20"></span>
      </div>

      {/* 主表格 */}
      <div className="border border-green-500 text-sm">
        {/* 第一行：签发、办公室领导意见、会稿 */}
        <div className="flex border-b border-green-500">
          <div className="w-16 shrink-0 border-r border-green-500 p-2 flex items-start">
            <span>签发：</span>
          </div>
          <div className="flex-1 border-r border-green-500 p-2 min-h-24">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">办公室领导意见：</span>
              <div className="flex gap-1">
                <Eye className="w-4 h-4 text-red-400" />
                <FileText className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <div className="bg-muted/50 rounded p-2 min-h-12 flex items-end justify-center">
              <span className="text-xs text-muted-foreground">陈树龙 2025.11.17</span>
            </div>
          </div>
          <div className="w-16 shrink-0 p-2">
            <span>会稿：</span>
          </div>
        </div>

        {/* 第二行：标题 */}
        <div className="flex border-b border-green-500">
          <div className="w-16 shrink-0 border-r border-green-500 p-2 flex items-center">
            <span className="tracking-widest">标　题：</span>
          </div>
          <div className="flex-1 p-2">
            <span className="font-medium">{document.title}</span>
          </div>
        </div>

        {/* 第三行：主送 */}
        <div className="flex border-b border-green-500">
          <div className="w-16 shrink-0 border-r border-green-500 p-2 flex items-center">
            <span className="tracking-widest">主　送：</span>
          </div>
          <div className="flex-1 p-2 min-h-10"></div>
        </div>

        {/* 第四行：抄送 */}
        <div className="flex border-b border-green-500">
          <div className="w-16 shrink-0 border-r border-green-500 p-2 flex items-center">
            <span className="tracking-widest">抄　送：</span>
          </div>
          <div className="flex-1 p-2 min-h-10"></div>
        </div>

        {/* 第五行：拟稿、清样打印 */}
        <div className="flex border-b border-green-500">
          <div className="flex-1 border-r border-green-500 p-2">
            <span>拟稿：</span>
          </div>
          <div className="flex-1 p-2">
            <span>清样打印：</span>
          </div>
        </div>

        {/* 第六行：核稿、送签 */}
        <div className="flex border-b border-green-500">
          <div className="flex-1 border-r border-green-500 p-2">
            <span>核稿：</span>
          </div>
          <div className="flex-1 p-2">
            <span>送签：</span>
          </div>
        </div>

        {/* 第七行：审核领导、挂号 */}
        <div className="flex border-b border-green-500">
          <div className="flex-1 border-r border-green-500 p-2">
            <span>审核领导</span>
          </div>
          <div className="flex-1 p-2">
            <span>挂号：</span>
          </div>
        </div>

        {/* 第八行：密级、定密审批、紧急程度、终校 */}
        <div className="flex border-b border-green-500 text-xs">
          <div className="border-r border-green-500 p-2">
            <span>密级：</span>
            <span className="text-blue-600">内部</span>
          </div>
          <div className="border-r border-green-500 p-2 flex-1">
            <span>定密审批：</span>
          </div>
          <div className="border-r border-green-500 p-2">
            <span>紧急程度：</span>
            <span className="text-blue-600">无</span>
          </div>
          <div className="p-2">
            <span>终校：</span>
          </div>
        </div>

        {/* 第九行：是否内网审批、印制份数、印制日期 */}
        <div className="flex text-xs">
          <div className="border-r border-green-500 p-2">
            <span>是否内网审批：</span>
            <span className="text-blue-600">是（）否（）</span>
          </div>
          <div className="border-r border-green-500 p-2 flex-1">
            <span>印制份数：</span>
          </div>
          <div className="p-2 flex-1">
            <span>印制日期：</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;
