import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Phone, Mail, MapPin, Building2, Star } from "lucide-react";

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

interface ContactDetailDialogProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Organization[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  on_duty: { label: "在职", color: "bg-green-100 text-green-700 border-green-200" },
  out: { label: "外出", color: "bg-purple-100 text-purple-700 border-purple-200" },
  leave: { label: "请假", color: "bg-orange-100 text-orange-700 border-orange-200" },
  business_trip: { label: "出差", color: "bg-blue-100 text-blue-700 border-blue-200" },
  meeting: { label: "会议", color: "bg-amber-100 text-amber-700 border-amber-200" },
};

const securityLevelStyles: Record<string, string> = {
  '机密': 'bg-red-100 text-red-700',
  '秘密': 'bg-orange-100 text-orange-700',
  '内部': 'bg-blue-100 text-blue-700',
  '公开': 'bg-gray-100 text-gray-500',
  '一般': 'bg-gray-100 text-gray-500',
};

const getDisplaySecurityLevel = (level: string | null | undefined): string => {
  if (!level || level === '一般') return '公开';
  return level;
};

const ContactDetailDialog = ({ 
  contact, 
  open, 
  onOpenChange, 
  organizations 
}: ContactDetailDialogProps) => {
  
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

  if (!contact) return null;

  const displayLevel = getDisplaySecurityLevel(contact.security_level);
  const orgPath = getOrganizationPath(contact.organization_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>联系人详情</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">{contact.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-semibold">{contact.name}</h3>
                {contact.is_leader && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    领导
                  </Badge>
                )}
                <Badge className={statusLabels[contact.status]?.color}>
                  {statusLabels[contact.status]?.label || contact.status}
                </Badge>
                <Badge className={securityLevelStyles[displayLevel]}>
                  {displayLevel}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{contact.position || "-"}</p>
            </div>
          </div>

          {/* Organization hierarchy */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">组织架构</Label>
                <div className="mt-1">
                  {orgPath.length > 0 ? (
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
                  )}
                </div>
                {contact.department && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground">所属部门</Label>
                    <div className="text-primary font-medium">{contact.department}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">联系方式</Label>
            <div className="grid gap-3">
              {contact.mobile && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">手机</p>
                    <a href={`tel:${contact.mobile}`} className="text-primary hover:underline font-medium">
                      {contact.mobile}
                    </a>
                  </div>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">办公电话</p>
                    <span className="font-medium">{contact.phone}</span>
                  </div>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">邮箱</p>
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline font-medium">
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}
              {contact.office_location && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">办公位置</p>
                    <span className="font-medium">{contact.office_location}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactDetailDialog;
