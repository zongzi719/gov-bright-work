import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, CalendarOff, LogOut } from "lucide-react";
import BusinessTripManagement from "./BusinessTripManagement";
import LeaveManagement from "./LeaveManagement";
import OutManagement from "./OutManagement";

const AbsenceManagement = () => {
  const [activeTab, setActiveTab] = useState("business-trip");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="business-trip" className="gap-2">
            <Briefcase className="w-4 h-4" />
            出差申请
          </TabsTrigger>
          <TabsTrigger value="leave-request" className="gap-2">
            <CalendarOff className="w-4 h-4" />
            请假申请
          </TabsTrigger>
          <TabsTrigger value="out-request" className="gap-2">
            <LogOut className="w-4 h-4" />
            外出申请
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business-trip" className="mt-4">
          <BusinessTripManagement />
        </TabsContent>

        <TabsContent value="leave-request" className="mt-4">
          <LeaveManagement />
        </TabsContent>

        <TabsContent value="out-request" className="mt-4">
          <OutManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AbsenceManagement;
