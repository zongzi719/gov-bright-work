import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Building2, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
}

interface OrganizationTreeProps {
  organizations: Organization[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
  contactCounts: Record<string, number>;
}

interface TreeNode extends Organization {
  children: TreeNode[];
  level: number;
}

const OrganizationTree = ({ 
  organizations, 
  selectedOrgId, 
  onSelectOrg,
  contactCounts 
}: OrganizationTreeProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Build tree structure
  const tree = useMemo(() => {
    const buildTree = (parentId: string | null, level: number): TreeNode[] => {
      return organizations
        .filter(org => org.parent_id === parentId)
        .map(org => ({
          ...org,
          level,
          children: buildTree(org.id, level + 1)
        }));
    };
    return buildTree(null, 0);
  }, [organizations]);

  // Get all descendant org IDs for counting
  const getDescendantIds = (orgId: string): string[] => {
    const descendants: string[] = [orgId];
    const children = organizations.filter(o => o.parent_id === orgId);
    children.forEach(child => {
      descendants.push(...getDescendantIds(child.id));
    });
    return descendants;
  };

  // Get total contact count for an org (including children)
  const getTotalCount = (orgId: string): number => {
    const descendantIds = getDescendantIds(orgId);
    return descendantIds.reduce((sum, id) => sum + (contactCounts[id] || 0), 0);
  };

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

  const handleSelectOrg = (orgId: string) => {
    onSelectOrg(selectedOrgId === orgId ? null : orgId);
  };

  const renderNode = (node: TreeNode): JSX.Element => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedOrgId === node.id;
    const totalCount = getTotalCount(node.id);

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors",
            "hover:bg-muted/50",
            isSelected && "bg-primary/10 text-primary font-medium"
          )}
          style={{ paddingLeft: `${node.level * 16 + 8}px` }}
          onClick={() => handleSelectOrg(node.id)}
        >
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded"
              onClick={(e) => toggleExpand(node.id, e)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 truncate text-sm">{node.name}</span>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {totalCount}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  // Calculate total contacts
  const totalContacts = Object.values(contactCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="h-full flex flex-col border-r">
      <div className="p-3 border-b">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          组织架构
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* All contacts option */}
          <div
            className={cn(
              "flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors",
              "hover:bg-muted/50",
              selectedOrgId === null && "bg-primary/10 text-primary font-medium"
            )}
            onClick={() => onSelectOrg(null)}
          >
            <span className="w-5" />
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm">全部人员</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {totalContacts}
            </span>
          </div>
          
          {/* Organization tree */}
          {tree.map(node => renderNode(node))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default OrganizationTree;
