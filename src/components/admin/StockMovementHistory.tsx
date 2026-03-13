import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/offlineApi";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpCircle, ArrowDownCircle, Settings } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";

interface StockMovement {
  id: string;
  supply_id: string;
  movement_type: "purchase_in" | "requisition_out" | "adjustment";
  quantity: number;
  before_stock: number;
  after_stock: number;
  reference_type: string | null;
  reference_id: string | null;
  operator_name: string | null;
  notes: string | null;
  created_at: string;
  office_supplies?: {
    name: string;
    specification: string | null;
    unit: string;
  };
}

const movementTypeLabels: Record<string, string> = {
  purchase_in: "采购入库",
  requisition_out: "领用出库",
  adjustment: "库存调整",
};

const movementTypeColors: Record<string, string> = {
  purchase_in: "bg-emerald-100 text-emerald-800",
  requisition_out: "bg-amber-100 text-amber-800",
  adjustment: "bg-blue-100 text-blue-800",
};

const referenceTypeLabels: Record<string, string> = {
  purchase_request: "采购申请",
  supply_purchase: "办公采购",
  supply_requisition: "领用申请",
};

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined" && (window as any).GOV_CONFIG?.API_BASE_URL) {
    return (window as any).GOV_CONFIG.API_BASE_URL;
  }
  return "http://localhost:3001";
};

const StockMovementHistory = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      if (isOfflineMode()) {
        const response = await fetch(`${getApiBaseUrl()}/api/stock-movements`);
        const data = await response.json();
        setMovements(data || []);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          *,
          office_supplies (name, specification, unit)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch stock movements:", error);
      } else {
        setMovements(data as StockMovement[]);
      }
    } catch (err) {
      console.error("Failed to fetch stock movements:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const filteredMovements = movements.filter((m) => {
    const matchSearch =
      m.office_supplies?.name?.includes(search) ||
      m.notes?.includes(search) ||
      m.operator_name?.includes(search);
    const matchType = typeFilter === "all" || m.movement_type === typeFilter;
    return matchSearch && matchType;
  });

  const pagination = usePagination(filteredMovements);
  const paginatedMovements = pagination.paginatedData;

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "purchase_in":
        return <ArrowUpCircle className="w-4 h-4 text-primary" />;
      case "requisition_out":
        return <ArrowDownCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Settings className="w-4 h-4 text-secondary-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="搜索物品名称或操作人..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="变动类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="purchase_in">采购入库</SelectItem>
            <SelectItem value="requisition_out">领用出库</SelectItem>
            <SelectItem value="adjustment">库存调整</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>变动时间</TableHead>
            <TableHead>物品名称</TableHead>
            <TableHead>变动类型</TableHead>
            <TableHead className="text-center">变动数量</TableHead>
            <TableHead className="text-center">变动前</TableHead>
            <TableHead className="text-center">变动后</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>操作人</TableHead>
            <TableHead>备注</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                加载中...
              </TableCell>
            </TableRow>
          ) : paginatedMovements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                暂无库存变动记录
              </TableCell>
            </TableRow>
          ) : (
            paginatedMovements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {format(parseTime(movement.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                </TableCell>
                <TableCell className="font-medium">
                  {movement.office_supplies?.name || "-"}
                  {movement.office_supplies?.specification && (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({movement.office_supplies.specification})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={`gap-1 ${movementTypeColors[movement.movement_type]}`}>
                    {getMovementIcon(movement.movement_type)}
                    {movementTypeLabels[movement.movement_type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className={movement.movement_type === "purchase_in" ? "text-emerald-600" : "text-amber-600"}>
                    {movement.movement_type === "purchase_in" ? "+" : "-"}{movement.quantity}
                  </span>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {movement.before_stock}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {movement.after_stock}
                </TableCell>
                <TableCell>
                  {movement.reference_type ? (
                    <span className="text-sm">
                      {referenceTypeLabels[movement.reference_type] || movement.reference_type}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell>{movement.operator_name || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {movement.notes || "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrevious={pagination.canGoPrevious}
        onPageChange={pagination.setCurrentPage}
        onPageSizeChange={pagination.setPageSize}
        goToNextPage={pagination.goToNextPage}
        goToPreviousPage={pagination.goToPreviousPage}
      />
    </div>
  );
};

export default StockMovementHistory;
