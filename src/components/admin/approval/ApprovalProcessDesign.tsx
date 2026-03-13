import { useState, useEffect, useRef, useCallback } from "react";
import * as dataAdapter from "@/lib/dataAdapter";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  User, 
  Trash2,
  UserCheck,
  Send,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  GitBranch,
  X,
  ChevronDown,
  Check,
  Clock,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import ConditionConfig from "./process-design/ConditionConfig";

// 字段权限类型
type FieldPermission = "editable" | "readonly" | "hidden";

interface FieldPermissions {
  [fieldName: string]: FieldPermission;
}

interface ApprovalNode {
  id: string;
  template_id: string;
  node_type: string;
  node_name: string;
  approver_type: string;
  approver_ids: string[] | null;
  sort_order: number;
  condition_expression: any;
  field_permissions?: FieldPermissions;
  approval_mode?: string; // 'countersign' 会签 | 'or_sign' 或签
}

interface FormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type?: string;
  is_required: boolean;
}

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
}

interface ProcessVersion {
  id: string;
  template_id: string;
  version_number: number;
  version_name: string;
  published_by: string | null;
  published_at: string;
  nodes_snapshot: any;
  is_current: boolean;
  notes: string | null;
}

interface ApprovalProcessDesignProps {
  templateId: string;
}

const nodeTypeConfig = {
  approver: { 
    icon: UserCheck, 
    label: "审批人", 
    headerColor: "bg-orange-500",
    headerTextColor: "text-white"
  },
  cc: { 
    icon: Send, 
    label: "抄送人", 
    headerColor: "bg-blue-500",
    headerTextColor: "text-white"
  },
  condition: {
    icon: GitBranch,
    label: "条件分支",
    headerColor: "bg-green-500",
    headerTextColor: "text-white"
  },
  condition_branch: {
    icon: GitBranch,
    label: "条件",
    headerColor: "bg-gray-100",
    headerTextColor: "text-gray-700"
  }
};

const approverTypeLabels: Record<string, string> = {
  specific: "指定成员",
  role: "指定角色",
  supervisor: "直属主管",
  department_head: "部门负责人",
  self: "发起人自选",
};

// 分支布局类型
type BranchLayout = "left" | "center";

// 节点类型选择器弹窗
interface NodeTypeSelectorProps {
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelect: (type: string) => void;
}

