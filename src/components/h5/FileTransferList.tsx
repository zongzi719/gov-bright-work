import { useState } from "react";
import { List, Tag, Empty, FloatingBubble, Popup, Form, Input, Picker, TextArea, Button, DatePicker, Radio, Toast } from "antd-mobile";
import { AddOutline } from "antd-mobile-icons";
import { format } from "date-fns";

interface FileTransferListProps {
  activeTab: "pending" | "completed";
  searchText: string;
}

// 模拟文件收发数据
const mockFileTransfers = [
  {
    id: "1",
    title: "关于加强党风廉政建设的通知",
    sendUnit: "纪检监察室",
    docNumber: "党纪〔2025〕1号",
    securityLevel: "机密",
    urgency: "特急",
    contactPerson: "王磊",
    contactPhone: "13800138001",
    documentDate: "2025-01-15",
    copies: 50,
    signLeader: "李主任",
    signDate: "2025-01-16",
    status: "待签收",
  },
  {
    id: "2",
    title: "2025年度工作计划汇报",
    sendUnit: "办公室",
    docNumber: "办发〔2025〕5号",
    securityLevel: "内部",
    urgency: "普通",
    contactPerson: "张华",
    contactPhone: "13800138002",
    documentDate: "2025-01-10",
    copies: 30,
    signLeader: "赵局长",
    signDate: "2025-01-12",
    status: "待签收",
  },
  {
    id: "3",
    title: "关于召开年度总结会议的通知",
    sendUnit: "综合科",
    docNumber: "综发〔2025〕3号",
    securityLevel: "一般",
    urgency: "普通",
    contactPerson: "刘明",
    contactPhone: "13800138003",
    documentDate: "2025-01-08",
    copies: 20,
    signLeader: "王主任",
    signDate: "2025-01-09",
    status: "已签收",
  },
];

// 选项配置
const securityLevelOptions = [
  [
    { label: "机密", value: "机密" },
    { label: "秘密", value: "秘密" },
    { label: "内部", value: "内部" },
    { label: "一般", value: "一般" },
  ],
];

const urgencyOptions = [
  [
    { label: "特急", value: "特急" },
    { label: "加急", value: "加急" },
    { label: "普通", value: "普通" },
    { label: "无", value: "无" },
  ],
];

const fileTypeOptions = [
  [
    { label: "中央文件", value: "中央文件" },
    { label: "省级文件", value: "省级文件" },
    { label: "市级文件", value: "市级文件" },
    { label: "本单位文件", value: "本单位文件" },
  ],
];

const sendTypeOptions = [
  [
    { label: "不限制份数", value: "不限制份数" },
    { label: "限制份数", value: "限制份数" },
  ],
];

