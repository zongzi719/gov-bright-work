import { useState, useEffect } from "react";
import * as dataAdapter from "@/lib/dataAdapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { allStatusConfig as statusConfig } from "@/lib/statusLabels";
import ApprovalTimeline from "./ApprovalTimeline";

interface CustomTemplateRecordsProps {
  templateId: string;
  templateName: string;
}

interface Instance {
  id: string;
  business_id: string;
  business_type: string;
  initiator_id: string;
  status: string;
  form_data: Record<string, any> | null;
  created_at: string;
  contacts?: { name: string; department?: string } | null;
}

const CustomTemplateRecords = ({ templateId, templateName }: CustomTemplateRecordsProps) => {
  const [records, setRecords] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<Instance | null>(null);

  useEffect(() => {
    loadRecords();
  }, [templateId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await dataAdapter.getApprovalInstancesByTemplate(templateId);
      if (!error && data) {
        setRecords(data as Instance[]);
      }
    } catch (e) {
      console.error("加载记录失败:", e);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{templateName} - 申请记录</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无申请记录</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>申请人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{(record as any).contacts?.name || (record as any).initiator?.name || (record as any).initiator_name || record.initiator_id}</TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(record.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>
                      <Eye className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {selectedRecord ? (
          <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{templateName} - 申请详情</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">申请人</span>
                    <p className="font-medium">{(selectedRecord as any).contacts?.name || selectedRecord.initiator_id}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">状态</span>
                    <p>{getStatusBadge(selectedRecord.status)}</p>
                  </div>
                </div>
                
                {selectedRecord.form_data && Object.keys(selectedRecord.form_data).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium">表单数据</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedRecord.form_data).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-sm text-muted-foreground">{key}</span>
                            <p className="text-sm">{String(value ?? "-")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <ApprovalTimeline businessId={selectedRecord.business_id} businessType={selectedRecord.business_type} instanceId={selectedRecord.id} />
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default CustomTemplateRecords;
