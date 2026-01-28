import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar, SearchBar, List, Tag, Empty, Skeleton } from "antd-mobile";
import { FileOutline, SendOutline, ReceivePaymentOutline } from "antd-mobile-icons";
import DocumentDetail from "@/components/h5/DocumentDetail";
import ProcessDocumentDetail from "@/components/h5/ProcessDocumentDetail";
import FileTransferList from "@/components/h5/FileTransferList";

// 更真实的模拟数据
const mockDocuments = [
  {
    id: "1",
    category: "send",
    flowName: "党委办公室发文",
    flowColor: "warning",
    title: "关于印发《2025年度党风廉政建设工作要点》的通知",
    submitter: "黄思艺",
    submitTime: "2025-01-17 10:44",
    currentNode: "审核领导",
    status: "待办",
  },
  {
    id: "2",
    category: "send",
    flowName: "普发件流程",
    flowColor: "success",
    title: "关于召开2025年度工作总结暨表彰大会的通知",
    submitter: "张玉",
    submitTime: "2025-01-04 18:53",
    currentNode: "核稿",
    status: "在办",
  },
  {
    id: "3",
    category: "send",
    flowName: "普发件流程",
    flowColor: "success",
    title: "关于开展安全生产大检查工作的紧急通知",
    submitter: "李明华",
    submitTime: "2025-01-04 18:06",
    currentNode: "核稿",
    status: "在办",
  },
  {
    id: "4",
    category: "send",
    flowName: "党委办公室发文",
    flowColor: "warning",
    title: "关于调整领导班子成员分工的通知",
    submitter: "王秀英",
    submitTime: "2025-01-15 09:30",
    currentNode: "签发",
    status: "待办",
  },
  {
    id: "5",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "关于推进各类改革试点协同配合的通知",
    submitter: "张玉",
    submitTime: "2025-01-04 12:31",
    currentNode: "",
    status: "未批阅",
  },
  {
    id: "6",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "国务院办公厅关于加强政务新媒体管理工作的意见",
    submitter: "张玉",
    submitTime: "2025-01-04 12:27",
    currentNode: "",
    status: "未批阅",
  },
  {
    id: "7",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "中华人民共和国行政复议法实施条例",
    submitter: "张玉",
    submitTime: "2025-01-27 16:34",
    currentNode: "",
    status: "未批阅",
  },
  {
    id: "8",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "关于进一步加强基层治理体系建设的意见",
    submitter: "陈伟",
    submitTime: "2025-01-25 14:20",
    currentNode: "",
    status: "未批阅",
  },
];

type DocumentType = (typeof mockDocuments)[0];

interface H5User {
  id: string;
  name: string;
  mobile: string;
  position: string | null;
  department: string | null;
  is_leader: boolean;
}

