import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar, Tabs, SearchBar, Badge, List, Tag, Empty, Skeleton } from "antd-mobile";
import { FileOutline, SendOutline, ReceivePaymentOutline } from "antd-mobile-icons";
import DocumentDetail from "@/components/h5/DocumentDetail";
import ProcessDocumentDetail from "@/components/h5/ProcessDocumentDetail";
import FileTransferList from "@/components/h5/FileTransferList";

// 模拟数据
const mockDocuments = [
  {
    id: "1",
    category: "send",
    flowName: "党委办公室发文流程(暂未开放)",
    flowColor: "warning",
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
    flowColor: "success",
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
    flowColor: "success",
    title: "审计报告审批流程",
    submitter: "昌吉党委运维人...",
    submitTime: "2025-09-04 18:06:08",
    currentNode: "核稿",
    status: "在办",
  },
  {
    id: "4",
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
    id: "5",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "测试发送附附附附",
    submitter: "张玉",
    submitTime: "2025-09-04 12:27:08",
    currentNode: "",
    status: "未批阅",
  },
  {
    id: "6",
    category: "process",
    flowName: "",
    flowColor: "",
    title: "无人陪审员司法案VS行政复暂行条例.ofd",
    submitter: "张玉",
    submitTime: "2025-08-27 16:34:29",
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
    { key: "send", title: "发文审签", icon: <SendOutline />, count: 3 },
    { key: "process", title: "公文办理", icon: <FileOutline />, count: 3 },
    { key: "transfer", title: "文件收发", icon: <ReceivePaymentOutline />, count: 0 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部导航 */}
      <NavBar
        backIcon={null}
        right={
          <span className="text-sm text-primary" onClick={handleLogout}>
            退出
          </span>
        }
        style={{
          "--height": "48px",
          borderBottom: "1px solid var(--adm-color-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{user?.name || "领导"}</span>
          <Tag color="primary" fill="outline" style={{ fontSize: "10px" }}>
            {user?.position || "领导"}
          </Tag>
        </div>
      </NavBar>

      {/* 待办/已办切换 */}
      <div className="px-4 py-3 bg-background">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-primary overflow-hidden">
            <button
              className={`px-8 py-2 text-sm font-medium transition-colors ${
                activeTab === "pending"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              待 办
            </button>
            <button
              className={`px-8 py-2 text-sm font-medium transition-colors ${
                activeTab === "completed"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
              onClick={() => setActiveTab("completed")}
            >
              已 办
            </button>
          </div>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="px-4 pb-3">
        <SearchBar
          placeholder="搜索文件标题或提交人"
          value={searchText}
          onChange={setSearchText}
          style={{
            "--background": "var(--adm-color-fill-content)",
            "--border-radius": "8px",
          }}
        />
      </div>

      {/* 分类Tabs */}
      <Tabs
        activeKey={activeCategory}
        onChange={setActiveCategory}
        style={{
          "--title-font-size": "14px",
          "--active-title-color": "var(--adm-color-primary)",
          "--active-line-color": "var(--adm-color-primary)",
        }}
      >
        {categories.map((cat) => (
          <Tabs.Tab
            key={cat.key}
            title={
              <Badge content={cat.count > 0 ? cat.count : null} style={{ "--right": "-8px" }}>
                <div className="flex items-center gap-1">
                  {cat.icon}
                  <span>{cat.title}</span>
                </div>
              </Badge>
            }
          />
        ))}
      </Tabs>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto bg-muted/30">
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
              >
                <div className="py-2">
                  {/* 发文审签样式 */}
                  {activeCategory === "send" && (
                    <>
                      <Tag
                        color={doc.flowColor as "warning" | "success" | "default"}
                        fill="solid"
                        style={{ marginBottom: "8px", fontSize: "11px" }}
                      >
                        {doc.flowName}
                      </Tag>
                      <div className="font-medium text-foreground text-sm leading-snug mb-2 line-clamp-2">
                        {doc.title}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>提交人：{doc.submitter}</span>
                          <span>节点：{doc.currentNode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{doc.submitTime}</span>
                          <Tag
                            color={doc.status === "待办" ? "danger" : "default"}
                            fill="outline"
                            style={{ fontSize: "10px" }}
                          >
                            {doc.status}
                          </Tag>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 公文办理样式 */}
                  {activeCategory === "process" && (
                    <>
                      <div className="font-medium text-foreground text-sm leading-snug mb-2 line-clamp-2">
                        {doc.title}
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{doc.submitTime}</span>
                        <Tag
                          color={doc.status === "未批阅" ? "warning" : "success"}
                          fill="outline"
                          style={{ fontSize: "10px" }}
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
  );
};

export default H5OfficialDocument;
