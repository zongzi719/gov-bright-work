import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, 
  User, 
  Trash2,
  Edit,
  UserCheck,
  Send,
  ChevronRight
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
};

const approverTypeLabels: Record<string, string> = {
  specific: "指定成员",
  role: "指定角色",
  supervisor: "直属主管",
  department_head: "部门负责人",
  self: "发起人自选",
};

const ApprovalProcessDesign = ({ templateId }: ApprovalProcessDesignProps) => {
  const [nodes, setNodes] = useState<ApprovalNode[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ApprovalNode | null>(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number>(-1);
  
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

  const handleOpenNodeDialog = (node?: ApprovalNode, afterIndex: number = -1) => {
    setInsertAfterIndex(afterIndex);
    if (node) {
      setEditingNode(node);
      setNodeForm({
        node_type: node.node_type,
        node_name: node.node_name,
        approver_type: node.approver_type,
        approver_ids: node.approver_ids || [],
      });
    } else {
      setEditingNode(null);
      setNodeForm({
        node_type: "approver",
        node_name: "",
        approver_type: "self",
        approver_ids: [],
      });
    }
    setNodeDialogOpen(true);
  };

  const handleSaveNode = async () => {
    if (!nodeForm.node_name) {
      toast.error("请填写节点名称");
      return;
    }

    if (nodeForm.approver_type === "specific" && nodeForm.approver_ids.length === 0) {
      toast.error("请选择至少一个审批人");
      return;
    }

    if (editingNode) {
      const { error } = await supabase
        .from("approval_nodes" as any)
        .update({
          node_type: nodeForm.node_type,
          node_name: nodeForm.node_name,
          approver_type: nodeForm.approver_type,
          approver_ids: nodeForm.approver_ids,
        })
        .eq("id", editingNode.id);

      if (error) {
        toast.error("更新节点失败");
        return;
      }
      toast.success("节点更新成功");
    } else {
      // 计算新节点的 sort_order
      let newSortOrder: number;
      if (insertAfterIndex === -1) {
        // 在发起人后插入，即所有节点之前
        newSortOrder = nodes.length > 0 ? nodes[0].sort_order - 1 : 1;
      } else if (insertAfterIndex >= nodes.length) {
        // 在最后一个节点后插入
        newSortOrder = nodes.length > 0 ? nodes[nodes.length - 1].sort_order + 1 : 1;
      } else {
        // 在特定节点后插入
        const currentOrder = nodes[insertAfterIndex].sort_order;
        const nextOrder = insertAfterIndex + 1 < nodes.length 
          ? nodes[insertAfterIndex + 1].sort_order 
          : currentOrder + 2;
        newSortOrder = Math.floor((currentOrder + nextOrder) / 2);
        
        // 如果没有空间了，重新排序所有节点
        if (newSortOrder === currentOrder || newSortOrder === nextOrder) {
          // 需要重新排序
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
      
      const { error } = await supabase
        .from("approval_nodes" as any)
        .insert({
          template_id: templateId,
          node_type: nodeForm.node_type,
          node_name: nodeForm.node_name,
          approver_type: nodeForm.approver_type,
          approver_ids: nodeForm.approver_ids,
          sort_order: newSortOrder,
        });

      if (error) {
        toast.error("添加节点失败");
        return;
      }
      toast.success("节点添加成功");
    }

    setNodeDialogOpen(false);
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
    <div className="flex flex-col items-center">
      {/* 连接线 */}
      <div className="w-px h-6 bg-gray-300" />
      {/* 添加按钮 */}
      <button
        onClick={() => handleOpenNodeDialog(undefined, afterIndex)}
        className="w-7 h-7 rounded-full border-2 border-primary bg-white flex items-center justify-center hover:bg-primary hover:text-white transition-colors group"
      >
        <Plus className="w-4 h-4 text-primary group-hover:text-white" />
      </button>
      {/* 连接线 */}
      <div className="w-px h-6 bg-gray-300" />
    </div>
  );

  // 流程节点卡片组件
  const FlowNodeCard = ({ 
    node, 
    index 
  }: { 
    node: ApprovalNode; 
    index: number;
  }) => {
    const config = nodeTypeConfig[node.node_type as keyof typeof nodeTypeConfig] || nodeTypeConfig.approver;
    const Icon = config.icon;

    return (
      <div className="relative group">
        <div className="w-72 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {/* 节点头部 */}
          <div className={`${config.headerColor} ${config.headerTextColor} px-4 py-2 flex items-center gap-2`}>
            <Icon className="w-4 h-4" />
            <span className="font-medium text-sm">{config.label}</span>
          </div>
          {/* 节点内容 */}
          <div 
            className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => handleOpenNodeDialog(node)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700 truncate">
                {getApproverDisplay(node)}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>
        </div>
        {/* 操作按钮 */}
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white"
            onClick={() => handleOpenNodeDialog(node)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white text-destructive hover:text-destructive"
            onClick={() => handleDeleteNode(node.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 流程图区域 */}
      <div className="bg-gray-50 rounded-xl p-8 min-h-[500px] overflow-auto">
        <div className="flex flex-col items-center py-8">
          {/* 发起人节点 */}
          <div className="w-72 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-slate-600 text-white px-4 py-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-medium text-sm">发起人</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">提交审批的人员</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* 添加按钮 - 发起人后 */}
          <AddNodeButton afterIndex={-1} />

          {/* 流程节点 */}
          {nodes.map((node, index) => (
            <div key={node.id} className="flex flex-col items-center">
              <FlowNodeCard node={node} index={index} />
              <AddNodeButton afterIndex={index} />
            </div>
          ))}

          {/* 流程结束节点 */}
          <div className="w-72 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 text-center">
              <span className="text-sm text-gray-500">流程结束</span>
            </div>
          </div>
        </div>
      </div>

      {/* 节点编辑弹窗 */}
      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNode ? "编辑节点" : "添加节点"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                <SelectTrigger>
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
                value={nodeForm.node_name}
                onChange={(e) => setNodeForm({ ...nodeForm, node_name: e.target.value })}
                placeholder="如：部门主管审批、财务审批"
              />
            </div>

            <div>
              <Label>审批人设置</Label>
              <Select
                value={nodeForm.approver_type}
                onValueChange={(value) => setNodeForm({ ...nodeForm, approver_type: value })}
              >
                <SelectTrigger>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveNode}>
              {editingNode ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalProcessDesign;
