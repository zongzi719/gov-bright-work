import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Lock } from "lucide-react";
import RoleManagement from "./RoleManagement";
import RoleUserManagement from "./RoleUserManagement";
import PermissionManagement from "./PermissionManagement";

const SystemManagement = () => {
  const [activeTab, setActiveTab] = useState("roles");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="w-4 h-4" />
            角色管理
          </TabsTrigger>
          <TabsTrigger value="role-users" className="gap-2">
            <Users className="w-4 h-4" />
            角色用户
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Lock className="w-4 h-4" />
            权限管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <RoleManagement />
        </TabsContent>

        <TabsContent value="role-users">
          <RoleUserManagement />
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemManagement;
