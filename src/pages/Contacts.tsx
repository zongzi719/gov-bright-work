import { useState, useEffect, useMemo } from "react";
import PageLayout from "@/components/PageLayout";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import OrganizationTree from "@/components/contacts/OrganizationTree";
import ContactTable from "@/components/contacts/ContactTable";
import ContactDetailDialog from "@/components/contacts/ContactDetailDialog";

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
  security_level: string;
  organization_id: string;
  organization: {
    name: string;
  } | null;
}

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Get all descendant org IDs for filtering
  const getDescendantIds = (orgId: string): string[] => {
    const descendants: string[] = [orgId];
    const children = organizations.filter(o => o.parent_id === orgId);
    children.forEach(child => {
      descendants.push(...getDescendantIds(child.id));
    });
    return descendants;
  };

  const fetchData = async () => {
    setLoading(true);
    
    const [contactsRes, orgsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select(`
          id, name, department, position, mobile, phone, email, office_location, status, is_leader, organization_id, security_level,
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

  // Calculate contact counts per organization
  const contactCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      counts[c.organization_id] = (counts[c.organization_id] || 0) + 1;
    });
    return counts;
  }, [contacts]);

  // Filter contacts by selected org and search
  const filteredContacts = useMemo(() => {
    let result = contacts;
    
    // Filter by organization (including children)
    if (selectedOrgId) {
      const validOrgIds = getDescendantIds(selectedOrgId);
      result = result.filter(c => validOrgIds.includes(c.organization_id));
    }
    
    // Filter by search
    if (search) {
      result = result.filter(c =>
        c.name.includes(search) ||
        c.department?.includes(search) ||
        c.position?.includes(search) ||
        c.organization?.name.includes(search) ||
        c.phone?.includes(search) ||
        c.email?.includes(search)
      );
    }
    
    return result;
  }, [contacts, selectedOrgId, search, organizations]);

  const handleViewDetail = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailOpen(true);
  };

  // Get selected org name for display
  const selectedOrgName = selectedOrgId 
    ? organizations.find(o => o.id === selectedOrgId)?.name 
    : null;

  return (
    <PageLayout>
      <Card className="h-[calc(100vh-120px)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            通讯录
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-60px)] p-0">
          <div className="flex h-full">
            {/* Left: Organization Tree */}
            <div className="w-64 flex-shrink-0">
              <OrganizationTree
                organizations={organizations}
                selectedOrgId={selectedOrgId}
                onSelectOrg={setSelectedOrgId}
                contactCounts={contactCounts}
              />
            </div>
            
            {/* Right: Contact List */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Search and filter bar */}
              <div className="flex items-center gap-4 p-4 border-b">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索姓名、部门、职务、电话、邮箱..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedOrgName ? (
                    <span>
                      当前：<span className="text-foreground font-medium">{selectedOrgName}</span>
                    </span>
                  ) : (
                    <span>显示全部人员</span>
                  )}
                  <span className="ml-2">({filteredContacts.length} 人)</span>
                </div>
              </div>
              
              {/* Contact table */}
              <div className="flex-1 overflow-hidden">
                <ContactTable
                  contacts={filteredContacts}
                  loading={loading}
                  onSelectContact={handleViewDetail}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <ContactDetailDialog
        contact={selectedContact}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        organizations={organizations}
      />
    </PageLayout>
  );
};

export default Contacts;
