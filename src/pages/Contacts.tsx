import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Phone, Mail, MapPin, Building2, Star, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
}

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
  is_leader: boolean;
  organization_id: string;
  organization: {
    name: string;
  } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  on_duty: { label: "在职", color: "bg-green-100 text-green-700 border-green-200" },
  out: { label: "外出", color: "bg-purple-100 text-purple-700 border-purple-200" },
  leave: { label: "请假", color: "bg-orange-100 text-orange-700 border-orange-200" },
  business_trip: { label: "出差", color: "bg-blue-100 text-blue-700 border-blue-200" },
  meeting: { label: "会议", color: "bg-amber-100 text-amber-700 border-amber-200" },
};

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 获取组织路径（树状结构展示）
  const getOrganizationPath = (orgId: string): string[] => {
    const org = organizations.find(o => o.id === orgId);
    if (!org) return [];
    
    const path: string[] = [org.name];
    let currentOrg = org;
    
    while (currentOrg.parent_id) {
      const parent = organizations.find(o => o.id === currentOrg.parent_id);
      if (parent) {
        path.unshift(parent.name);
        currentOrg = parent;
      } else {
        break;
      }
    }
    
    return path;
  };

  const fetchData = async () => {
    setLoading(true);
    
    // 并行获取联系人和组织
    const [contactsRes, orgsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select(`
          id, name, department, position, mobile, phone, email, office_location, status, is_leader, organization_id,
          organization:organizations (name)
        `)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("organizations")
        .select("id, name, parent_id")
        .order("sort_order")
    ]);

    if (!contactsRes.error && contactsRes.data) {
      setContacts(contactsRes.data as Contact[]);
    }
    if (!orgsRes.error && orgsRes.data) {
      setOrganizations(orgsRes.data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
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
      <Card className="h-[calc(100vh-120px)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">通讯录</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-60px)] flex flex-col">
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
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
                {filteredContacts.map((contact) => {
                  const orgPath = getOrganizationPath(contact.organization_id);
                  const statusInfo = statusLabels[contact.status];
                  
                  return (
                    <div
                      key={contact.id}
                      className="group relative bg-card border rounded-xl p-4 hover:shadow-lg hover:border-primary/30 cursor-pointer transition-all duration-200"
                      onClick={() => handleViewDetail(contact)}
                    >
                      {/* 领导标识 */}
                      {contact.is_leader && (
                        <div className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-1.5 shadow-md">
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </div>
                      )}
                      
                      {/* 头像和基本信息 */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-primary">{contact.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">{contact.name}</h3>
                            {contact.is_leader && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-1.5 py-0">
                                领导
                              </Badge>
                            )}
                            <Badge className={`${statusInfo?.color} text-xs px-1.5 py-0`}>
                              {statusInfo?.label || contact.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {contact.position || "-"}
                          </p>
                        </div>
                      </div>
                      
                      {/* 组织层级路径 */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            {orgPath.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                                {orgPath.map((name, idx) => (
                                  <span key={idx} className="flex items-center">
                                    {idx > 0 && <ChevronRight className="w-3 h-3 mx-0.5 text-muted-foreground/50" />}
                                    <span className={idx === orgPath.length - 1 ? "text-foreground font-medium" : ""}>
                                      {name}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                            {contact.department && (
                              <p className="text-sm text-primary mt-0.5">{contact.department}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* 联系方式 */}
                      {contact.mobile && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{contact.mobile}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>联系人详情</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-5 py-2">
              {/* 头部信息 */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{selectedContact.name.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-semibold">{selectedContact.name}</h3>
                    {selectedContact.is_leader && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        领导
                      </Badge>
                    )}
                    <Badge className={statusLabels[selectedContact.status]?.color}>
                      {statusLabels[selectedContact.status]?.label || selectedContact.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">{selectedContact.position || "-"}</p>
                </div>
              </div>

              {/* 组织层级 */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">组织架构</Label>
                    <div className="mt-1">
                      {(() => {
                        const orgPath = getOrganizationPath(selectedContact.organization_id);
                        return orgPath.length > 0 ? (
                          <div className="space-y-1">
                            {orgPath.map((name, idx) => (
                              <div key={idx} className="flex items-center">
                                <span className="text-muted-foreground mr-2" style={{ marginLeft: `${idx * 16}px` }}>
                                  {idx > 0 ? "└" : ""}
                                </span>
                                <span className={idx === orgPath.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                                  {name}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        );
                      })()}
                    </div>
                    {selectedContact.department && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <Label className="text-xs text-muted-foreground">所属部门</Label>
                        <div className="text-primary font-medium">{selectedContact.department}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 联系方式 */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">联系方式</Label>
                <div className="grid gap-3">
                  {selectedContact.mobile && (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">手机</p>
                        <a href={`tel:${selectedContact.mobile}`} className="text-primary hover:underline font-medium">
                          {selectedContact.mobile}
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedContact.phone && (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">座机</p>
                        <span className="font-medium">{selectedContact.phone}</span>
                      </div>
                    </div>
                  )}
                  {selectedContact.email && (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">邮箱</p>
                        <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline font-medium">
                          {selectedContact.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedContact.office_location && (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">办公位置</p>
                        <span className="font-medium">{selectedContact.office_location}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Contacts;
