import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Search, RefreshCw, Eye, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isOfflineMode } from "@/lib/offlineApi";

interface AuditLog {
  id: string;
  operator_id: string;
  operator_name: string;
  operator_role: string | null;
  action: string;
  module: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  detail: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '超级管理员',
  sys_admin: '系统管理员',
  security_admin: '安全保密管理员',
  audit_admin: '安全审计员',
};

const ACTION_COLORS: Record<string, string> = {
  '登录': 'bg-blue-100 text-blue-800',
  '退出登录': 'bg-gray-100 text-gray-800',
  '新增': 'bg-green-100 text-green-800',
  '修改': 'bg-yellow-100 text-yellow-800',
  '删除': 'bg-red-100 text-red-800',
  '查看': 'bg-purple-100 text-purple-800',
  '审批通过': 'bg-emerald-100 text-emerald-800',
  '审批驳回': 'bg-orange-100 text-orange-800',
  '分配角色': 'bg-indigo-100 text-indigo-800',
  '移除角色': 'bg-pink-100 text-pink-800',
  '修改密码': 'bg-amber-100 text-amber-800',
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

const AuditLogManagement = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [jumpPage, setJumpPage] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (isOfflineMode()) {
        // Offline mode: fetch from API
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('pageSize', String(pageSize));
        if (keyword) params.set('keyword', keyword);
        if (moduleFilter !== 'all') params.set('module', moduleFilter);
        if (actionFilter !== 'all') params.set('action', actionFilter);
        if (dateFrom) params.set('dateFrom', format(dateFrom, 'yyyy-MM-dd'));
        if (dateTo) params.set('dateTo', format(dateTo, 'yyyy-MM-dd'));

        const baseUrl = typeof window !== 'undefined' && (window as any).GOV_CONFIG?.API_BASE_URL
          ? (window as any).GOV_CONFIG.API_BASE_URL : 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/audit-logs?${params}`);
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalCount(data.total || 0);
      } else {
        // Online: query Supabase
        let query = (supabase.from('audit_logs' as any).select('*', { count: 'exact' }) as any);

        if (keyword) {
          query = query.or(`operator_name.ilike.%${keyword}%,target_name.ilike.%${keyword}%,module.ilike.%${keyword}%`);
        }
        if (moduleFilter !== 'all') {
          query = query.eq('module', moduleFilter);
        }
        if (actionFilter !== 'all') {
          query = query.eq('action', actionFilter);
        }
        if (dateFrom) {
          query = query.gte('created_at', `${format(dateFrom, 'yyyy-MM-dd')}T00:00:00`);
        }
        if (dateTo) {
          query = query.lte('created_at', `${format(dateTo, 'yyyy-MM-dd')}T23:59:59`);
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, count, error } = await query;
        if (error) {
          console.error('Fetch audit logs error:', error);
          setLogs([]);
          setTotalCount(0);
        } else {
          setLogs((data as AuditLog[]) || []);
          setTotalCount(count || 0);
        }
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, keyword, moduleFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchLogs();
  };

  const handleReset = () => {
    setKeyword("");
    setModuleFilter("all");
    setActionFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">审计日志</h2>
        <Badge variant="outline" className="text-xs">
          共 {totalCount} 条记录 · 保留200天
        </Badge>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="搜索操作人/目标/模块..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-9"
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="功能模块" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模块</SelectItem>
            <SelectItem value="认证管理">认证管理</SelectItem>
            <SelectItem value="轮播图管理">轮播图管理</SelectItem>
            <SelectItem value="通知公告">通知公告</SelectItem>
            <SelectItem value="食堂菜谱">食堂菜谱</SelectItem>
            <SelectItem value="通讯录管理">通讯录管理</SelectItem>
            <SelectItem value="外出管理">外出管理</SelectItem>
            <SelectItem value="假期管理">假期管理</SelectItem>
            <SelectItem value="办公用品">办公用品</SelectItem>
            <SelectItem value="日程管理">日程管理</SelectItem>
            <SelectItem value="领导日程">领导日程</SelectItem>
            <SelectItem value="审批设置">审批设置</SelectItem>
            <SelectItem value="系统管理">系统管理</SelectItem>
            <SelectItem value="角色管理">角色管理</SelectItem>
            <SelectItem value="权限管理">权限管理</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="操作类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            <SelectItem value="登录">登录</SelectItem>
            <SelectItem value="退出登录">退出登录</SelectItem>
            <SelectItem value="新增">新增</SelectItem>
            <SelectItem value="修改">修改</SelectItem>
            <SelectItem value="删除">删除</SelectItem>
            <SelectItem value="查看">查看</SelectItem>
            <SelectItem value="修改密码">修改密码</SelectItem>
            <SelectItem value="分配角色">分配角色</SelectItem>
            <SelectItem value="移除角色">移除角色</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '开始日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} locale={zhCN} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">—</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                {dateTo ? format(dateTo, 'yyyy-MM-dd') : '结束日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} locale={zhCN} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <Button size="sm" onClick={handleSearch} className="h-9">
          <Search className="w-4 h-4 mr-1" /> 查询
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} className="h-9">
          <RefreshCw className="w-4 h-4 mr-1" /> 重置
        </Button>
      </div>

      {/* 日志表格 */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">时间</TableHead>
              <TableHead className="w-[100px]">操作人</TableHead>
              <TableHead className="w-[110px]">角色</TableHead>
              <TableHead className="w-[80px]">操作</TableHead>
              <TableHead className="w-[110px]">功能模块</TableHead>
              <TableHead>操作对象</TableHead>
              <TableHead className="w-[60px]">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中...</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无审计日志</TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{log.operator_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABELS[log.operator_role || ''] || log.operator_role || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'}`}>
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{log.module}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {log.target_name || log.target_type || '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailLog(log)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            第 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} 条，共 {totalCount} 条
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>上一页</Button>
            <span className="text-sm">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一页</Button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>审计日志详情</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">时间：</span>{format(new Date(detailLog.created_at), 'yyyy-MM-dd HH:mm:ss')}</div>
                <div><span className="text-muted-foreground">操作人：</span>{detailLog.operator_name}</div>
                <div><span className="text-muted-foreground">角色：</span>{ROLE_LABELS[detailLog.operator_role || ''] || detailLog.operator_role || '-'}</div>
                <div><span className="text-muted-foreground">操作：</span>{detailLog.action}</div>
                <div><span className="text-muted-foreground">模块：</span>{detailLog.module}</div>
                <div><span className="text-muted-foreground">对象类型：</span>{detailLog.target_type || '-'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">对象名称：</span>{detailLog.target_name || '-'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">对象ID：</span><code className="text-xs bg-muted px-1 py-0.5 rounded">{detailLog.target_id || '-'}</code></div>
              </div>
              {detailLog.detail && Object.keys(detailLog.detail).length > 0 && (
                <div>
                  <span className="text-muted-foreground">操作详情：</span>
                  <pre className="mt-1 bg-muted p-3 rounded text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(detailLog.detail, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.user_agent && (
                <div>
                  <span className="text-muted-foreground">浏览器信息：</span>
                  <p className="text-xs text-muted-foreground mt-1 break-all">{detailLog.user_agent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogManagement;
