import { useState, useEffect, useRef } from "react";
import { Tag, Empty, FloatingBubble, Popup, Form, Input, Picker, TextArea, Button, DatePicker, Radio, Toast, CascadePicker, Dialog } from "antd-mobile";
import { AddOutline, AddCircleOutline, CloseCircleFill, DeleteOutline } from "antd-mobile-icons";
import { format } from "date-fns";
import FileTransferDetail from "./FileTransferDetail";
import { supabase } from "@/integrations/supabase/client";

interface FileTransferListProps {
  activeTab: "pending" | "completed";
  searchText: string;
}

interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
  children?: Organization[];
}

// 文件收发数据类型
interface FileTransferData {
  id: string;
  title: string;
  sendUnit: string;
  sendUnitId?: string;
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
  attachments?: { name: string; url: string }[];
}

// 选项配置 - 更新为标准四级密级
const securityLevelOptions = [
  [
    { label: "机密", value: "机密" },
    { label: "秘密", value: "秘密" },
    { label: "内部", value: "内部" },
    { label: "公开", value: "公开" },
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
  const [fileTransfers, setFileTransfers] = useState<FileTransferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileTransferData | null>(null);
  const [securityVisible, setSecurityVisible] = useState(false);
  const [urgencyVisible, setUrgencyVisible] = useState(false);
  const [fileTypeVisible, setFileTypeVisible] = useState(false);
  const [sendTypeVisible, setSendTypeVisible] = useState(false);
  const [documentDateVisible, setDocumentDateVisible] = useState(false);
  const [signDateVisible, setSignDateVisible] = useState(false);
  const [orgPickerVisible, setOrgPickerVisible] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgCascadeOptions, setOrgCascadeOptions] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    sendUnit: "",
    sendUnitId: "",
    docNumber: "",
    securityLevel: ["公开"],
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

  // 加载文件收发数据
  const fetchFileTransfers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("file_transfers")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      const mappedData: FileTransferData[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        sendUnit: item.send_unit,
        sendUnitId: item.send_unit_id,
        docNumber: item.doc_number,
        securityLevel: item.security_level,
        urgency: item.urgency,
        contactPerson: item.contact_person || "",
        contactPhone: item.contact_phone || "",
        documentDate: item.document_date || "",
        copies: item.copies || 1,
        signLeader: item.sign_leader || "",
        signDate: item.sign_date || "",
        status: item.status,
        attachments: item.attachments || [],
      }));
      setFileTransfers(mappedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFileTransfers();
  }, []);

  // 加载组织架构
  useEffect(() => {
    const fetchOrganizations = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("sort_order", { ascending: true });
      
      if (!error && data) {
        setOrganizations(data);
        // 转换为级联选择器格式
        const cascadeOptions = buildCascadeOptions(data);
        setOrgCascadeOptions(cascadeOptions);
      }
    };
    fetchOrganizations();
  }, []);

  // 构建级联选择器选项
  const buildCascadeOptions = (orgs: Organization[]): any[] => {
    const buildTree = (parentId: string | null): any[] => {
      return orgs
        .filter(org => org.parent_id === parentId)
        .map(org => {
          const children = buildTree(org.id);
          return {
            label: org.name,
            value: org.id,
            children: children.length > 0 ? children : undefined,
          };
        });
    };
    return buildTree(null);
  };

  // 根据ID查找组织名称
  const getOrgNameById = (id: string): string => {
    const org = organizations.find(o => o.id === id);
    return org?.name || "";
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)]);
    }
    // 重置input以便可以再次选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 移除已上传的文件
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const filteredFiles = fileTransfers.filter((file) => {
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

  const resetForm = () => {
    setFormData({
      title: "",
      sendUnit: "",
      sendUnitId: "",
      docNumber: "",
      securityLevel: ["公开"],
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
    setUploadedFiles([]);
  };

  // 上传文件到存储
  const uploadFilesToStorage = async (): Promise<{ name: string; url: string }[]> => {
    const uploadedAttachments: { name: string; url: string }[] = [];
    
    for (const file of uploadedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('file-transfers')
        .upload(filePath, file);
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('file-transfers')
          .getPublicUrl(filePath);
        
        uploadedAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
        });
      }
    }
    
    return uploadedAttachments;
  };

  const handleSubmit = async () => {
    // 验证必填字段
    if (!formData.title.trim()) {
      Toast.show({ icon: "fail", content: "请输入文件标题" });
      return;
    }
    if (!formData.sendUnit.trim()) {
      Toast.show({ icon: "fail", content: "请选择发文单位" });
      return;
    }
    if (!formData.docNumber.trim()) {
      Toast.show({ icon: "fail", content: "请输入发文字号" });
      return;
    }

    setSubmitting(true);
    
    try {
      // 上传附件
      const attachments = await uploadFilesToStorage();
      
      // 插入数据库
      const { error } = await supabase
        .from("file_transfers")
        .insert({
          title: formData.title,
          send_unit: formData.sendUnit,
          send_unit_id: formData.sendUnitId || null,
          doc_number: formData.docNumber,
          security_level: formData.securityLevel[0],
          urgency: formData.urgency[0],
          source_unit: formData.sourceUnit || null,
          send_type: formData.sendType[0],
          contact_person: formData.contactPerson || null,
          contact_phone: formData.contactPhone || null,
          document_date: format(formData.documentDate, "yyyy-MM-dd"),
          copies: parseInt(formData.copies) || 1,
          confidential_period: formData.confidentialPeriod || null,
          main_unit: formData.mainUnit || null,
          sign_leader: formData.signLeader || null,
          sign_date: format(formData.signDate, "yyyy-MM-dd"),
          file_type: formData.fileType[0],
          notify_type: formData.notifyType,
          copy_unit: formData.copyUnit || null,
          description: formData.description || null,
          status: "待签收",
          attachments: attachments,
        });

      if (error) {
        Toast.show({ icon: "fail", content: "保存失败：" + error.message });
        return;
      }

      Toast.show({ icon: "success", content: "新增成功" });
      resetForm();
      setShowAddPopup(false);
      // 重新加载数据
      fetchFileTransfers();
    } catch (err) {
      Toast.show({ icon: "fail", content: "保存失败" });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除文件收发记录
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const result = await Dialog.confirm({
      content: "确定要删除这条记录吗？",
      confirmText: "删除",
      cancelText: "取消",
    });
    
    if (result) {
      const { error } = await supabase
        .from("file_transfers")
        .delete()
        .eq("id", id);
      
      if (error) {
        Toast.show({ icon: "fail", content: "删除失败" });
      } else {
        Toast.show({ icon: "success", content: "删除成功" });
        fetchFileTransfers();
      }
    }
  };

  const updateFormData = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // 获取密级标签颜色
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

  // 处理从详情页返回
  const handleBackFromDetail = () => {
    setSelectedFile(null);
    // 刷新列表以获取最新状态
    fetchFileTransfers();
  };

  // 如果选中了文件，显示详情页
  if (selectedFile) {
    return (
      <FileTransferDetail
        file={selectedFile}
        onBack={handleBackFromDetail}
      />
    );
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-slate-500">加载中...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <Empty description="暂无文件" style={{ padding: "48px 0" }} />
      ) : (
        <div className="p-2 space-y-2">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => setSelectedFile(file)}
              className="bg-white rounded-lg p-3 shadow-sm active:bg-slate-50 transition-colors cursor-pointer relative"
            >
              {/* 删除按钮 */}
              <button
                onClick={(e) => handleDelete(file.id, e)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500"
              >
                <DeleteOutline fontSize={16} />
              </button>
              
              {/* 标签行 */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap pr-8">
                <Tag color="primary" fill="outline" style={{ fontSize: "10px", padding: "0 4px" }}>
                  {file.docNumber}
                </Tag>
                <Tag
                  color={getSecurityColor(file.securityLevel) as "danger" | "warning" | "default"}
                  fill="solid"
                  style={{ fontSize: "10px", padding: "0 4px" }}
                >
                  {file.securityLevel}
                </Tag>
                {file.urgency !== "普通" && file.urgency !== "无" && (
                  <Tag color="danger" fill="solid" style={{ fontSize: "10px", padding: "0 4px" }}>
                    {file.urgency}
                  </Tag>
                )}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded ml-auto"
                  style={{
                    backgroundColor: file.status === "待签收" ? "#fef3c715" : "#dcfce715",
                    color: file.status === "待签收" ? "#f59e0b" : "#16a34a",
                  }}
                >
                  {file.status}
                </span>
              </div>

              {/* 标题 */}
              <h3 className="font-medium text-slate-800 text-sm leading-snug mb-2 line-clamp-2">
                {file.title}
              </h3>

              {/* 信息行 */}
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{file.sendUnit}</span>
                <span>{file.signDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增按钮 */}
      <FloatingBubble
        style={{
          "--initial-position-bottom": "24px",
          "--initial-position-right": "24px",
          "--edge-distance": "24px",
          "--background": "#1e40af",
        }}
        onClick={() => setShowAddPopup(true)}
      >
        <AddOutline fontSize={24} color="white" />
      </FloatingBubble>

      {/* 新增弹窗 */}
      <Popup
        visible={showAddPopup}
        onMaskClick={() => setShowAddPopup(false)}
        position="right"
        bodyStyle={{ width: "100vw", height: "100vh", overflow: "auto" }}
      >
        <div className="min-h-screen bg-slate-50">
          {/* 头部 - 红色背景 */}
          <div className="sticky top-0 z-10 bg-red-700 text-white px-4 py-3 flex items-center justify-between">
            <span className="font-medium">新增文件</span>
            <div className="flex gap-2">
              <Button
                size="mini"
                onClick={() => {
                  resetForm();
                  setShowAddPopup(false);
                }}
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
                loading={submitting}
                disabled={submitting}
              >
                确定
              </Button>
            </div>
          </div>

          {/* 表单 */}
          <Form layout="horizontal" style={{ "--prefix-width": "5.5em" }}>
            <Form.Item label="文件标题" required>
              <Input
                placeholder="请输入"
                value={formData.title}
                onChange={(v) => updateFormData("title", v)}
              />
            </Form.Item>

            <Form.Item 
              label="发文单位" 
              required
              onClick={() => setOrgPickerVisible(true)}
            >
              <Input
                placeholder="请选择组织"
                value={formData.sendUnit}
                readOnly
              />
            </Form.Item>
            <CascadePicker
              options={orgCascadeOptions}
              visible={orgPickerVisible}
              onClose={() => setOrgPickerVisible(false)}
              onConfirm={(value) => {
                if (value && value.length > 0) {
                  const lastId = value[value.length - 1] as string;
                  updateFormData("sendUnitId", lastId);
                  updateFormData("sendUnit", getOrgNameById(lastId));
                }
              }}
            />

            <Form.Item label="发文字号" required>
              <Input
                placeholder="请输入"
                value={formData.docNumber}
                onChange={(v) => updateFormData("docNumber", v)}
              />
            </Form.Item>

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

            <Form.Item label="来文单位">
              <Input
                placeholder="请输入"
                value={formData.sourceUnit}
                onChange={(v) => updateFormData("sourceUnit", v)}
              />
            </Form.Item>

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

            <Form.Item label="联系人">
              <Input
                placeholder="请输入"
                value={formData.contactPerson}
                onChange={(v) => updateFormData("contactPerson", v)}
              />
            </Form.Item>

            <Form.Item label="联系电话">
              <Input
                placeholder="请输入"
                value={formData.contactPhone}
                onChange={(v) => updateFormData("contactPhone", v)}
              />
            </Form.Item>

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

            <Form.Item label="总份数">
              <Input
                type="number"
                placeholder="请输入"
                value={formData.copies}
                onChange={(v) => updateFormData("copies", v)}
              />
            </Form.Item>

            <Form.Item label="保密期限">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="请输入"
                  value={formData.confidentialPeriod}
                  onChange={(v) => updateFormData("confidentialPeriod", v)}
                  style={{ flex: 1 }}
                />
                <span className="text-slate-500 text-sm">年</span>
              </div>
            </Form.Item>

            <Form.Item label="主送单位">
              <Input
                placeholder="请输入"
                value={formData.mainUnit}
                onChange={(v) => updateFormData("mainUnit", v)}
              />
            </Form.Item>

            <Form.Item label="签发领导">
              <Input
                placeholder="请输入"
                value={formData.signLeader}
                onChange={(v) => updateFormData("signLeader", v)}
              />
            </Form.Item>

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

            <Form.Item label="消息通知">
              <Radio.Group
                value={formData.notifyType}
                onChange={(v) => updateFormData("notifyType", v as string)}
              >
                <Radio value="通知" style={{ marginRight: "16px" }}>通知</Radio>
                <Radio value="不通知">不通知</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="抄送单位">
              <Input
                placeholder="请输入"
                value={formData.copyUnit}
                onChange={(v) => updateFormData("copyUnit", v)}
              />
            </Form.Item>

            <Form.Item label="发文说明">
              <TextArea
                placeholder="请输入"
                rows={3}
                value={formData.description}
                onChange={(v) => updateFormData("description", v)}
              />
            </Form.Item>

            {/* 文件上传区域 */}
            <Form.Item label="上传附件">
              <div className="space-y-2">
                {/* 已上传的文件列表 */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedFiles.map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between bg-slate-100 rounded px-2 py-1.5"
                      >
                        <span className="text-xs text-slate-700 truncate flex-1 mr-2">
                          {file.name}
                        </span>
                        <CloseCircleFill 
                          className="text-slate-400 flex-shrink-0 cursor-pointer"
                          fontSize={16}
                          onClick={() => removeFile(index)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 添加文件按钮 */}
                <div 
                  className="flex items-center justify-center gap-1 border border-dashed border-slate-300 rounded py-3 cursor-pointer active:bg-slate-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <AddCircleOutline className="text-blue-600" fontSize={18} />
                  <span className="text-sm text-blue-600">添加文件</span>
                </div>
                
                {/* 隐藏的文件input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </>
  );
};

export default FileTransferList;
