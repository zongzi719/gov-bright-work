import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Building2, ChevronRight, ChevronDown, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import * as dataAdapter from "@/lib/dataAdapter";

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
  organization_id: string;
}

interface PersonPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (contact: Contact) => void;
  excludeIds?: string[];
  title?: string;
}

interface TreeNode extends Organization {
  children: TreeNode[];
  level: number;
}

const PersonPickerDialog = ({
  open,
  onOpenChange,
  onSelect,
  excludeIds = [],
  title = "选择人员",
}: PersonPickerDialogProps) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchData();
      setSearchTerm("");
      setSelectedOrgId(null);
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    const [orgsResult, contactsResult] = await Promise.all([
      dataAdapter.getOrganizations(),
      dataAdapter.getContacts({ is_active: true }),
    ]);
    if (orgsResult.data) setOrganizations(orgsResult.data);
    if (contactsResult.data) setContacts(contactsResult.data);
    // Auto-expand ALL levels
    if (orgsResult.data) {
      const allIds = orgsResult.data.map((o: Organization) => o.id);
      setExpandedIds(new Set(allIds));
      // Auto-select first root org so right side shows its people
      const firstRoot = orgsResult.data.find((o: Organization) => !o.parent_id);
      if (firstRoot) {
        setSelectedOrgId(firstRoot.id);
      }
    }
    setLoading(false);
  };

  // Build tree
  const tree = useMemo(() => {
    const buildTree = (parentId: string | null, level: number): TreeNode[] => {
      return organizations
        .filter((org) => org.parent_id === parentId)
        .map((org) => ({
          ...org,
          level,
          children: buildTree(org.id, level + 1),
        }));
    };
    return buildTree(null, 0);
  }, [organizations]);

  // Get descendant org IDs
  const getDescendantIds = (orgId: string): string[] => {
    const descendants: string[] = [orgId];
    organizations
      .filter((o) => o.parent_id === orgId)
      .forEach((child) => descendants.push(...getDescendantIds(child.id)));
    return descendants;
  };

  // Count contacts per org
  const contactCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach((c) => {
      counts[c.organization_id] = (counts[c.organization_id] || 0) + 1;
    });
    return counts;
  }, [contacts]);

  const getTotalCount = (orgId: string): number => {
    return getDescendantIds(orgId).reduce((sum, id) => sum + (contactCounts[id] || 0), 0);
  };

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let list = contacts.filter((c) => !excludeIds.includes(c.id));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.department?.toLowerCase().includes(term) ||
          c.position?.toLowerCase().includes(term)
      );
    } else if (selectedOrgId) {
      const orgIds = getDescendantIds(selectedOrgId);
      list = list.filter((c) => orgIds.includes(c.organization_id));
    }
    return list;
  }, [contacts, excludeIds, searchTerm, selectedOrgId, organizations]);

  const toggleExpand = (orgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedIds(newExpanded);
  };

  const handleSelect = (contact: Contact) => {
    onSelect(contact);
    onOpenChange(false);
  };

  const renderNode = (node: TreeNode): JSX.Element => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedOrgId === node.id;
    const count = getTotalCount(node.id);

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer text-sm transition-colors",
            "hover:bg-muted/50",
            isSelected && "bg-primary/10 text-primary font-medium"
          )}
          style={{ paddingLeft: `${node.level * 14 + 6}px` }}
          onClick={() => setSelectedOrgId(isSelected ? null : node.id)}
        >
          {hasChildren ? (
            <button className="p-0.5" onClick={(e) => toggleExpand(node.id, e)}>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 truncate">{node.name}</span>
          {count > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{count}</span>
          )}
        </div>
        {hasChildren && isExpanded && node.children.map((child) => renderNode(child))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索姓名、部门、职务..."
              className="pl-9 h-9"
            />
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>
        ) : (
          <div className="flex min-h-0" style={{ height: "50vh" }}>
            {/* Left: Org tree */}
            <div className="w-[220px] border-r flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-1.5">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer text-sm",
                      "hover:bg-muted/50",
                      !selectedOrgId && !searchTerm && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => { setSelectedOrgId(null); setSearchTerm(""); }}
                  >
                    <span className="w-4" />
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1">全部</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                      {contacts.filter((c) => !excludeIds.includes(c.id)).length}
                    </span>
                  </div>
                  {tree.map((node) => renderNode(node))}
                </div>
              </ScrollArea>
            </div>
            {/* Right: Contact list */}
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">无匹配人员</div>
                  ) : (
                    filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50 text-left transition-colors"
                        onClick={() => handleSelect(c)}
                      >
                        <UserCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[c.position, c.department].filter(Boolean).join(" · ") || "-"}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PersonPickerDialog;
