import { NavBar, Card, Tag, Button, Toast, Grid } from "antd-mobile";

interface FileTransferData {
  id: string;
  title: string;
  sendUnit: string;
  docNumber: string;
  securityLevel: string;
  urgency: string;
  contactPerson: string;
  contactPhone: string;
  documentDate: string;
  copies: number;
  signLeader: string;
  signDate: string;
  status: string;
}

interface FileTransferDetailProps {
  file: FileTransferData;
  onBack: () => void;
}

const FileTransferDetail = ({ file, onBack }: FileTransferDetailProps) => {
  const handleSign = () => {
    Toast.show({
      icon: "success",
      content: "签收成功",
    });
    onBack();
  };

  const getSecurityColor = (level: string) => {
    switch (level) {
      case "机密":
        return "danger";
      case "秘密":
        return "warning";
      default:
        return "default";
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "特急":
        return "danger";
      case "加急":
        return "warning";
      default:
        return "primary";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 顶部导航 */}
      <NavBar
        onBack={onBack}
        style={{
          "--height": "44px",
          "--border-bottom": "1px solid #e5e7eb",
          background: "#1e40af",
          color: "white",
        }}
        backIcon={<span className="text-white">←</span>}
      >
        <span className="text-white font-medium">文件详情</span>
      </NavBar>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 标题卡片 */}
        <Card className="rounded-xl shadow-sm">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="primary" fill="outline" style={{ fontSize: "11px" }}>
              {file.docNumber}
            </Tag>
            <Tag
              color={getSecurityColor(file.securityLevel) as "danger" | "warning" | "default"}
              fill="solid"
              style={{ fontSize: "11px" }}
            >
              {file.securityLevel}
            </Tag>
            {file.urgency !== "普通" && (
              <Tag
                color={getUrgencyColor(file.urgency) as "danger" | "warning" | "primary"}
                fill="solid"
                style={{ fontSize: "11px" }}
              >
                {file.urgency}
              </Tag>
            )}
            <Tag
              color={file.status === "待签收" ? "warning" : "success"}
              fill="outline"
              style={{ fontSize: "11px" }}
            >
              {file.status}
            </Tag>
          </div>
          <h2 className="text-base font-semibold text-slate-800 leading-relaxed">
            {file.title}
          </h2>
        </Card>

        {/* 基本信息卡片 */}
        <Card className="rounded-xl shadow-sm" title={<span className="text-sm font-medium text-slate-700">基本信息</span>}>
          <Grid columns={2} gap={12}>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">发文单位</div>
              <div className="text-sm text-slate-800">{file.sendUnit}</div>
            </Grid.Item>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">总份数</div>
              <div className="text-sm text-slate-800">{file.copies}份</div>
            </Grid.Item>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">成文日期</div>
              <div className="text-sm text-slate-800">{file.documentDate}</div>
            </Grid.Item>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">签发日期</div>
              <div className="text-sm text-slate-800">{file.signDate}</div>
            </Grid.Item>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">签发领导</div>
              <div className="text-sm text-slate-800">{file.signLeader}</div>
            </Grid.Item>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">密级</div>
              <div className="text-sm text-slate-800">{file.securityLevel}</div>
            </Grid.Item>
          </Grid>
        </Card>

        {/* 联系信息卡片 */}
        <Card className="rounded-xl shadow-sm" title={<span className="text-sm font-medium text-slate-700">联系信息</span>}>
          <Grid columns={2} gap={12}>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">联系人</div>
              <div className="text-sm text-slate-800">{file.contactPerson}</div>
            </Grid.Item>
            <Grid.Item>
              <div className="text-xs text-slate-500 mb-1">联系电话</div>
              <div className="text-sm text-blue-600">{file.contactPhone}</div>
            </Grid.Item>
          </Grid>
        </Card>
      </div>

      {/* 底部操作栏 */}
      {file.status === "待签收" && (
        <div className="p-3 bg-white border-t border-slate-200">
          <Button
            block
            color="primary"
            onClick={handleSign}
            style={{
              "--background-color": "#1e40af",
              "--border-color": "#1e40af",
              borderRadius: "8px",
            }}
          >
            确认签收
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileTransferDetail;
