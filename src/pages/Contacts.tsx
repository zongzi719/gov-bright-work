import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  office_location: string | null;
  status: string;
  organization: {
    name: string;
  } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  on_duty: { label: "在职", color: "bg-green-100 text-green-700" },
  out: { label: "外出", color: "bg-purple-100 text-purple-700" },
  leave: { label: "请假", color: "bg-orange-100 text-orange-700" },
  business_trip: { label: "出差", color: "bg-blue-100 text-blue-700" },
  meeting: { label: "会议", color: "bg-amber-100 text-amber-700" },
};

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select(`
        id, name, department, position, mobile, phone, email, office_location, status,
        organization:organizations (name)
      `)
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setContacts(data as Contact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(c =>
    c.name.includes(search) ||
    c.department?.includes(search) ||
    c.position?.includes(search) ||
    c.organization?.name.includes(search)
  );

  const handleViewDetail = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailOpen(true);
  };

  return (
    <PageLayout>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>通讯录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索姓名、部门、职位..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无联系人</div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetail(contact)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{contact.name}</h3>
                          <Badge className={`${statusLabels[contact.status]?.color} text-xs px-1.5 py-0.5`}>
                            {statusLabels[contact.status]?.label || contact.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {contact.department || contact.organization?.name || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.position || "-"}
                        </p>
                      </div>
                    </div>
                    {contact.mobile && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{contact.mobile}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>联系人详情</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{selectedContact.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium">{selectedContact.name}</h3>
                  <Badge className={`${statusLabels[selectedContact.status]?.color} mt-1`}>
                    {statusLabels[selectedContact.status]?.label || selectedContact.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-sm text-muted-foreground">所属单位</Label>
                  <div className="mt-1">{selectedContact.organization?.name || "-"}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">部门</Label>
                  <div className="mt-1">{selectedContact.department || "-"}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">职位</Label>
                  <div className="mt-1">{selectedContact.position || "-"}</div>
                </div>
                {selectedContact.mobile && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedContact.mobile}`} className="text-primary hover:underline">
                      {selectedContact.mobile}
                    </a>
                  </div>
                )}
                {selectedContact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.phone}</span>
                  </div>
                )}
                {selectedContact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline">
                      {selectedContact.email}
                    </a>
                  </div>
                )}
                {selectedContact.office_location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.office_location}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Contacts;
