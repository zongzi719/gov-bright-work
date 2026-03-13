import { Toast } from "antd-mobile";
import { LeftOutline, LinkOutline } from "antd-mobile-icons";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";

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
  attachments?: { name: string; url: string }[];
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
    void logAudit({
      action: AUDIT_ACTIONS.APPROVE,
      module: AUDIT_MODULES.MOBILE_DOC,
      target_type: '文件签收',
      target_id: file.id,
      target_name: file.title,
      detail: { doc_number: file.docNumber },
    });
    // 确保调用 onBack
    if (onBack && typeof onBack === 'function') {
      onBack();
    }
  };

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 确保调用 onBack
    if (onBack && typeof onBack === 'function') {
      onBack();
    }
  };

  // 打开附件
  const openAttachment = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* 顶部导航 - 简洁白色背景 */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center h-11 px-3">
          <button 
            type="button"
            onClick={handleBackClick}
            className="flex items-center justify-center w-8 h-8 -ml-1 rounded-full hover:bg-slate-100 active:bg-slate-200 z-10"
          >
            <LeftOutline className="text-slate-600 text-lg" />
          </button>
          <span className="flex-1 text-center text-sm font-medium text-slate-800 -ml-8">文件详情</span>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {/* 标题卡片 */}
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500 text-blue-600">
              {file.docNumber}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${
              file.securityLevel === "机密" ? "bg-red-500" : 
              file.securityLevel === "秘密" ? "bg-amber-500" : 
              file.securityLevel === "内部" ? "bg-blue-500" : "bg-slate-400"
            }`}>
              {file.securityLevel}
            </span>
            {file.urgency !== "普通" && file.urgency !== "无" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${
                file.urgency === "特急" ? "bg-red-500" : "bg-amber-500"
              }`}>
                {file.urgency}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              file.status === "待签收" 
                ? "bg-amber-50 text-amber-600 border border-amber-200" 
                : "bg-green-50 text-green-600 border border-green-200"
            }`}>
              {file.status}
            </span>
          </div>
          <h2 className="text-sm font-medium text-slate-800 leading-relaxed">
            {file.title}
          </h2>
        </div>

        {/* 基本信息卡片 */}
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs font-medium text-slate-700 mb-2 pb-1.5 border-b border-slate-100">基本信息</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <div className="text-[10px] text-slate-400">发文单位</div>
              <div className="text-xs text-slate-700">{file.sendUnit}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">总份数</div>
              <div className="text-xs text-slate-700">{file.copies}份</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">成文日期</div>
              <div className="text-xs text-slate-700">{file.documentDate || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">签发日期</div>
              <div className="text-xs text-slate-700">{file.signDate || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">签发领导</div>
              <div className="text-xs text-slate-700">{file.signLeader || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">密级</div>
              <div className="text-xs text-slate-700">{file.securityLevel}</div>
            </div>
          </div>
        </div>

        {/* 联系信息卡片 */}
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-xs font-medium text-slate-700 mb-2 pb-1.5 border-b border-slate-100">联系信息</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <div className="text-[10px] text-slate-400">联系人</div>
              <div className="text-xs text-slate-700">{file.contactPerson || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">联系电话</div>
              {file.contactPhone ? (
                <a href={`tel:${file.contactPhone}`} className="text-xs text-blue-600">{file.contactPhone}</a>
              ) : (
                <span className="text-xs text-slate-700">-</span>
              )}
            </div>
          </div>
        </div>

        {/* 附件列表卡片 */}
        {file.attachments && file.attachments.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="text-xs font-medium text-slate-700 mb-2 pb-1.5 border-b border-slate-100">
              附件 ({file.attachments.length})
            </div>
            <div className="space-y-2">
              {file.attachments.map((attachment, index) => (
                <div 
                  key={index}
                  onClick={() => openAttachment(attachment.url)}
                  className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100 active:bg-slate-200"
                >
                  <LinkOutline className="text-blue-600 flex-shrink-0" fontSize={16} />
                  <span className="text-xs text-slate-700 truncate flex-1">{attachment.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      {file.status === "待签收" && (
        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <button
            onClick={handleSign}
            className="w-full h-10 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            确认签收
          </button>
        </div>
      )}
    </div>
  );
};

export default FileTransferDetail;
