import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, ChevronRight, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface ApplicationItem {
  id: string;
  title: string;
  subtitle?: string;
  time: string;
  status: string;
  meta?: { label: string; value: string }[];
}

interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

interface ApplicationListProps {
  title: string;
  items: ApplicationItem[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
  onItemClick: (item: ApplicationItem) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  statusConfig?: Record<string, StatusConfig>;
  hideTitle?: boolean;
}

const defaultStatusConfig: Record<string, StatusConfig> = {
  pending: { label: "待审批", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "已通过", variant: "default", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "已拒绝", variant: "destructive", className: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "已完成", variant: "outline", className: "bg-slate-50 text-slate-600 border-slate-200" },
  cancelled: { label: "已取消", variant: "outline", className: "bg-slate-50 text-slate-400 border-slate-200" },
};

const ApplicationList = ({
  title,
  items,
  loading,
  search,
  onSearchChange,
  onAddClick,
  onItemClick,
  searchPlaceholder = "搜索...",
  emptyText = "暂无记录",
  statusConfig = defaultStatusConfig,
  hideTitle = false,
}: ApplicationListProps) => {
  const getStatusConfig = (status: string) => {
    return statusConfig[status] || defaultStatusConfig[status] || { label: status, variant: "secondary" as const };
  };

  return (
    <Card className={cn("border-0 shadow-sm bg-card/80 backdrop-blur-sm", hideTitle && "shadow-none bg-transparent")}>
      {!hideTitle && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-border/50">
          <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
          <Button 
            onClick={onAddClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            新增申请
          </Button>
        </CardHeader>
      )}
      <CardContent className={cn("pt-6", hideTitle && "pt-4 px-4")}>
        {/* 搜索栏 + 新增按钮 */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-10 bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
            />
          </div>
          {hideTitle && (
            <Button 
              onClick={onAddClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              新增申请
            </Button>
          )}
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <span>{emptyText}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const config = getStatusConfig(item.status);
              return (
                <div
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  className={cn(
                    "group relative p-4 rounded-xl cursor-pointer",
                    "bg-gradient-to-r from-background to-muted/20",
                    "border border-border/40 hover:border-primary/30",
                    "transition-all duration-200 ease-out",
                    "hover:shadow-md hover:-translate-y-0.5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* 主内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-foreground truncate">
                          {item.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-xs font-normal border",
                            config.className
                          )}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      
                      {item.subtitle && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                          {item.subtitle}
                        </p>
                      )}

                      {/* 元信息 */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.time}
                        </span>
                        {item.meta?.map((m, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="text-muted-foreground/60">{m.label}:</span>
                            <span>{m.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 箭头 */}
                    <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApplicationList;