const H5OfficialDocument = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<H5User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [activeCategory, setActiveCategory] = useState("send");
  const [searchText, setSearchText] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);

  // 检查登录状态
  useEffect(() => {
    const storedUser = localStorage.getItem("h5User");
    if (!storedUser) {
      navigate("/h5login");
      return;
    }
    try {
      const userInfo = JSON.parse(storedUser);
      if (!userInfo.is_leader) {
        navigate("/h5login");
        return;
      }
      setUser(userInfo);
    } catch {
      navigate("/h5login");
      return;
    }
    setLoading(false);
  }, [navigate]);

  const filteredDocuments = mockDocuments.filter((doc) => {
    const matchCategory = doc.category === activeCategory;
    const matchTab =
      activeTab === "pending"
        ? doc.status === "待办" || doc.status === "在办" || doc.status === "未批阅"
        : doc.status === "已办" || doc.status === "已批阅";
    const matchSearch =
      searchText === "" ||
      doc.title.includes(searchText) ||
      doc.submitter.includes(searchText);
    return matchCategory && matchTab && matchSearch;
  });

  const handleLogout = () => {
    localStorage.removeItem("h5User");
    navigate("/h5login");
  };

  // 计算各分类的待办数量
  const getCategoryCount = (category: string) => {
    return mockDocuments.filter(
      (doc) =>
        doc.category === category &&
        (doc.status === "待办" || doc.status === "在办" || doc.status === "未批阅")
    ).length;
  };

  // 如果选中了文档，根据分类显示不同详情页
  if (selectedDocument) {
    if (selectedDocument.category === "process") {
      return (
        <ProcessDocumentDetail
          document={selectedDocument}
          onBack={() => setSelectedDocument(null)}
        />
      );
    }
    return (
      <DocumentDetail
        document={selectedDocument}
        onBack={() => setSelectedDocument(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Skeleton.Title animated />
        <Skeleton.Paragraph lineCount={5} animated />
      </div>
    );
  }

  // 分类配置
  const categories = [
    { key: "send", title: "发文审签", icon: <SendOutline fontSize={18} />, count: getCategoryCount("send") },
    { key: "process", title: "公文办理", icon: <FileOutline fontSize={18} />, count: getCategoryCount("process") },
    { key: "transfer", title: "文件收发", icon: <ReceivePaymentOutline fontSize={18} />, count: 2 },
  ];

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case "待办":
      case "未批阅":
        return "#dc2626"; // red
      case "在办":
        return "#f59e0b"; // amber
      case "已办":
      case "已批阅":
        return "#16a34a"; // green
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* 顶部导航栏 - 政务蓝 */}
      <div className="bg-blue-800 text-white shrink-0">
        <NavBar
          backIcon={<span className="text-white text-base">←</span>}
          onBack={() => navigate(-1)}
          right={
            <span className="text-xs text-white/80" onClick={handleLogout}>
              退出
            </span>
          }
          style={{
            "--height": "40px",
            "--border-bottom": "none",
            background: "transparent",
          }}
        >
          {/* 待办/已办切换 */}
          <div className="flex items-center justify-center gap-1">
            <button
              className={`px-4 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === "pending"
                  ? "bg-white text-blue-800"
                  : "bg-transparent text-white/90 border border-white/40"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              待办 ({mockDocuments.filter(d => d.status === "待办" || d.status === "在办" || d.status === "未批阅").length})
            </button>
            <button
              className={`px-4 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === "completed"
                  ? "bg-white text-blue-800"
                  : "bg-transparent text-white/90 border border-white/40"
              }`}
              onClick={() => setActiveTab("completed")}
            >
              已办 (0)
            </button>
          </div>
        </NavBar>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0">
        <SearchBar
          placeholder="搜索标题、提交人、关键词"
          value={searchText}
          onChange={setSearchText}
          style={{
            "--background": "#f1f5f9",
            "--border-radius": "8px",
            "--height": "32px",
            "--placeholder-color": "#94a3b8",
          }}
        />
      </div>

      {/* 主内容区：左侧分类 + 右侧列表 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左侧分类栏 */}
        <div className="w-16 bg-white border-r border-slate-200 flex flex-col shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`relative flex flex-col items-center justify-center py-3 px-1 transition-all ${
                activeCategory === cat.key
                  ? "bg-blue-50 text-blue-800 border-l-2 border-blue-800"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {/* 红点徽章 */}
              {cat.count > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1">
                  {cat.count}
                </span>
              )}
              <span className={`${activeCategory === cat.key ? "text-blue-800" : "text-slate-400"}`}>
                {cat.icon}
              </span>
              <span className="text-[10px] font-medium mt-1 leading-tight text-center whitespace-nowrap">
                {cat.title}
              </span>
            </button>
          ))}
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-y-auto bg-slate-100 min-h-0">
          {activeCategory === "transfer" ? (
            <FileTransferList activeTab={activeTab} searchText={searchText} />
          ) : filteredDocuments.length === 0 ? (
            <Empty description="暂无数据" style={{ padding: "48px 0" }} />
          ) : (
            <div className="p-2 space-y-2">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc)}
                  className="bg-white rounded-lg p-3 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                >
                  {/* 发文审签样式 */}
                  {activeCategory === "send" && (
                    <>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Tag
                          color={doc.flowColor as "warning" | "success" | "default"}
                          fill="outline"
                          style={{ fontSize: "10px", padding: "0 4px" }}
                        >
                          {doc.flowName}
                        </Tag>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${getStatusColor(doc.status)}15`,
                            color: getStatusColor(doc.status),
                          }}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <h3 className="font-medium text-slate-800 text-sm leading-snug mb-2 line-clamp-2">
                        {doc.title}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{doc.submitter}</span>
                        <span>{doc.submitTime}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        当前节点：<span className="text-blue-600">{doc.currentNode}</span>
                      </div>
                    </>
                  )}

                  {/* 公文办理样式 */}
                  {activeCategory === "process" && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${getStatusColor(doc.status)}15`,
                            color: getStatusColor(doc.status),
                          }}
                        >
                          {doc.status}
                        </span>
                        <span className="text-[11px] text-slate-400">{doc.submitTime}</span>
                      </div>
                      <h3 className="font-medium text-slate-800 text-sm leading-snug line-clamp-2">
                        {doc.title}
                      </h3>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default H5OfficialDocument;
