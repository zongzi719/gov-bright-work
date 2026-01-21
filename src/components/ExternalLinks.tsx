const ExternalLinks = () => {
  return (
    <div className="bg-card rounded-md shadow-[var(--shadow-card)]">
      <a
        href="http://www.people.com.cn"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors group rounded-md"
      >
        <span className="px-2.5 py-1 bg-primary text-primary-foreground text-sm rounded font-medium">
          人民网
        </span>
        <span className="text-sm text-foreground group-hover:text-primary">人民网资料库</span>
      </a>
    </div>
  );
};

export default ExternalLinks;
