import { ExternalLink } from "lucide-react";

const ExternalLinks = () => {
  return (
    <a
      href="http://www.people.com.cn"
      target="_blank"
      rel="noopener noreferrer"
      className="gov-card flex items-center justify-between px-4 py-3 group cursor-pointer hover:shadow-card-hover transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
          <span className="text-white text-xs font-bold">人</span>
        </div>
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          人民网资料库
        </span>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </a>
  );
};

export default ExternalLinks;
