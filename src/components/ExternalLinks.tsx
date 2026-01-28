import { ExternalLink } from "lucide-react";
import peopleLogo from "@/assets/people-logo.webp";

const ExternalLinks = () => {
  return (
    <a
      href="http://www.people.com.cn"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-card rounded-md shadow-[var(--shadow-card)] border border-border hover:shadow-[var(--shadow-card-hover)] hover:border-primary/30 transition-all duration-200 group"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
        <img src={peopleLogo} alt="人民网" className="w-full h-full object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          人民网资料库
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </a>
  );
};

export default ExternalLinks;
