import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
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
  X
} from "lucide-react";
import { toast } from "sonner";

interface ApprovalNode {
  id: string;
  template_id: string;
  node_type: string;
  node_name: string;
  approver_type: string;
  approver_ids: string[] | null;
  sort_order: number;
  condition_expression: any;
}

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
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
    headerColor: "bg-purple-500",
    headerTextColor: "text-white"
  }
};

const approverTypeLabels: Record<string, string> = {
  specific: "指定成员",
  role: "指定角色",
  supervisor: "直属主管",
  department_head: "部门负责人",
  self: "发起人自选",
};

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
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ApprovalNode | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number>(-1);
  
  // 画布状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // 节点类型选择器
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);
  const [typeSelectorPosition, setTypeSelectorPosition] = useState({ x: 0, y: 0 });
  
  const [nodeForm, setNodeForm] = useState({
    node_type: "approver",
    node_name: "",
    approver_type: "self",
    approver_ids: [] as string[],
  });

  useEffect(() => {
    fetchNodes();
    fetchContacts();
  }, [templateId]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department, position")
      .eq("is_active", true)
      .order("name");
    setContacts(data || []);
  };

  const fetchNodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("approval_nodes" as any)
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("获取流程节点失败");
      setLoading(false);
      return;
    }
    setNodes((data as unknown as ApprovalNode[]) || []);
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
    const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig];
    setNodeForm({
      node_type: type,
      node_name: config?.label || "",
      approver_type: type === 'condition' ? 'specific' : 'self',
      approver_ids: [],
    });
    // 先保存节点，然后打开详情面板
    handleSaveNewNode(type);
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
          await supabase
            .from("approval_nodes" as any)
            .update({ sort_order: update.sort_order })
            .eq("id", update.id);
        }
        newSortOrder = (insertAfterIndex + 1) * 10 + 5;
      }
    }
    
    const { data, error } = await supabase
      .from("approval_nodes" as any)
      .insert({
        template_id: templateId,
        node_type: type,
        node_name: config?.label || "",
        approver_type: type === 'condition' ? 'specific' : 'self',
        approver_ids: [],
        sort_order: newSortOrder,
      })
      .select()
      .single();

    if (error) {
      toast.error("添加节点失败");
      return;
    }
    
    toast.success("节点添加成功");
    await fetchNodes();
    
    // 打开详情面板编辑新节点
    if (data) {
      setSelectedNode(data as unknown as ApprovalNode);
      setNodeForm({
        node_type: type,
        node_name: config?.label || "",
        approver_type: type === 'condition' ? 'specific' : 'self',
        approver_ids: [],
      });
      setDetailPanelOpen(true);
    }
  };

  // 点击节点打开详情
  const handleNodeClick = (node: ApprovalNode) => {
    setSelectedNode(node);
    setNodeForm({
      node_type: node.node_type,
      node_name: node.node_name,
      approver_type: node.approver_type,
      approver_ids: node.approver_ids || [],
    });
    setDetailPanelOpen(true);
  };

  // 保存节点详情
  const handleSaveNodeDetail = async () => {
    if (!selectedNode) return;
    
    if (!nodeForm.node_name) {
      toast.error("请填写节点名称");
      return;
    }

    if (nodeForm.approver_type === "specific" && nodeForm.approver_ids.length === 0) {
      toast.error("请选择至少一个审批人");
      return;
    }

    const { error } = await supabase
      .from("approval_nodes" as any)
      .update({
        node_type: nodeForm.node_type,
        node_name: nodeForm.node_name,
        approver_type: nodeForm.approver_type,
        approver_ids: nodeForm.approver_ids,
      })
      .eq("id", selectedNode.id);

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

    const { error } = await supabase
      .from("approval_nodes" as any)
      .delete()
      .eq("id", id);

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

  // 添加节点按钮组件
  const AddNodeButton = ({ afterIndex }: { afterIndex: number }) => (
    <div className="flex flex-col items-center add-node-btn">
      <div className="w-px h-6 bg-gray-300" />
      <button
        onClick={(e) => handleAddClick(e, afterIndex)}
        className="w-7 h-7 rounded-full border-2 border-primary bg-white flex items-center justify-center hover:bg-primary hover:text-white transition-colors group z-10"
      >
        <Plus className="w-4 h-4 text-primary group-hover:text-white" />
      </button>
      <div className="w-px h-6 bg-gray-300" />
    </div>
  );

  // 流程节点卡片组件
  const FlowNodeCard = ({ node }: { node: ApprovalNode }) => {
    const config = nodeTypeConfig[node.node_type as keyof typeof nodeTypeConfig] || nodeTypeConfig.approver;
    const Icon = config.icon;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div 
        className={`flow-node w-72 bg-white rounded-lg shadow-md border-2 overflow-hidden cursor-pointer transition-all ${
          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => handleNodeClick(node)}
      >
        <div className={`${config.headerColor} ${config.headerTextColor} px-4 py-2 flex items-center gap-2`}>
          <Icon className="w-4 h-4" />
          <span className="font-medium text-sm">{node.node_name || config.label}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-700 truncate">
              {getApproverDisplay(node)}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="relative h-[600px] bg-gray-100 rounded-xl overflow-hidden">
      {/* 缩放控制按钮 */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1 bg-white rounded-lg shadow-md border p-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="w-full h-px bg-gray-200" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* 缩放比例显示 */}
      <div className="absolute bottom-4 right-4 z-30 bg-white rounded-lg shadow-md border px-3 py-1.5 text-sm text-gray-600">
        {Math.round(scale * 100)}%
      </div>

      {/* 画布区域 */}
      <div 
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className="inline-flex flex-col items-center py-12 px-8 min-w-full min-h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center top',
          }}
        >
          {/* 发起人节点 */}
          <div className="flow-node w-72 bg-white rounded-lg shadow-md border-2 border-gray-200 overflow-hidden">
            <div className="bg-slate-600 text-white px-4 py-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-medium text-sm">发起人</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">提交审批的人员</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <AddNodeButton afterIndex={-1} />

          {/* 流程节点 */}
          {nodes.map((node, index) => (
            <div key={node.id} className="flex flex-col items-center">
              <FlowNodeCard node={node} />
              <AddNodeButton afterIndex={index} />
            </div>
          ))}

          {/* 流程结束节点 */}
          <div className="flow-node w-72 bg-white rounded-lg shadow-md border-2 border-gray-200 overflow-hidden">
            <div className="px-4 py-3 text-center">
              <span className="text-sm text-gray-500">流程结束</span>
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

      {/* 右侧详情面板 */}
      <Sheet open={detailPanelOpen} onOpenChange={setDetailPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
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
                <Select
                  value={nodeForm.node_type}
                  onValueChange={(value) => {
                    const config = nodeTypeConfig[value as keyof typeof nodeTypeConfig];
                    setNodeForm({
                      ...nodeForm,
                      node_type: value,
                      node_name: nodeForm.node_name || config?.label || "",
                    });
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(nodeTypeConfig).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
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

              {nodeForm.node_type !== 'condition' && (
                <>
                  <div>
                    <Label>审批人设置</Label>
                    <Select
                      value={nodeForm.approver_type}
                      onValueChange={(value) => setNodeForm({ ...nodeForm, approver_type: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">发起人自选</SelectItem>
                        <SelectItem value="specific">指定成员</SelectItem>
                        <SelectItem value="supervisor">直属主管</SelectItem>
                        <SelectItem value="department_head">部门负责人</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {nodeForm.approver_type === "specific" && (
                    <div>
                      <Label>选择审批人</Label>
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
                </>
              )}

              {nodeForm.node_type === 'condition' && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-700">
                    条件分支功能开发中，敬请期待...
                  </div>
                </div>
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