const FileTransferList = ({ activeTab, searchText }: FileTransferListProps) => {
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [securityVisible, setSecurityVisible] = useState(false);
  const [urgencyVisible, setUrgencyVisible] = useState(false);
  const [fileTypeVisible, setFileTypeVisible] = useState(false);
  const [sendTypeVisible, setSendTypeVisible] = useState(false);
  const [documentDateVisible, setDocumentDateVisible] = useState(false);
  const [signDateVisible, setSignDateVisible] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    sendUnit: "",
    docNumber: "",
    securityLevel: ["内部"],
    urgency: ["普通"],
    sourceUnit: "",
    sendType: ["不限制份数"],
    contactPerson: "",
    contactPhone: "",
    documentDate: new Date(),
    copies: "",
    confidentialPeriod: "",
    mainUnit: "",
    signLeader: "",
    signDate: new Date(),
    fileType: ["中央文件"],
    notifyType: "不通知",
    copyUnit: "",
    description: "",
  });

  const filteredFiles = mockFileTransfers.filter((file) => {
    const matchTab =
      activeTab === "pending"
        ? file.status === "待签收"
        : file.status === "已签收";
    const matchSearch =
      searchText === "" ||
      file.title.includes(searchText) ||
      file.sendUnit.includes(searchText);
    return matchTab && matchSearch;
  });

  const handleSubmit = () => {
    Toast.show({
      icon: "success",
      content: "提交成功",
    });
    setShowAddPopup(false);
  };

  const updateFormData = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      {filteredFiles.length === 0 ? (
        <Empty description="暂无文件" style={{ padding: "64px 0" }} />
      ) : (
        <List style={{ "--border-top": "none", "--border-bottom": "none" }}>
          {filteredFiles.map((file) => (
            <List.Item
              key={file.id}
              arrow={false}
            >
              <div className="py-2">
                {/* 文号和密级 */}
                <div className="flex items-center gap-2 mb-2">
                  <Tag color="primary" fill="outline" style={{ fontSize: "10px" }}>
                    {file.docNumber}
                  </Tag>
                  <Tag
                    color={
                      file.securityLevel === "机密"
                        ? "danger"
                        : file.securityLevel === "秘密"
                        ? "warning"
                        : "default"
                    }
                    fill="solid"
                    style={{ fontSize: "10px" }}
                  >
                    {file.securityLevel}
                  </Tag>
                  {file.urgency !== "普通" && (
                    <Tag color="danger" fill="solid" style={{ fontSize: "10px" }}>
                      {file.urgency}
                    </Tag>
                  )}
                </div>

                {/* 标题 */}
                <div className="font-medium text-foreground text-sm leading-snug mb-2 line-clamp-2">
                  {file.title}
                </div>

                {/* 详情 */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>发文单位：{file.sendUnit}</span>
                    <span>份数：{file.copies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      联系人：{file.contactPerson} {file.contactPhone}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>签发：{file.signLeader} ({file.signDate})</span>
                    <Tag
                      color={file.status === "待签收" ? "warning" : "success"}
                      fill="outline"
                      style={{ fontSize: "10px" }}
                    >
                      {file.status}
                    </Tag>
                  </div>
                </div>
              </div>
            </List.Item>
          ))}
        </List>
      )}

      {/* 新增按钮 */}
      <FloatingBubble
        style={{
          "--initial-position-bottom": "24px",
          "--initial-position-right": "24px",
          "--edge-distance": "24px",
        }}
        onClick={() => setShowAddPopup(true)}
      >
        <AddOutline fontSize={24} />
      </FloatingBubble>

      {/* 新增弹窗 */}
      <Popup
        visible={showAddPopup}
        onMaskClick={() => setShowAddPopup(false)}
        position="right"
        bodyStyle={{ width: "100vw", height: "100vh", overflow: "auto" }}
      >
        <div className="min-h-screen bg-background">
          {/* 头部 */}
          <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
            <span className="font-medium">新增文件</span>
            <div className="flex gap-2">
              <Button
                size="mini"
                onClick={() => setShowAddPopup(false)}
                style={{
                  "--background-color": "transparent",
                  "--border-color": "rgba(255,255,255,0.5)",
                  "--text-color": "white",
                }}
              >
                取消
              </Button>
              <Button
                size="mini"
                color="default"
                onClick={handleSubmit}
              >
                确定
              </Button>
            </div>
          </div>

          {/* 表单 */}
          <Form layout="horizontal" style={{ "--prefix-width": "5.5em" }}>
            {/* 文件标题 */}
            <Form.Item label="文件标题" required>
              <Input
                placeholder="请输入"
                value={formData.title}
                onChange={(v) => updateFormData("title", v)}
              />
            </Form.Item>

            {/* 发文单位 */}
            <Form.Item label="发文单位" required>
              <Input
                placeholder="请输入"
                value={formData.sendUnit}
                onChange={(v) => updateFormData("sendUnit", v)}
              />
            </Form.Item>

            {/* 发文字号 */}
            <Form.Item label="发文字号" required>
              <Input
                placeholder="请输入"
                value={formData.docNumber}
                onChange={(v) => updateFormData("docNumber", v)}
              />
            </Form.Item>

            {/* 密级 */}
            <Form.Item
              label="密级"
              required
              onClick={() => setSecurityVisible(true)}
            >
              <Input
                placeholder="请选择"
                value={formData.securityLevel[0]}
                readOnly
              />
            </Form.Item>
            <Picker
              columns={securityLevelOptions}
              visible={securityVisible}
              onClose={() => setSecurityVisible(false)}
              value={formData.securityLevel}
              onConfirm={(v) => updateFormData("securityLevel", v)}
            />

            {/* 紧急程度 */}
            <Form.Item
              label="紧急程度"
              onClick={() => setUrgencyVisible(true)}
            >
              <Input
                placeholder="请选择"
                value={formData.urgency[0]}
                readOnly
              />
            </Form.Item>
            <Picker
              columns={urgencyOptions}
              visible={urgencyVisible}
              onClose={() => setUrgencyVisible(false)}
              value={formData.urgency}
              onConfirm={(v) => updateFormData("urgency", v)}
            />

            {/* 来文单位 */}
            <Form.Item label="来文单位">
              <Input
                placeholder="请输入"
                value={formData.sourceUnit}
                onChange={(v) => updateFormData("sourceUnit", v)}
              />
            </Form.Item>

            {/* 发件类型 */}
            <Form.Item
              label="发件类型"
              required
              onClick={() => setSendTypeVisible(true)}
            >
              <Input
                placeholder="请选择"
                value={formData.sendType[0]}
                readOnly
              />
            </Form.Item>
            <Picker
              columns={sendTypeOptions}
              visible={sendTypeVisible}
              onClose={() => setSendTypeVisible(false)}
              value={formData.sendType}
              onConfirm={(v) => updateFormData("sendType", v)}
            />

            {/* 联系人 */}
            <Form.Item label="联系人">
              <Input
                placeholder="请输入"
                value={formData.contactPerson}
                onChange={(v) => updateFormData("contactPerson", v)}
              />
            </Form.Item>

            {/* 联系电话 */}
            <Form.Item label="联系电话">
              <Input
                placeholder="请输入"
                value={formData.contactPhone}
                onChange={(v) => updateFormData("contactPhone", v)}
              />
            </Form.Item>

            {/* 成文日期 */}
            <Form.Item
              label="成文日期"
              onClick={() => setDocumentDateVisible(true)}
            >
              <Input
                placeholder="请选择"
                value={format(formData.documentDate, "yyyy-MM-dd")}
                readOnly
              />
            </Form.Item>
            <DatePicker
              visible={documentDateVisible}
              onClose={() => setDocumentDateVisible(false)}
              value={formData.documentDate}
              onConfirm={(v) => updateFormData("documentDate", v)}
            />

            {/* 总份数 */}
            <Form.Item label="总份数">
              <Input
                type="number"
                placeholder="请输入"
                value={formData.copies}
                onChange={(v) => updateFormData("copies", v)}
              />
            </Form.Item>

            {/* 保密期限 */}
            <Form.Item label="保密期限">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="请输入"
                  value={formData.confidentialPeriod}
                  onChange={(v) => updateFormData("confidentialPeriod", v)}
                  style={{ flex: 1 }}
                />
                <span className="text-muted-foreground text-sm">年</span>
              </div>
            </Form.Item>

            {/* 主送单位 */}
            <Form.Item label="主送单位">
              <Input
                placeholder="请输入"
                value={formData.mainUnit}
                onChange={(v) => updateFormData("mainUnit", v)}
              />
            </Form.Item>

            {/* 签发领导 */}
            <Form.Item label="签发领导">
              <Input
                placeholder="请输入"
                value={formData.signLeader}
                onChange={(v) => updateFormData("signLeader", v)}
              />
            </Form.Item>

            {/* 签发日期 */}
            <Form.Item
              label="签发日期"
              onClick={() => setSignDateVisible(true)}
            >
              <Input
                placeholder="请选择"
                value={format(formData.signDate, "yyyy-MM-dd")}
                readOnly
              />
            </Form.Item>
            <DatePicker
              visible={signDateVisible}
              onClose={() => setSignDateVisible(false)}
              value={formData.signDate}
              onConfirm={(v) => updateFormData("signDate", v)}
            />

            {/* 文件类型 */}
            <Form.Item
              label="文件类型"
              onClick={() => setFileTypeVisible(true)}
            >
              <Input
                placeholder="请选择"
                value={formData.fileType[0]}
                readOnly
              />
            </Form.Item>
            <Picker
              columns={fileTypeOptions}
              visible={fileTypeVisible}
              onClose={() => setFileTypeVisible(false)}
              value={formData.fileType}
              onConfirm={(v) => updateFormData("fileType", v)}
            />

            {/* 消息通知 */}
            <Form.Item label="消息通知">
              <Radio.Group
                value={formData.notifyType}
                onChange={(v) => updateFormData("notifyType", v as string)}
              >
                <Radio value="通知" style={{ marginRight: "16px" }}>通知</Radio>
                <Radio value="不通知">不通知</Radio>
              </Radio.Group>
            </Form.Item>

            {/* 抄送单位 */}
            <Form.Item label="抄送单位">
              <Input
                placeholder="请输入"
                value={formData.copyUnit}
                onChange={(v) => updateFormData("copyUnit", v)}
              />
            </Form.Item>

            {/* 发文说明 */}
            <Form.Item label="发文说明">
              <TextArea
                placeholder="请输入"
                rows={3}
                value={formData.description}
                onChange={(v) => updateFormData("description", v)}
              />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </>
  );
};

export default FileTransferList;
