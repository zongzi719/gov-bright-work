import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import * as dataAdapter from "@/lib/dataAdapter";
import { isOfflineMode } from "@/lib/offlineApi";
import peopleLogo from "@/assets/people-logo.webp";

interface ExternalLinkItem {
  id: string;
  title: string;
  url: string;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const resolveIconUrl = (iconUrl: string): string => {
  if (!iconUrl) return '';
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://') || iconUrl.startsWith('data:')) return iconUrl;
  if (isOfflineMode()) {
    const baseUrl = (window as any).GOV_CONFIG?.API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}${iconUrl}`;
  }
  return iconUrl;
};

const ExternalLinks = () => {
  const [links, setLinks] = useState<ExternalLinkItem[]>([]);

  useEffect(() => {
    const fetchLinks = async () => {
      const { data } = await dataAdapter.getExternalLinks({ is_active: true });
      setLinks(data || []);
    };
    fetchLinks();
  }, []);

  // 如果没有配置链接，显示默认的人民网链接
  const displayLinks = links.length > 0 ? links : [{
    id: 'default',
    title: '人民网资料库',
    url: 'http://www.people.com.cn',
    icon_url: null,
    sort_order: 0,
    is_active: true,
  }];

  return (
    <div className="space-y-2">
      {displayLinks.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 bg-card rounded-md shadow-[var(--shadow-card)] border border-border hover:shadow-[var(--shadow-card-hover)] hover:border-primary/30 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
            {link.icon_url ? (
              <img src={resolveIconUrl(link.icon_url)} alt={link.title} className="w-full h-full object-contain" />
            ) : link.id === 'default' ? (
              <img src={peopleLogo} alt={link.title} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center rounded-lg">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {link.title}
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
        </a>
      ))}
    </div>
  );
};

export default ExternalLinks;
