import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DocumentDetail from "@/components/h5/DocumentDetail";

// 模拟数据
const mockCategories = [
  { id: "send", name: "发文审签", icon: "📤", count: 3 },
  { id: "process", name: "公文办理", icon: "📋", count: 3 },
];

const mockDocuments = [
  {
    id: "1",
    category: "send",
    flowName: "党委办公室发文流程(暂未开放)",
    flowColor: "bg-orange-500",
    title: "关于印发xxx文件的通知",
    submitter: "黄思艺",
    submitTime: "2025-11-17 10:44:53",
    currentNode: "审核领导",
    status: "待办",
  },
  {
    id: "2",
    category: "send",
    flowName: "普发件流程",
    flowColor: "bg-green-500",
    title: "这是一个发布审批",
    submitter: "张玉",
    submitTime: "2025-09-04 18:53:43",
    currentNode: "核稿",
    status: "在办",
  },
  {
    id: "3",
    category: "send",
    flowName: "普发件流程",
    flowColor: "bg-green-500",
    title: "审计报告审批流程",
    submitter: "昌吉党委运维人...",
    submitTime: "2025-09-04 18:06:08",
    currentNode: "核稿",
    status: "在办",
  },
  {
    id: "4",
    category: "process",
    flowName: "收文办理流程",
    flowColor: "bg-blue-500",
    title: "关于开展年度检查的通知",
    submitter: "李明",
    submitTime: "2025-11-15 09:30:00",
    currentNode: "部门领导审批",
    status: "待办",
  },
  {
    id: "5",
    category: "process",
    flowName: "收文办理流程",
    flowColor: "bg-blue-500",
    title: "关于调整工作安排的函",
    submitter: "王芳",
    submitTime: "2025-11-14 14:20:00",
    currentNode: "办公室主任",
    status: "在办",
  },
  {
    id: "6",
    category: "process",
    flowName: "紧急收文流程",
    flowColor: "bg-red-500",
    title: "关于紧急会议安排的通知",
    submitter: "赵刚",
    submitTime: "2025-11-16 08:00:00",
    currentNode: "主要领导",
    status: "待办",
  },
];

type DocumentType = typeof mockDocuments[0];

const H5OfficialDocument = () => {
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [activeCategory, setActiveCategory] = useState("send");
  const [searchText, setSearchText] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);

  const filteredDocuments = mockDocuments.filter((doc) => {
    const matchCategory = doc.category === activeCategory;
    const matchTab = activeTab === "pending" 
      ? doc.status === "待办" || doc.status === "在办"
      : doc.status === "已办";
    const matchSearch = searchText === "" || 
      doc.title.includes(searchText) || 
      doc.submitter.includes(searchText);
    return matchCategory && matchTab && matchSearch;
  });

  const handleBack = () => {
    window.close();
  };

  const handleDocumentClick = (doc: DocumentType) => {
    setSelectedDocument(doc);
  };

  const handleBackFromDetail = () => {
    setSelectedDocument(null);
  };

  // 如果选中了文档，显示详情页
  if (selectedDocument) {
    return (
      <DocumentDetail 
        document={selectedDocument} 
        onBack={handleBackFromDetail} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#8B7355] flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-background sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          {/* 待办/已办切换 */}
          <div className="flex rounded-full border border-primary overflow-hidden">
            <button
              className={cn(
                "px-6 py-1.5 text-sm font-medium transition-colors",
                activeTab === "pending"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              )}
              onClick={() => setActiveTab("pending")}
            >
              待 办
            </button>
            <button
              className={cn(
                "px-6 py-1.5 text-sm font-medium transition-colors",
                activeTab === "completed"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              )}
              onClick={() => setActiveTab("completed")}
            >
              已 办
            </button>
          </div>
          
          <div className="w-6" /> {/* 占位 */}
        </div>

        {/* 搜索框 */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="请输入搜索内容"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex">
        {/* 左侧分类 */}
        <div className="w-20 bg-background/80 flex flex-col items-center py-4 gap-4">
          {mockCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative",
                activeCategory === cat.id
                  ? "bg-orange-100 text-orange-600"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-xl">
                  {cat.icon}
                </div>
                {cat.count > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-red-500 hover:bg-red-500"
                  >
                    {cat.count}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-center leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* 右侧文档列表 */}
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="space-y-3">
            {filteredDocuments.length === 0 ? (
              <div className="bg-background rounded-lg p-8 text-center text-muted-foreground">
                暂无数据
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-background rounded-lg p-3 shadow-sm cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => handleDocumentClick(doc)}
                >
                  {/* 流程标签 */}
                  <div className="mb-2">
                    <span className={cn(
                      "inline-block px-2 py-0.5 text-[12px] text-white rounded",
                      doc.flowColor
                    )}>
                      {doc.flowName}
                    </span>
                  </div>

                  {/* 标题 */}
                  <h3 className="font-medium text-foreground mb-2 text-[14px] leading-tight line-clamp-2">
                    {doc.title}
                  </h3>

                  {/* 信息 - 垂直排列 */}
                  <div className="text-[12px] text-muted-foreground space-y-0.5">
                    <div className="flex">
                      <span className="w-16 shrink-0">提交人：</span>
                      <span className="truncate">{doc.submitter}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 shrink-0">提交时间：</span>
                      <span>{doc.submitTime}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 shrink-0">当前节点：</span>
                      <span>{doc.currentNode}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 shrink-0">状态：</span>
                      <span>{doc.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default H5OfficialDocument;
