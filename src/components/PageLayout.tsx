import Header from "./Header";

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout = ({ children }: PageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1920px] mx-auto p-4">
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
