import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, GitBranch } from "lucide-react";
import ApprovalTimeline from "@/components/admin/ApprovalTimeline";
import { cn } from "@/lib/utils";

interface DetailField {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}

interface StatusConfig {
  label: string;
  className?: string;
}

interface ApplicationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  status?: string;
  statusConfig?: Record<string, StatusConfig>;
  fields: DetailField[];
  businessId?: string;
  businessType?: string;
  showApproval?: boolean;
}

const defaultStatusConfig: Record<string, StatusConfig> = {
  pending: { label: "待审批", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "已通过", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "已拒绝", className: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "已完成", className: "bg-slate-50 text-slate-600 border-slate-200" },
  cancelled: { label: "已取消", className: "bg-slate-50 text-slate-400 border-slate-200" },
};

const ApplicationDetailDialog = ({
  open,
  onOpenChange,
  title,
  status,
  statusConfig = defaultStatusConfig,
  fields,
  businessId,
  businessType,
  showApproval = true,
}: ApplicationDetailDialogProps) => {
  const getStatusConfig = (s: string) => {
    return statusConfig[s] || defaultStatusConfig[s] || { label: s };
  };

  const config = status ? getStatusConfig(status) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {config && (
              <Badge
                variant="outline"
                className={cn("text-xs font-normal border", config.className)}
              >
                {config.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {showApproval && businessId && businessType ? (
          <Tabs defaultValue="detail" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 mb-2 grid w-fit grid-cols-2 bg-muted/50">
              <TabsTrigger value="detail" className="gap-2 px-4">
                <FileText className="w-4 h-4" />
                申请详情
              </TabsTrigger>
              <TabsTrigger value="approval" className="gap-2 px-4">
                <GitBranch className="w-4 h-4" />
                审批流程
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detail" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-[calc(85vh-180px)]">
                <div className="px-6 py-4">
                  <DetailFieldsGrid fields={fields} />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="approval" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-[calc(85vh-180px)]">
                <div className="px-6 py-4">
                  <ApprovalTimeline businessId={businessId} businessType={businessType} />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <ScrollArea className="h-[calc(85vh-100px)]">
            <div className="px-6 py-4">
              <DetailFieldsGrid fields={fields} />
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

const DetailFieldsGrid = ({ fields }: { fields: DetailField[] }) => {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {fields.map((field, index) => (
        <div
          key={index}
          className={cn(
            "space-y-1.5",
            field.fullWidth && "col-span-2"
          )}
        >
          <Label className="text-xs text-muted-foreground font-normal">
            {field.label}
          </Label>
          <div className="text-sm text-foreground">
            {field.value || <span className="text-muted-foreground">-</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ApplicationDetailDialog;
