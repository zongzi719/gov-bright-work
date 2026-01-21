import { ExternalLink } from "lucide-react";

interface LinkItem {
  id: number;
  label: string;
  title: string;
  url: string;
}

const links: LinkItem[] = [
  { id: 1, label: "人民网", title: "人民网资料库", url: "http://www.people.com.cn" },
  { id: 2, label: "新华网", title: "新华网新闻中心", url: "http://www.xinhuanet.com" },
  { id: 3, label: "政府网", title: "中国政府网", url: "http://www.gov.cn" },
];

const ExternalLinks = () => {
  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">常用链接</h2>
      </div>

      <div className="p-5 space-y-3 flex-1 overflow-auto">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group"
          >
            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded font-medium">
              {link.label}
            </span>
            <span className="group-hover:underline">{link.title}</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default ExternalLinks;
