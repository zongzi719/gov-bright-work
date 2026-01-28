import { ExternalLink } from "lucide-react";

const ExternalLinks = () => {
  return (
    <a
      href="http://www.people.com.cn"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-card rounded-md shadow-[var(--shadow-card)] border border-border hover:shadow-[var(--shadow-card-hover)] hover:border-primary/30 transition-all duration-200 group"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <span className="text-primary font-bold text-base">人</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          人民网资料库
        </div>
        {/* <div className="text-xs text-muted-foreground truncate">
          www.people.com.cn
        </div> */}
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </a>
  );
};

export default ExternalLinks;