const NodeTypeSelector = ({ open, position, onClose, onSelect }: NodeTypeSelectorProps) => {
  if (!open) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      {/* 选择器弹窗 */}
      <div 
        className="fixed z-50 bg-white rounded-lg shadow-xl border p-4 w-72"
        style={{ 
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, 0)'
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">选择节点类型</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* 人工节点 */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-2">人工节点</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelect('approver')}
              className="flex items-center gap-2 p-3 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">审批人</span>
            </button>
            <button
              onClick={() => onSelect('cc')}
              className="flex items-center gap-2 p-3 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Send className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">抄送人</span>
            </button>
          </div>
        </div>

        {/* 分支节点 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">分支节点</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelect('condition')}
              className="flex items-center gap-2 p-3 rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">条件分支</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ApprovalProcessDesign = ({ templateId }: ApprovalProcessDesignProps) => {
  const [nodes, setNodes] = useState<ApprovalNode[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ApprovalNode | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState("approver");
  
  // 版本管理状态
  const [versions, setVersions] = useState<ProcessVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ProcessVersion | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("");
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  // 画布状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // 节点类型选择器
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);
  const [typeSelectorPosition, setTypeSelectorPosition] = useState({ x: 0, y: 0 });

  // 条件分支布局选择器
  const [branchLayoutSelectorOpen, setBranchLayoutSelectorOpen] = useState(false);
  const [branchLayoutPosition, setBranchLayoutPosition] = useState({ x: 0, y: 0 });

  // 分支内添加节点选择器
  const [branchNodeSelectorOpen, setBranchNodeSelectorOpen] = useState(false);
  const [branchNodeSelectorPosition, setBranchNodeSelectorPosition] = useState({ x: 0, y: 0 });
  const [branchNodeSelectorContext, setBranchNodeSelectorContext] = useState<{ branchNode: ApprovalNode; afterNodeId: string | null } | null>(null);
  
  const [nodeForm, setNodeForm] = useState({
    node_type: "approver",
    node_name: "",
    approver_type: "self",
    approver_ids: [] as string[],
    field_permissions: {} as FieldPermissions,
    condition_expression: null as any,
    approval_mode: "countersign", // 默认会签
  });

  useEffect(() => {
    const initializeData = async () => {
      await fetchNodes();
      await fetchContacts();
      await fetchFormFields();
      await fetchVersions();
    };
    initializeData();
  }, [templateId]);

  // 规范化节点以进行比较（只保留关键字段，忽略时间戳等非关键字段）
  const normalizeNodesForComparison = useCallback((nodeList: ApprovalNode[]): string => {
    const normalized = nodeList.map(node => ({
      id: node.id,
      node_type: node.node_type,
      node_name: node.node_name,
      approver_type: node.approver_type,
      approver_ids: node.approver_ids,
      sort_order: node.sort_order,
      condition_expression: node.condition_expression,
      field_permissions: node.field_permissions,
      approval_mode: node.approval_mode,
    }));
    return JSON.stringify(normalized);
  }, []);

  // 检测节点变化
  useEffect(() => {
    // 跳过首次加载
    if (isFirstLoad) return;
    
    const currentSnapshot = normalizeNodesForComparison(nodes);
    
    // 情况1：从未发布过任何版本 - 只要有节点就认为有变化（需要首次发布）
    if (versions.length === 0) {
      setHasChanges(nodes.length > 0);
      return;
    }
    
    // 情况2：已发布过版本 - 比较当前节点与最后发布的快照
    if (lastSavedSnapshot && currentSnapshot !== lastSavedSnapshot) {
      setHasChanges(true);
    } else if (lastSavedSnapshot && currentSnapshot === lastSavedSnapshot) {
      setHasChanges(false);
    }
  }, [nodes, lastSavedSnapshot, isFirstLoad, versions.length, normalizeNodesForComparison]);
  
  // 判断是否为未发布状态：没有发布过任何版本，或者有修改
  const isUnpublishedState = versions.length === 0 || hasChanges;
  
  // 计算是否显示发布按钮：未发布状态 且 有节点
  const shouldShowPublishButton = isUnpublishedState && nodes.length > 0;

  // 获取版本列表
  const fetchVersions = async () => {
    const { data, error } = await dataAdapter.getAllApprovalProcessVersions(templateId);

    if (!error && data) {
      const versionList = data as ProcessVersion[];
      setVersions(versionList);
      const currentVersion = versionList.find(v => v.is_current);
      if (currentVersion) {
        setSelectedVersion(currentVersion);
        // 如果有当前版本，以其快照为基准（使用规范化比较）
        const snapshotNodes = currentVersion.nodes_snapshot as ApprovalNode[];
        setLastSavedSnapshot(normalizeNodesForComparison(snapshotNodes));
      } else {
        // 没有当前版本，清空快照
        setLastSavedSnapshot("");
      }
    }
    setIsFirstLoad(false);
  };

  // 发布新版本
  const handlePublishVersion = async () => {
    if (nodes.length === 0) {
      toast.error("请先添加流程节点");
      return;
    }

    setPublishing(true);
    
    // 获取当前最大版本号
    const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) : 0;
    const newVersionNumber = maxVersion + 1;

    // 将所有版本设为非当前
    await dataAdapter.setVersionsNotCurrent(templateId);

    // 创建新版本
    const { data: newVersion, error } = await dataAdapter.createApprovalProcessVersion({
      template_id: templateId,
      version_number: newVersionNumber,
      version_name: `流程版本V${newVersionNumber}`,
      published_by: "admin",
      nodes_snapshot: nodes,
      is_current: true,
    });

    if (error || !newVersion) {
      toast.error("发布版本失败");
      setPublishing(false);
      return;
    }

    // 更新模板的当前版本（忽略 current_version_id 字段，只更新支持的字段）
    // Note: current_version_id 在离线模式下不需要更新

    toast.success(`已发布版本 V${newVersionNumber}`);
    
    // 先更新快照，确保 hasChanges 变为 false（使用规范化比较）
    const currentSnapshot = normalizeNodesForComparison(nodes);
    setLastSavedSnapshot(currentSnapshot);
    setHasChanges(false);
    
    // 构建新版本对象
    const newVersionObj: ProcessVersion = {
      id: (newVersion as any).id,
      template_id: templateId,
      version_number: newVersionNumber,
      version_name: `流程版本V${newVersionNumber}`,
      published_by: "admin",
      published_at: new Date().toISOString(),
      nodes_snapshot: nodes,
      is_current: true,
      notes: null,
    };
    
    // 更新版本列表
    const updatedVersions = [
      newVersionObj,
      ...versions.map(v => ({ ...v, is_current: false }))
    ];
    setVersions(updatedVersions);
    // 发布后选中刚发布的版本
    setSelectedVersion(newVersionObj);
    
    setPublishing(false);
  };

  // 切换版本（仅查看）
  const handleSelectVersion = async (version: ProcessVersion) => {
    setSelectedVersion(version);
    setVersionDropdownOpen(false);
    
    // 如果是当前版本，显示实际节点
    if (version.is_current) {
      await fetchNodes();
    } else {
      // 显示快照数据（只读）
      setNodes(version.nodes_snapshot as ApprovalNode[]);
    }
  };

  const fetchFormFields = async () => {
    const { data } = await dataAdapter.getApprovalFormFields(templateId);
    setFormFields((data as FormField[]) || []);
  };

  const fetchContacts = async () => {
    const { data } = await dataAdapter.getContacts({ is_active: true });
    setContacts(data || []);
  };

  const fetchNodes = async () => {
    setLoading(true);
    const { data, error } = await dataAdapter.getApprovalNodes(templateId);

    if (error) {
      toast.error("获取流程节点失败");
      setLoading(false);
      return;
    }
    const fetchedNodes = (data as ApprovalNode[]) || [];
    setNodes(fetchedNodes);
    setLoading(false);
  };

  // 画布拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    // 检查是否点击在节点上
    const target = e.target as HTMLElement;
    if (target.closest('.flow-node') || target.closest('.add-node-btn') || target.closest('button')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 缩放控制
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // 点击添加按钮
  const handleAddClick = (e: React.MouseEvent, afterIndex: number) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTypeSelectorPosition({ 
      x: rect.left + rect.width / 2, 
      y: rect.bottom + 8 
    });
    setInsertAfterIndex(afterIndex);
    setTypeSelectorOpen(true);
  };

  // 选择节点类型后
  const handleSelectNodeType = (type: string) => {
    setTypeSelectorOpen(false);
    
    // 如果是条件分支，显示布局选择器
    if (type === 'condition') {
      setBranchLayoutPosition(typeSelectorPosition);
      setBranchLayoutSelectorOpen(true);
      return;
    }
    
    const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig];
    setNodeForm({
      node_type: type,
      node_name: config?.label || "",
      approver_type: type === 'condition' ? 'specific' : 'self',
      approver_ids: [],
      field_permissions: {},
      condition_expression: null,
      approval_mode: "countersign",
    });
    // 先保存节点，然后打开详情面板
    handleSaveNewNode(type);
  };

  // 选择分支布局后创建条件分支
  const handleSelectBranchLayout = async (layout: BranchLayout) => {
    setBranchLayoutSelectorOpen(false);
    await handleCreateConditionBranch(layout);
  };

  // 创建条件分支及其子节点
  const handleCreateConditionBranch = async (layout: BranchLayout) => {
    // 计算新节点的 sort_order
    let baseSortOrder: number;
    if (insertAfterIndex === -1) {
      baseSortOrder = nodes.length > 0 ? nodes[0].sort_order - 10 : 10;
    } else if (insertAfterIndex >= nodes.length) {
      baseSortOrder = nodes.length > 0 ? nodes[nodes.length - 1].sort_order + 10 : 10;
    } else {
      const currentOrder = nodes[insertAfterIndex].sort_order;
      const nextOrder = insertAfterIndex + 1 < nodes.length 
        ? nodes[insertAfterIndex + 1].sort_order 
        : currentOrder + 30;
      baseSortOrder = Math.floor((currentOrder + nextOrder) / 2);
    }
    
    // 创建主条件分支节点
    const { data: conditionNode, error: conditionError } = await dataAdapter.createApprovalNode({
      template_id: templateId,
      node_type: 'condition',
      node_name: '条件分支',
      approver_type: 'specific',
      approver_ids: [],
      sort_order: baseSortOrder,
      condition_expression: { layout, branches: [] },
    });

    if (conditionError || !conditionNode) {
      toast.error("添加条件分支失败");
      return;
    }

    // 如果是"左侧"布局，需要将后续节点移动到第一个分支下
    // 获取插入点之后的所有节点（排除条件分支子节点）
    const nodesAfterInsertion = layout === 'left'
      ? nodes.filter(n => {
          // 只获取 sort_order 大于当前位置的节点
          if (n.sort_order <= baseSortOrder) return false;
          // 排除条件分支子节点
          if (n.node_type === 'condition_branch') return false;
          return true;
        })
      : [];

    // 创建两个分支子节点
    const branches = [
      { name: '条件1', is_default: false },
      { name: '默认条件', is_default: true },
    ];

    const branchIds: string[] = [];
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      
      // 对于左侧布局，第一个分支包含后续节点的引用
      const childNodeIds = (layout === 'left' && i === 0) 
        ? nodesAfterInsertion.map(n => n.id) 
        : [];
      
      const { data: branchNode, error: branchError } = await dataAdapter.createApprovalNode({
        template_id: templateId,
        node_type: 'condition_branch',
        node_name: branch.name,
        approver_type: 'specific',
        approver_ids: [],
        sort_order: baseSortOrder + i + 1,
        condition_expression: { 
          parent_id: (conditionNode as any).id,
          is_default: branch.is_default,
          condition_groups: [],
          child_nodes: childNodeIds,
        },
      });

      if (!branchError && branchNode) {
        branchIds.push((branchNode as any).id);
      }
    }

    // 更新主节点的分支引用
    await dataAdapter.updateApprovalNode((conditionNode as any).id, {
      condition_expression: { layout, branches: branchIds },
    });

    // 如果是左侧布局，将后续节点的 sort_order 调整到分支之后，确保它们在第一个分支下显示
    if (layout === 'left' && nodesAfterInsertion.length > 0) {
      // 更新后续节点的 sort_order，使它们在分支节点范围内
      let newOrder = baseSortOrder + 10;
      for (const node of nodesAfterInsertion) {
        await dataAdapter.updateApprovalNode(node.id, { sort_order: newOrder });
        newOrder += 10;
      }
    }
    
    toast.success("条件分支添加成功");
    await fetchNodes();
  };

  // 保存新节点
  const handleSaveNewNode = async (type: string) => {
    const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig];
    
    // 计算新节点的 sort_order
    let newSortOrder: number;
    if (insertAfterIndex === -1) {
      newSortOrder = nodes.length > 0 ? nodes[0].sort_order - 1 : 1;
    } else if (insertAfterIndex >= nodes.length) {
      newSortOrder = nodes.length > 0 ? nodes[nodes.length - 1].sort_order + 1 : 1;
    } else {
      const currentOrder = nodes[insertAfterIndex].sort_order;
      const nextOrder = insertAfterIndex + 1 < nodes.length 
        ? nodes[insertAfterIndex + 1].sort_order 
        : currentOrder + 2;
      newSortOrder = Math.floor((currentOrder + nextOrder) / 2);
      
      if (newSortOrder === currentOrder || newSortOrder === nextOrder) {
        const updates = nodes.map((n, i) => ({
          id: n.id,
          sort_order: (i + 1) * 10,
        }));
        for (const update of updates) {
          await dataAdapter.updateApprovalNode(update.id, { sort_order: update.sort_order });
        }
        newSortOrder = (insertAfterIndex + 1) * 10 + 5;
      }
    }
    
    const { data, error } = await dataAdapter.createApprovalNode({
      template_id: templateId,
      node_type: type,
      node_name: config?.label || "",
      approver_type: type === 'condition' ? 'specific' : 'self',
      approver_ids: [],
      sort_order: newSortOrder,
    });

    if (error) {
      toast.error("添加节点失败");
      return;
    }
    
    toast.success("节点添加成功");
    await fetchNodes();
    
    // 打开详情面板编辑新节点
    if (data) {
      setSelectedNode(data as ApprovalNode);
      setNodeForm({
        node_type: type,
        node_name: config?.label || "",
        approver_type: type === 'condition' ? 'specific' : 'self',
        approver_ids: [],
        field_permissions: {},
        condition_expression: null,
        approval_mode: "countersign",
      });
      setDetailPanelOpen(true);
    }
  };

  // 点击节点打开详情
  const handleNodeClick = (node: ApprovalNode) => {
    setSelectedNode(node);
    // 抄送节点默认所有字段只读
    let permissions = node.field_permissions || {};
    if (node.node_type === 'cc') {
      // 确保所有字段为只读
      formFields.forEach(field => {
        permissions[field.field_name] = 'readonly';
      });
    }
    setNodeForm({
      node_type: node.node_type,
      node_name: node.node_name,
      approver_type: node.approver_type,
      approver_ids: node.approver_ids || [],
      field_permissions: permissions,
      condition_expression: node.condition_expression || null,
      approval_mode: node.approval_mode || "countersign",
    });
    setActiveTab("approver");
    setDetailPanelOpen(true);
  };

  // 更新字段权限
  const handleFieldPermissionChange = (fieldName: string, permission: FieldPermission) => {
    // 抄送节点不允许修改权限
    if (nodeForm.node_type === 'cc') return;
    
    setNodeForm(prev => ({
      ...prev,
      field_permissions: {
        ...prev.field_permissions,
        [fieldName]: permission,
      },
    }));
  };

  // 保存节点详情
  const handleSaveNodeDetail = async () => {
    if (!selectedNode) return;
    
    if (!nodeForm.node_name) {
      toast.error("请填写节点名称");
      return;
    }

    // 对于条件分支节点，不需要验证审批人
    if (nodeForm.node_type !== 'condition' && nodeForm.node_type !== 'condition_branch') {
      if (nodeForm.approver_type === "specific" && nodeForm.approver_ids.length === 0) {
        toast.error("请选择至少一个审批人");
        return;
      }
    }

    const updateData: any = {
      node_name: nodeForm.node_name,
    };

    // 非条件节点更新审批人相关信息
    if (nodeForm.node_type !== 'condition' && nodeForm.node_type !== 'condition_branch') {
      updateData.approver_type = nodeForm.approver_type;
      updateData.approver_ids = nodeForm.approver_ids;
      updateData.field_permissions = nodeForm.field_permissions;
      // 审批人节点更新审批方式
      if (nodeForm.node_type === 'approver') {
        updateData.approval_mode = nodeForm.approval_mode;
      }
    }

    // 条件分支节点更新条件表达式
    if (nodeForm.node_type === 'condition_branch' && nodeForm.condition_expression) {
      updateData.condition_expression = nodeForm.condition_expression;
    }

    const { error } = await dataAdapter.updateApprovalNode(selectedNode.id, updateData);

    if (error) {
      toast.error("更新节点失败");
      return;
    }
    toast.success("节点更新成功");
    setDetailPanelOpen(false);
    fetchNodes();
  };

  const handleDeleteNode = async (id: string) => {
    if (!confirm("确定要删除这个节点吗？")) return;

    const { error } = await dataAdapter.deleteApprovalNode(id);

    if (error) {
      toast.error("删除节点失败");
      return;
    }
    toast.success("节点已删除");
    setDetailPanelOpen(false);
    setSelectedNode(null);
    fetchNodes();
  };

  const toggleApprover = (contactId: string) => {
    if (nodeForm.approver_ids.includes(contactId)) {
      setNodeForm({
        ...nodeForm,
        approver_ids: nodeForm.approver_ids.filter(id => id !== contactId),
      });
    } else {
      setNodeForm({
        ...nodeForm,
        approver_ids: [...nodeForm.approver_ids, contactId],
      });
    }
  };

  const getContactName = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    return contact?.name || id;
  };

  const getApproverDisplay = (node: ApprovalNode) => {
    if (node.approver_type === "specific" && node.approver_ids && node.approver_ids.length > 0) {
      return node.approver_ids.map(id => getContactName(id)).join(", ");
    }
    return approverTypeLabels[node.approver_type] || "未设置";
  };

  // 判断是否在查看历史版本 - 需要在 AddNodeButton 之前定义
  const isViewingHistoricVersion = selectedVersion && !selectedVersion.is_current;

  // 添加节点按钮组件
  const AddNodeButton = ({ afterIndex }: { afterIndex: number }) => {
    // 历史版本模式下隐藏添加按钮
    if (isViewingHistoricVersion) {
      return (
        <div className="flex flex-col items-center add-node-btn">
          <div className="w-px h-6 bg-border" />
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center add-node-btn">
        <div className="w-px h-6 bg-border" />
        <button
          onClick={(e) => handleAddClick(e, afterIndex)}
          className="w-7 h-7 rounded-full border-2 border-primary bg-background flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors group z-10"
        >
          <Plus className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
        </button>
        <div className="w-px h-6 bg-border" />
      </div>
    );
  };

  // 快速删除节点 (从画布上)
  const handleQuickDeleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个节点吗？")) return;

    // 检查是否为条件分支主节点，如果是，删除其子分支
    const node = nodes.find(n => n.id === nodeId);
    if (node?.node_type === 'condition') {
      const branchIds = (node.condition_expression as any)?.branches || [];
      for (const branchId of branchIds) {
        await dataAdapter.deleteApprovalNode(branchId);
      }
    }

    const { error } = await dataAdapter.deleteApprovalNode(nodeId);

    if (error) {
      toast.error("删除节点失败");
      return;
    }
    toast.success("节点已删除");
    fetchNodes();
  };

  // 删除单个条件分支
  const handleDeleteSingleBranch = async (e: React.MouseEvent, branchNode: ApprovalNode, parentNode: ApprovalNode) => {
    e.stopPropagation();
    
    const branchIds = (parentNode.condition_expression as any)?.branches || [];
    const layout = (parentNode.condition_expression as any)?.layout || 'center';
    
    // 如果只剩2个分支，删除整个分支组
    if (branchIds.length <= 2) {
      if (!confirm("删除此分支将删除整个条件分支组，确定要删除吗？")) return;
      
      // 删除所有分支子节点
      for (const branchId of branchIds) {
        await dataAdapter.deleteApprovalNode(branchId);
      }
      
      // 删除主节点
      await dataAdapter.deleteApprovalNode(parentNode.id);
      
      toast.success("条件分支已删除");
      fetchNodes();
      return;
    }
    
    // 如果还有超过2个分支，只删除当前分支
    if (!confirm("确定要删除这个条件分支吗？")) return;
    
    // 从父节点的分支列表中移除
    const newBranchIds = branchIds.filter((id: string) => id !== branchNode.id);
    
    // 更新父节点
    await dataAdapter.updateApprovalNode(parentNode.id, {
      condition_expression: { layout, branches: newBranchIds },
    });
    
    // 删除分支节点
    await dataAdapter.deleteApprovalNode(branchNode.id);
    
    toast.success("条件分支已删除");
    fetchNodes();
  };

  // 在分支内添加节点
  const handleAddNodeInBranch = async (e: React.MouseEvent, branchNode: ApprovalNode, afterNodeId: string | null, type: string) => {
    const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig];
    const branchExpression = branchNode.condition_expression as any;
    const childNodeIds = branchExpression?.child_nodes || [];
    
    // 计算新节点的 sort_order
    let newSortOrder: number;
    if (afterNodeId === null) {
      // 在分支开始处添加
      const firstChildNode = nodes.find(n => childNodeIds[0] === n.id);
      newSortOrder = firstChildNode 
        ? firstChildNode.sort_order - 5 
        : branchNode.sort_order + 5;
    } else {
      // 在某个节点后添加
      const afterNode = nodes.find(n => n.id === afterNodeId);
      const afterIndex = childNodeIds.indexOf(afterNodeId);
      const nextNodeId = childNodeIds[afterIndex + 1];
      const nextNode = nodes.find(n => n.id === nextNodeId);
      
      if (afterNode && nextNode) {
        newSortOrder = Math.floor((afterNode.sort_order + nextNode.sort_order) / 2);
      } else if (afterNode) {
        newSortOrder = afterNode.sort_order + 5;
      } else {
        newSortOrder = branchNode.sort_order + 5;
      }
    }
    
    // 创建新节点
    const { data: newNode, error } = await dataAdapter.createApprovalNode({
      template_id: templateId,
      node_type: type,
      node_name: config?.label || "",
      approver_type: type === 'condition' ? 'specific' : 'self',
      approver_ids: [],
      sort_order: newSortOrder,
    });

    if (error || !newNode) {
      toast.error("添加节点失败");
      return;
    }
    
    // 更新分支的 child_nodes
    let newChildNodeIds: string[];
    if (afterNodeId === null) {
      newChildNodeIds = [(newNode as any).id, ...childNodeIds];
    } else {
      const afterIndex = childNodeIds.indexOf(afterNodeId);
      newChildNodeIds = [
        ...childNodeIds.slice(0, afterIndex + 1),
        (newNode as any).id,
        ...childNodeIds.slice(afterIndex + 1),
      ];
    }
    
    await dataAdapter.updateApprovalNode(branchNode.id, {
      condition_expression: {
        ...branchExpression,
        child_nodes: newChildNodeIds,
      },
    });
    
    toast.success("节点添加成功");
    await fetchNodes();
    
    // 打开详情面板
    setSelectedNode(newNode as ApprovalNode);
    setNodeForm({
      node_type: type,
      node_name: config?.label || "",
      approver_type: type === 'condition' ? 'specific' : 'self',
      approver_ids: [],
      field_permissions: {},
      condition_expression: null,
      approval_mode: "countersign",
    });
    setDetailPanelOpen(true);
  };

  // 流程节点卡片组件 - 使用 CSS hover 代替 useState
  const FlowNodeCard = ({ node }: { node: ApprovalNode }) => {
    const config = nodeTypeConfig[node.node_type as keyof typeof nodeTypeConfig] || nodeTypeConfig.approver;
    const Icon = config.icon;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div 
        className={`flow-node group relative w-72 bg-background rounded-lg shadow-md border-2 overflow-visible cursor-pointer transition-all ${
          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50'
        }`}
        onClick={() => handleNodeClick(node)}
      >
        {/* 删除按钮 - 使用 CSS group-hover, 历史版本模式下隐藏 */}
        {node.node_type !== 'condition_branch' && !isViewingHistoricVersion && (
          <button
            onClick={(e) => handleQuickDeleteNode(e, node.id)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90 transition-all opacity-0 group-hover:opacity-100 z-20"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        
        <div className={`${config.headerColor} ${config.headerTextColor} px-4 py-2 flex items-center gap-2 rounded-t-md`}>
          <Icon className="w-4 h-4" />
          <span className="font-medium text-sm">{node.node_name || config.label}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted-foreground truncate">
              {node.node_type === 'condition' ? '添加条件' : 
               node.node_type === 'condition_branch' ? (
                 (node.condition_expression as any)?.is_default ? '其他条件进入此流程' : '请设置条件'
               ) : getApproverDisplay(node)}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    );
  };

  // 添加新条件分支到现有条件组
  const handleAddConditionToBranch = async (parentNode: ApprovalNode) => {
    const branchIds = (parentNode.condition_expression as any)?.branches || [];
    const layout = (parentNode.condition_expression as any)?.layout || 'center';
    const branchNodes = nodes.filter(n => branchIds.includes(n.id));
    
    // 找到默认条件的索引
    const defaultIndex = branchNodes.findIndex(n => (n.condition_expression as any)?.is_default);
    const nonDefaultCount = branchNodes.filter(n => !(n.condition_expression as any)?.is_default).length;
    
    // 新条件的 sort_order 应该在默认条件之前
    const baseSortOrder = parentNode.sort_order + nonDefaultCount + 1;
    
    // 创建新的条件分支
    const { data: newBranch, error } = await dataAdapter.createApprovalNode({
      template_id: templateId,
      node_type: 'condition_branch',
      node_name: `条件${nonDefaultCount + 2}`,
      approver_type: 'specific',
      approver_ids: [],
      sort_order: baseSortOrder,
      condition_expression: { 
        parent_id: parentNode.id,
        is_default: false,
        condition_groups: [],
        child_nodes: [],
      },
    });

    if (error || !newBranch) {
      toast.error("添加条件失败");
      return;
    }

    // 更新默认条件的 sort_order
    const defaultBranch = branchNodes.find(n => (n.condition_expression as any)?.is_default);
    if (defaultBranch) {
      await dataAdapter.updateApprovalNode(defaultBranch.id, { sort_order: baseSortOrder + 1 });
    }

    // 将新分支插入到默认条件之前
    const newBranchIds = [...branchIds];
    if (defaultIndex !== -1) {
      newBranchIds.splice(defaultIndex, 0, (newBranch as any).id);
    } else {
      newBranchIds.push((newBranch as any).id);
    }

    // 更新父节点的分支列表
    await dataAdapter.updateApprovalNode(parentNode.id, {
      condition_expression: { layout, branches: newBranchIds },
    });

    toast.success("条件添加成功");
    await fetchNodes();
  };

  // 分支内添加节点按钮 - 使用共享状态避免 hooks 问题
  const BranchAddNodeButton = ({ branchNode, afterNodeId }: { branchNode: ApprovalNode; afterNodeId: string | null }) => {
    // 历史版本模式下隐藏添加按钮
    if (isViewingHistoricVersion) {
      return (
        <div className="flex flex-col items-center add-node-btn">
          <div className="w-px h-6 bg-border" />
        </div>
      );
    }
    
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setBranchNodeSelectorPosition({ 
        x: rect.left + rect.width / 2, 
        y: rect.bottom + 8 
      });
      setBranchNodeSelectorContext({ branchNode, afterNodeId });
      setBranchNodeSelectorOpen(true);
    };

    return (
      <div className="flex flex-col items-center add-node-btn">
        <div className="w-px h-6 bg-border" />
        <button
          onClick={handleClick}
          className="w-7 h-7 rounded-full border-2 border-primary bg-background flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors group z-10"
        >
          <Plus className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
        </button>
        <div className="w-px h-6 bg-border" />
      </div>
    );
  };

  // 处理分支内节点类型选择
  const handleBranchNodeTypeSelect = (type: string) => {
    setBranchNodeSelectorOpen(false);
    if (branchNodeSelectorContext) {
      handleAddNodeInBranch(
        { stopPropagation: () => {} } as React.MouseEvent,
        branchNodeSelectorContext.branchNode,
        branchNodeSelectorContext.afterNodeId,
        type
      );
    }
    setBranchNodeSelectorContext(null);
  };

  // 条件分支组件
  const ConditionBranchGroup = ({ parentNode }: { parentNode: ApprovalNode }) => {
    const branchIds = (parentNode.condition_expression as any)?.branches || [];
    const layout = (parentNode.condition_expression as any)?.layout || 'center';
    // 按照 branchIds 顺序获取分支节点，确保顺序一致
    const branchNodes = branchIds
      .map((id: string) => nodes.find(n => n.id === id))
      .filter(Boolean) as ApprovalNode[];

    return (
      <div className="relative">
        {/* 添加条件按钮 - 历史版本模式下隐藏 */}
        {!isViewingHistoricVersion && (
          <div className="flex justify-center mb-2">
            <button
              onClick={() => handleAddConditionToBranch(parentNode)}
              className="px-4 py-1 text-sm text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
            >
              添加条件
            </button>
          </div>
        )}

        {/* 分支容器 */}
        <div className={`flex ${layout === 'left' ? 'justify-start' : 'justify-center'} gap-8`}>
          {branchNodes.map((branch, idx) => {
            const isDefault = (branch.condition_expression as any)?.is_default;
            const conditionGroups = (branch.condition_expression as any)?.condition_groups || [];
            const hasConditions = conditionGroups.length > 0 && conditionGroups.some((g: any) => g.conditions?.length > 0);
            const childNodeIds = (branch.condition_expression as any)?.child_nodes || [];
            
            // 获取分支下的子节点，按照 childNodeIds 顺序排序
            const childNodes = childNodeIds
              .map((id: string) => nodes.find(n => n.id === id))
              .filter(Boolean) as ApprovalNode[];
            
            // 生成条件摘要
            const getConditionSummary = () => {
              if (isDefault) return '其他条件进入此流程';
              if (!hasConditions) return '请设置条件';
              
              const groupCount = conditionGroups.length;
              const conditionCount = conditionGroups.reduce((acc: number, g: any) => acc + (g.conditions?.length || 0), 0);
              return `${groupCount}个条件组，${conditionCount}个条件`;
            };
            
            return (
              <div key={branch.id} className="flex flex-col items-center">
                {/* 连接线顶部 */}
                <div className="w-px h-4 bg-border" />
                
                {/* 分支卡片 - 带删除按钮 */}
                <div className="relative group">
                  {/* 分支删除按钮 - 历史版本模式下隐藏 */}
                  {!isViewingHistoricVersion && (
                    <button
                      onClick={(e) => handleDeleteSingleBranch(e, branch, parentNode)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90 transition-all opacity-0 group-hover:opacity-100 z-20"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  
                  <div 
                    className="flow-node w-56 bg-background rounded-lg shadow-md border-2 border-border overflow-hidden cursor-pointer hover:border-muted-foreground/50 transition-all"
                    onClick={() => handleNodeClick(branch)}
                  >
                    <div className="px-4 py-2 border-b bg-muted/50">
                      <span className={`text-sm font-medium ${isDefault ? 'text-muted-foreground' : 'text-primary'}`}>
                        {isDefault ? '默认条件' : branch.node_name}
                        {isDefault && (
                          <span className="ml-1 text-xs text-muted-foreground">ⓘ</span>
                        )}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <div className={`text-sm ${hasConditions ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {getConditionSummary()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 分支下的子节点 - 使用分支内专用的添加按钮 */}
                {childNodes.length > 0 ? (
                  <div className="flex flex-col items-center">
                    {childNodes.map((childNode, childIdx) => (
                      <div key={childNode.id} className="flex flex-col items-center">
                        <BranchAddNodeButton 
                          branchNode={branch} 
                          afterNodeId={childIdx === 0 ? null : childNodes[childIdx - 1].id} 
                        />
                        <FlowNodeCard node={childNode} />
                      </div>
                    ))}
                    {/* 最后一个节点后的添加按钮 */}
                    <BranchAddNodeButton 
                      branchNode={branch} 
                      afterNodeId={childNodes[childNodes.length - 1].id} 
                    />
                  </div>
                ) : (
                  /* 没有子节点时的添加按钮 */
                  <BranchAddNodeButton branchNode={branch} afterNodeId={null} />
                )}
              </div>
            );
          })}
        </div>

        {/* 汇聚线 */}
        <div className="flex justify-center">
          <div className="w-px h-4 bg-border" />
        </div>
      </div>
    );
  };

  // 获取所有被移动到分支下的节点ID（用于过滤主流程中的重复显示）
  const getChildNodeIds = (): string[] => {
    const childIds: string[] = [];
    nodes.forEach(node => {
      if (node.node_type === 'condition_branch') {
        const ids = (node.condition_expression as any)?.child_nodes || [];
        childIds.push(...ids);
      }
    });
    return childIds;
  };

  const childNodeIdsToExclude = getChildNodeIds();

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="relative h-full min-h-[calc(100vh-300px)] bg-muted/50 rounded-xl overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-3">
        {/* 版本下拉选择器 */}
        <Popover open={versionDropdownOpen} onOpenChange={setVersionDropdownOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              {isUnpublishedState ? (
                <>
                  <span className="text-foreground">未发布版本</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    设计中
                  </Badge>
                </>
              ) : selectedVersion ? (
                <span className="text-foreground">{selectedVersion.version_name}</span>
              ) : (
                <span>选择版本</span>
              )}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="max-h-80 overflow-auto">
              {/* 未发布版本（设计中）- 没有版本时显示，或者有修改时显示 */}
              {isUnpublishedState && (
                <div 
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted border-b bg-primary/10"
                  onClick={() => {
                    setVersionDropdownOpen(false);
                    fetchNodes();
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">未发布版本</span>
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        设计中
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{versions.length === 0 ? "尚未发布" : "正在编辑"}</span>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
              
              {/* 已发布版本列表 */}
              {versions.map((version) => {
                // 如果处于未发布状态，所有版本都不选中
                // 否则选中当前选中的版本
                const isSelected = isUnpublishedState ? false : (selectedVersion?.id === version.id);
                return (
                  <div 
                    key={version.id}
                    className={`flex items-center gap-2 p-3 cursor-pointer hover:bg-muted border-b ${isSelected ? 'bg-primary/10' : ''}`}
                    onClick={() => handleSelectVersion(version)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{version.version_name}</span>
                        {version.is_current && (
                          <Badge variant="secondary" className="text-xs">
                            启用中
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <span>{version.published_by}</span>
                        <span>·</span>
                        <span>{new Date(version.published_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}发布</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                );
              })}
              
              {versions.length === 0 && !isUnpublishedState && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  暂无已发布版本
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* 历史版本提示 */}
        {isViewingHistoricVersion && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-300">
            只读 - 正在查看历史版本
          </Badge>
        )}
      </div>

      {/* 右上角发布按钮 - 未发布状态时显示 */}
      <div className="absolute top-4 right-28 z-30 flex items-center gap-2">
        {shouldShowPublishButton && !isViewingHistoricVersion && (
          <Button 
            onClick={handlePublishVersion}
            disabled={publishing || nodes.length === 0}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            {publishing ? "发布中..." : versions.length === 0 ? "发布 V1" : "发布"}
          </Button>
        )}
      </div>

      {/* 缩放控制按钮 */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1 bg-background rounded-lg shadow-md border p-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="w-full h-px bg-border" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* 缩放比例显示 */}
      <div className="absolute bottom-4 right-4 z-30 bg-background rounded-lg shadow-md border px-3 py-1.5 text-sm text-muted-foreground">
        {Math.round(scale * 100)}%
      </div>

      {/* 画布区域 */}
      <div 
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className="flex flex-col items-center py-12 px-8"
          style={{
            minWidth: '100%',
            minHeight: '100%',
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center top',
          }}
        >
          {/* 发起人节点 */}
          <div className="flow-node w-72 bg-background rounded-lg shadow-md border-2 border-border overflow-hidden">
            <div className="bg-slate-600 text-white px-4 py-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-medium text-sm">发起人</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">提交审批的人员</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <AddNodeButton afterIndex={-1} />

          {/* 流程节点 - 处理条件分支，过滤掉已移动到分支下的节点 */}
          {nodes
            .filter(n => n.node_type !== 'condition_branch')
            .filter(n => !childNodeIdsToExclude.includes(n.id))
            .map((node, index) => {
              // 跳过条件分支子节点，它们在父节点中渲染
              if (node.node_type === 'condition') {
                return (
                  <div key={node.id} className="flex flex-col items-center">
                    <ConditionBranchGroup parentNode={node} />
                    <AddNodeButton afterIndex={index} />
                  </div>
                );
              }
              
              return (
                <div key={node.id} className="flex flex-col items-center">
                  <FlowNodeCard node={node} />
                  <AddNodeButton afterIndex={index} />
                </div>
              );
            })}

          {/* 流程结束节点 */}
          <div className="flow-node w-72 bg-background rounded-lg shadow-md border-2 border-border overflow-hidden">
            <div className="px-4 py-3 text-center">
              <span className="text-sm text-muted-foreground">流程结束</span>
            </div>
          </div>
        </div>
      </div>

      {/* 节点类型选择器 */}
      <NodeTypeSelector
        open={typeSelectorOpen}
        position={typeSelectorPosition}
        onClose={() => setTypeSelectorOpen(false)}
        onSelect={handleSelectNodeType}
      />

      {/* 条件分支布局选择器 */}
      {branchLayoutSelectorOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setBranchLayoutSelectorOpen(false)}
          />
          <div 
            className="fixed z-50 bg-background rounded-lg shadow-xl border p-4 w-64"
            style={{ 
              left: branchLayoutPosition.x,
              top: branchLayoutPosition.y,
              transform: 'translate(-50%, 0)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">分支节点</span>
              <button 
                onClick={() => setBranchLayoutSelectorOpen(false)} 
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-2 mb-3 p-2 bg-green-100 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-green-700">条件分支</span>
            </div>

            <div className="text-xs text-muted-foreground mb-2">分支下方节点整体放置在</div>
            
            <div className="space-y-2">
              <button
                onClick={() => handleSelectBranchLayout('left')}
                className="w-full flex items-center gap-2 p-3 rounded-lg border-2 hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <span className="text-sm">左侧</span>
                <span className="text-xs text-muted-foreground">ⓘ</span>
              </button>
              <button
                onClick={() => handleSelectBranchLayout('center')}
                className="w-full flex items-center gap-2 p-3 rounded-lg border-2 hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <span className="text-sm">不移动</span>
                <span className="text-xs text-muted-foreground">ⓘ</span>
              </button>
            </div>
            
            <div className="mt-3 text-xs text-muted-foreground">
              分支聚合后执行下方节点
            </div>
          </div>
        </>
      )}

      {/* 分支内节点类型选择器 */}
      {branchNodeSelectorOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setBranchNodeSelectorOpen(false);
              setBranchNodeSelectorContext(null);
            }}
          />
          <div 
            className="fixed z-50 bg-background rounded-lg shadow-xl border p-4 w-72"
            style={{ 
              left: branchNodeSelectorPosition.x,
              top: branchNodeSelectorPosition.y,
              transform: 'translate(-50%, 0)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">选择节点类型</span>
              <button 
                onClick={() => {
                  setBranchNodeSelectorOpen(false);
                  setBranchNodeSelectorContext(null);
                }} 
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleBranchNodeTypeSelect('approver')}
                className="flex items-center gap-2 p-3 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">审批人</span>
              </button>
              <button
                onClick={() => handleBranchNodeTypeSelect('cc')}
                className="flex items-center gap-2 p-3 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">抄送人</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 右侧详情面板 */}
      <Sheet open={detailPanelOpen} onOpenChange={setDetailPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[620px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedNode && (
                <>
                  {(() => {
                    const config = nodeTypeConfig[selectedNode.node_type as keyof typeof nodeTypeConfig] || nodeTypeConfig.approver;
                    const Icon = config.icon;
                    return (
                      <div className={`w-8 h-8 rounded-full ${config.headerColor} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                    );
                  })()}
                  <span>编辑节点</span>
                </>
              )}
            </SheetTitle>
          </SheetHeader>
          
          {selectedNode && (
            <div className="mt-6 space-y-6">
              <div>
                <Label>节点类型</Label>
                <div className="mt-2 flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
                  {(() => {
                    const config = nodeTypeConfig[nodeForm.node_type as keyof typeof nodeTypeConfig] || nodeTypeConfig.approver;
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon className="w-4 h-4" />
                        <span>{config.label}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div>
                <Label>节点名称 *</Label>
                <Input
                  className="mt-2"
                  value={nodeForm.node_name}
                  onChange={(e) => setNodeForm({ ...nodeForm, node_name: e.target.value })}
                  placeholder="如：部门主管审批、财务审批"
                />
              </div>

              {nodeForm.node_type !== 'condition' && nodeForm.node_type !== 'condition_branch' && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="approver">
                      {nodeForm.node_type === 'cc' ? '设置抄送人' : '设置审批人'}
                    </TabsTrigger>
                    <TabsTrigger value="permissions">表单操作权限</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="approver" className="mt-4 space-y-4">
                    <div>
                      <Label>{nodeForm.node_type === 'cc' ? '抄送人设置' : '审批人设置'}</Label>
                      <Select
                        value={nodeForm.approver_type}
                        onValueChange={(value) => setNodeForm({ ...nodeForm, approver_type: value })}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="initiator">发起人自己</SelectItem>
                          <SelectItem value="self">发起人自选</SelectItem>
                          <SelectItem value="specific">指定成员</SelectItem>
                          <SelectItem value="supervisor">直属主管</SelectItem>
                          <SelectItem value="department_head">部门负责人</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {nodeForm.approver_type === "specific" && (
                      <div>
                        <Label>选择{nodeForm.node_type === 'cc' ? '抄送人' : '审批人'}</Label>
                        <div className="mt-2 max-h-48 overflow-auto border rounded-lg p-2 space-y-1">
                          {contacts.map((contact) => (
                            <div
                              key={contact.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                                nodeForm.approver_ids.includes(contact.id) ? "bg-primary/10" : ""
                              }`}
                              onClick={() => toggleApprover(contact.id)}
                            >
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                                nodeForm.approver_ids.includes(contact.id) ? "bg-primary border-primary text-primary-foreground" : ""
                              }`}>
                                {nodeForm.approver_ids.includes(contact.id) && "✓"}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{contact.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {contact.department} {contact.position}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {nodeForm.approver_ids.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {nodeForm.approver_ids.map(id => (
                              <Badge key={id} variant="secondary">
                                {getContactName(id)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 审批方式（仅审批人节点显示） */}
                    {nodeForm.node_type === 'approver' && (
                      <div>
                        <Label>审批方式</Label>
                        <Select
                          value={nodeForm.approval_mode}
                          onValueChange={(value) => setNodeForm({ ...nodeForm, approval_mode: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="countersign">
                              <div className="flex flex-col">
                                <span>会签</span>
                                <span className="text-xs text-muted-foreground">需要所有审批人都同意才可通过</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="or_sign">
                              <div className="flex flex-col">
                                <span>或签</span>
                                <span className="text-xs text-muted-foreground">任一审批人同意或拒绝即可</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          {nodeForm.approval_mode === 'countersign' 
                            ? '会签：需要所有审批人都同意，审批才能通过' 
                            : '或签：其中一名审批人同意或拒绝即可决定结果'}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="permissions" className="mt-4">
                    {nodeForm.node_type === 'cc' && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-700">
                          抄送节点所有字段默认为只读，不可更改
                        </div>
                      </div>
                    )}
                    
                    <div className="border rounded-lg overflow-hidden">
                      {/* 表头 */}
                      <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-muted/50 border-b text-sm font-medium">
                        <div>表单字段</div>
                        <div className="text-center">可编辑</div>
                        <div className="text-center">只读</div>
                        <div className="text-center">隐藏</div>
                      </div>
                      
                      {/* 字段列表 */}
                      <div className="divide-y">
                        {formFields.map((field) => {
                          const permission = nodeForm.field_permissions[field.field_name] || 'readonly';
                          const isCC = nodeForm.node_type === 'cc';
                          
                          return (
                            <div key={field.id} className="grid grid-cols-4 gap-2 px-4 py-3 items-center text-sm">
                              <div className="flex items-center gap-1">
                                {field.is_required && <span className="text-destructive">*</span>}
                                <span>{field.field_label}</span>
                              </div>
                              <div className="flex justify-center">
                                <RadioGroup
                                  value={permission}
                                  onValueChange={(value) => handleFieldPermissionChange(field.field_name, value as FieldPermission)}
                                  disabled={isCC}
                                  className="flex justify-center"
                                >
                                  <RadioGroupItem 
                                    value="editable" 
                                    className={isCC ? "opacity-50 cursor-not-allowed" : ""}
                                  />
                                </RadioGroup>
                              </div>
                              <div className="flex justify-center">
                                <RadioGroup
                                  value={permission}
                                  onValueChange={(value) => handleFieldPermissionChange(field.field_name, value as FieldPermission)}
                                  disabled={isCC}
                                  className="flex justify-center"
                                >
                                  <RadioGroupItem 
                                    value="readonly" 
                                    className={isCC ? "opacity-50 cursor-not-allowed" : ""}
                                  />
                                </RadioGroup>
                              </div>
                              <div className="flex justify-center">
                                <RadioGroup
                                  value={permission}
                                  onValueChange={(value) => handleFieldPermissionChange(field.field_name, value as FieldPermission)}
                                  disabled={isCC}
                                  className="flex justify-center"
                                >
                                  <RadioGroupItem 
                                    value="hidden" 
                                    className={isCC ? "opacity-50 cursor-not-allowed" : ""}
                                  />
                                </RadioGroup>
                              </div>
                            </div>
                          );
                        })}
                        
                        {formFields.length === 0 && (
                          <div className="px-4 py-8 text-center text-muted-foreground">
                            暂无表单字段，请先在表单设计中添加字段
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {nodeForm.node_type === 'condition' && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700">
                    <p className="font-medium mb-2">条件分支说明</p>
                    <p>点击下方分支卡片可设置具体的分支条件。满足条件的流程将进入对应分支执行。</p>
                  </div>
                </div>
              )}

              {nodeForm.node_type === 'condition_branch' && (
                <ConditionConfig
                  conditionExpression={nodeForm.condition_expression || {}}
                  formFields={formFields}
                  isDefault={(nodeForm.condition_expression as any)?.is_default || false}
                  onChange={(newExpression) => {
                    setNodeForm(prev => ({
                      ...prev,
                      condition_expression: {
                        ...prev.condition_expression,
                        ...newExpression,
                      },
                    }));
                  }}
                />
              )}

              <div className="pt-4 border-t flex justify-between">
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteNode(selectedNode.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除节点
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDetailPanelOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveNodeDetail}>
                    保存
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ApprovalProcessDesign;
