import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star, Phone, Mail } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface ContactTableProps {
  contacts: Contact[];
  loading: boolean;
  onSelectContact: (contact: Contact) => void;
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

const ContactTable = ({ contacts, loading, onSelectContact }: ContactTableProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        暂无联系人
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-[100px]">姓名</TableHead>
            <TableHead className="w-[120px]">职务</TableHead>
            <TableHead className="w-[120px]">部门</TableHead>
            <TableHead className="w-[120px]">办公电话</TableHead>
            <TableHead className="w-[180px]">邮箱</TableHead>
            <TableHead className="w-[70px]">密级</TableHead>
            <TableHead className="w-[70px]">领导</TableHead>
            <TableHead className="w-[70px]">状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const statusInfo = statusLabels[contact.status];
            const displayLevel = getDisplaySecurityLevel(contact.security_level);
            
            return (
              <TableRow 
                key={contact.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectContact(contact)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1">
                    {contact.name}
                    {contact.is_leader && (
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.position || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.department || '-'}
                </TableCell>
                <TableCell>
                  {contact.phone ? (
                    <a 
                      href={`tel:${contact.phone}`} 
                      className="text-primary hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3" />
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.email ? (
                    <a 
                      href={`mailto:${contact.email}`} 
                      className="text-primary hover:underline flex items-center gap-1 truncate max-w-[160px]"
                      onClick={(e) => e.stopPropagation()}
                      title={contact.email}
                    >
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={`${securityLevelStyles[displayLevel] || securityLevelStyles['公开']} text-xs px-1.5 py-0`}>
                    {displayLevel}
                  </Badge>
                </TableCell>
                <TableCell>
                  {contact.is_leader ? (
                    <Badge className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0">
                      是
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">否</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={`${statusInfo?.color || 'bg-gray-100 text-gray-500'} text-xs px-1.5 py-0`}>
                    {statusInfo?.label || contact.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
};

export default ContactTable;
