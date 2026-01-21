import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
};

const roleDescriptions: Record<string, string> = {
  admin: '拥有系统所有权限，可以管理所有模块和用户',
  user: '普通用户，权限受限，只能操作授权的模块',
};

const RoleManagement = () => {
  const roles = ['admin', 'user'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          角色列表
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">角色标识</TableHead>
              <TableHead className="w-[150px]">角色名称</TableHead>
              <TableHead>角色描述</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role}>
                <TableCell className="font-mono text-sm">{role}</TableCell>
                <TableCell className="font-medium">{roleLabels[role]}</TableCell>
                <TableCell className="text-muted-foreground">
                  {roleDescriptions[role]}
                </TableCell>
                <TableCell>
                  <Badge variant="default">系统角色</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p>💡 提示：系统角色由系统预设，暂不支持自定义角色。如需添加更多角色类型，请联系开发人员。</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleManagement;
