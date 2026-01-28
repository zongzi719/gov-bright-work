import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar, SearchBar, Badge, List, Tag, Empty, Skeleton } from "antd-mobile";
import { FileOutline, SendOutline, ReceivePaymentOutline } from "antd-mobile-icons";
import DocumentDetail from "@/components/h5/DocumentDetail";
import ProcessDocumentDetail from "@/components/h5/ProcessDocumentDetail";
import FileTransferList from "@/components/h5/FileTransferList";

// 更真实的模拟数据
const mockDocuments = [
  {
    id: "1",
    category: "send",
    flowName: "党委办公室发文流程(暂未开放)",
    flowColor: "warning",
    title: "关于印发《2025年度党风廉政建设工作要点》的通知",
    submitter: "黄思艺",
    submitTime: "2025-11-17 10:44:53",
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
    submitTime: "2025-09-04 18:53:43",
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
    submitTime: "2025-09-04 18:06:08",
    currentNode: "核稿",
    status: "在办",
  },
  {
    id: "4",
    category: "send",
    flowName: "党委办公室发文流程(暂未开放)",
    flowColor: "warning",
    title: "关于调整领导班子成员分工的通知",
    submitter: "王秀英",
    submitTime: "2025-08-15 09:30:22",
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
    submitTime: "2025-09-04 12:31:54",
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
    submitTime: "2025-09-04 12:27:08",
    currentNode: "",
    status: "未批阅",
  },
  {
    id: "7",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "中华人民共和国行政复议法实施条例(修订稿)",
    submitter: "张玉",
    submitTime: "2025-08-27 16:34:29",
    currentNode: "",
    status: "未批阅",
  },
  {
    id: "8",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "关于进一步加强基层治理体系和治理能力现代化建设的意见",
    submitter: "陈伟",
    submitTime: "2025-08-25 14:20:15",
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
      <div className="min-h-screen bg-background p-4">
        <Skeleton.Title animated />
        <Skeleton.Paragraph lineCount={5} animated />
      </div>
    );
  }

  // 分类配置
  const categories = [
    { key: "send", title: "发文审签", icon: <SendOutline fontSize={20} />, count: 4 },
    { key: "process", title: "公文办理", icon: <FileOutline fontSize={20} />, count: 4 },
    { key: "transfer", title: "文件收发", icon: <ReceivePaymentOutline fontSize={20} />, count: 2 },
  ];

  return (
    <div className="min-h-screen bg-[#8B7355] flex flex-col">
      {/* 顶部导航 */}
      <NavBar
        backIcon={<span className="text-white text-lg">←</span>}
        onBack={() => navigate(-1)}
        right={
          <span className="text-sm text-white/80" onClick={handleLogout}>
            退出
          </span>
        }
        style={{
          "--height": "44px",
          "--border-bottom": "none",
          background: "transparent",
        }}
      >
        {/* 待办/已办切换 */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full overflow-hidden border border-amber-400">
            <button
              className={`px-6 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white"
                  : "bg-transparent text-white"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              待 办
            </button>
            <button
              className={`px-6 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "completed"
                  ? "bg-amber-500 text-white"
                  : "bg-transparent text-white"
              }`}
              onClick={() => setActiveTab("completed")}
            >
              已 办
            </button>
          </div>
        </div>
      </NavBar>

      {/* 搜索框 */}
      <div className="px-3 py-2">
        <SearchBar
          placeholder="请输入搜索内容"
          value={searchText}
          onChange={setSearchText}
          style={{
            "--background": "rgba(255,255,255,0.15)",
            "--border-radius": "20px",
            "--height": "36px",
            "--placeholder-color": "rgba(255,255,255,0.6)",
          }}
        />
      </div>

      {/* 主内容区：左侧分类 + 右侧列表 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧分类栏 */}
        <div className="w-20 bg-[#7A6548] flex flex-col py-2">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex flex-col items-center gap-1 py-4 px-2 relative transition-colors ${
                activeCategory === cat.key
                  ? "bg-[#F5F0E8] text-amber-700"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              {/* 红点徽章 */}
              {cat.count > 0 && (
                <span className="absolute top-2 right-3 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                  {cat.count}
                </span>
              )}
              <span className="text-xl">{cat.icon}</span>
              <span className="text-xs font-medium leading-tight text-center">
                {cat.title}
              </span>
            </button>
          ))}
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 bg-[#F5F0E8] overflow-y-auto">
          {activeCategory === "transfer" ? (
            <FileTransferList activeTab={activeTab} searchText={searchText} />
          ) : filteredDocuments.length === 0 ? (
            <Empty description="暂无数据" style={{ padding: "64px 0" }} />
          ) : (
            <List style={{ "--border-top": "none", "--border-bottom": "none" }}>
              {filteredDocuments.map((doc) => (
                <List.Item
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc)}
                  arrow={false}
                  style={{ 
                    padding: "12px", 
                    borderBottom: "8px solid #E8E0D0",
                    background: "#fff"
                  }}
                >
                  <div>
                    {/* 发文审签样式 */}
                    {activeCategory === "send" && (
                      <>
                        <Tag
                          color={doc.flowColor as "warning" | "success" | "default"}
                          fill="solid"
                          style={{ marginBottom: "8px", fontSize: "12px" }}
                        >
                          {doc.flowName}
                        </Tag>
                        <div className="font-medium text-foreground text-sm leading-relaxed mb-3">
                          {doc.title}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-2">
                          <div className="flex justify-between">
                            <span>提交人：{doc.submitter}</span>
                            <span>提交时间：{doc.submitTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>当前节点：{doc.currentNode}</span>
                            <span>状态：{doc.status}</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* 公文办理样式 */}
                    {activeCategory === "process" && (
                      <>
                        <div className="font-medium text-foreground text-sm leading-relaxed mb-3">
                          {doc.title}
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{doc.submitTime}</span>
                          <Tag
                            color={doc.status === "未批阅" ? "warning" : "success"}
                            fill="outline"
                            style={{ fontSize: "11px" }}
                          >
                            {doc.status}
                          </Tag>
                        </div>
                      </>
                    )}
                  </div>
                </List.Item>
              ))}
            </List>
          )}
        </div>
      </div>
    </div>
  );
};

export default H5OfficialDocument;
