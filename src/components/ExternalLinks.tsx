const ExternalLinks = () => {
  return (
    <div className="bg-card rounded-md shadow-[var(--shadow-card)] border border-border">
      <a
        href="http://www.people.com.cn"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-2.5 transition-colors group rounded-md"
      >
        <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded font-medium">
          人民网
        </span>
        <span className="text-xs text-foreground group-hover:text-primary">人民网资料库</span>
      </a>
    </div>
  );
};

export default ExternalLinks;
