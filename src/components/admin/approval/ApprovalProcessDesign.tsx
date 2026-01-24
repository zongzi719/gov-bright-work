import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, 
  User, 
  GitBranch, 
  ArrowDown,
  Trash2,
  Edit,
  UserCheck,
  Mail
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
  approver: { icon: UserCheck, label: "审批人", color: "bg-blue-100 text-blue-700 border-blue-200" },
  cc: { icon: Mail, label: "抄送人", color: "bg-green-100 text-green-700 border-green-200" },
  condition: { icon: GitBranch, label: "条件分支", color: "bg-orange-100 text-orange-700 border-orange-200" },
};

const approverTypeLabels: Record<string, string> = {
  specific: "指定成员",
  role: "指定角色",
  supervisor: "直属主管",
  department_head: "部门负责人",
};

const ApprovalProcessDesign = ({ templateId }: ApprovalProcessDesignProps) => {
  const [nodes, setNodes] = useState<ApprovalNode[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ApprovalNode | null>(null);
  
  const [nodeForm, setNodeForm] = useState({
    node_type: "approver",
    node_name: "",
    approver_type: "specific",
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

  const handleOpenNodeDialog = (node?: ApprovalNode) => {
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
        approver_type: "specific",
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
      const maxOrder = nodes.length > 0 ? Math.max(...nodes.map(n => n.sort_order)) : 0;
      
      const { error } = await supabase
        .from("approval_nodes" as any)
        .insert({
          template_id: templateId,
          node_type: nodeForm.node_type,
          node_name: nodeForm.node_name,
          approver_type: nodeForm.approver_type,
          approver_ids: nodeForm.approver_ids,
          sort_order: maxOrder + 1,
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

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-6">
        {/* 节点类型 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">节点类型</CardTitle>
            <CardDescription>点击添加到流程</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(nodeTypeConfig).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setNodeForm({
                      ...nodeForm,
                      node_type: type,
                      node_name: config.label,
                    });
                    handleOpenNodeDialog();
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* 流程图 */}
        <Card className="col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">审批流程</CardTitle>
                <CardDescription>配置审批节点和审批人</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenNodeDialog()}>
                <Plus className="w-4 h-4 mr-1" />
                添加节点
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {nodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                暂无流程节点，点击添加
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                {/* 发起人 */}
                <div className="flex items-center gap-3 px-6 py-3 bg-muted rounded-lg border">
                  <User className="w-5 h-5" />
                  <span className="font-medium">发起人</span>
                </div>
                
                {nodes.map((node) => {
                  const config = nodeTypeConfig[node.node_type as keyof typeof nodeTypeConfig];
                  const Icon = config?.icon || User;
                  
                  return (
                    <div key={node.id} className="flex flex-col items-center">
                      <ArrowDown className="w-5 h-5 text-muted-foreground my-1" />
                      <div 
                        className={`flex items-center gap-3 px-6 py-3 rounded-lg border ${config?.color || "bg-muted"} group relative`}
                      >
                        <Icon className="w-5 h-5" />
                        <div>
                          <div className="font-medium">{node.node_name}</div>
                          <div className="text-xs opacity-70">
                            {node.approver_type === "specific" 
                              ? (node.approver_ids || []).map(id => getContactName(id)).join(", ")
                              : approverTypeLabels[node.approver_type]
                            }
                          </div>
                        </div>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleOpenNodeDialog(node)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleDeleteNode(node.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <ArrowDown className="w-5 h-5 text-muted-foreground my-1" />
                
                {/* 结束 */}
                <div className="flex items-center gap-3 px-6 py-3 bg-muted rounded-lg border">
                  <span className="font-medium">结束</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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

            {nodeForm.node_type !== "condition" && (
              <>
                <div>
                  <Label>审批人类型</Label>
                  <Select
                    value={nodeForm.approver_type}
                    onValueChange={(value) => setNodeForm({ ...nodeForm, approver_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
