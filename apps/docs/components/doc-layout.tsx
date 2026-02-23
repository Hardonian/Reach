import { Nav } from "./nav";

interface DocLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  title: string;
}

export function DocLayout({ children, currentPath, title }: DocLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Nav currentPath={currentPath} />
      <main className="flex-1 p-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{title}</h1>
        <div className="prose max-w-none">{children}</div>
      </main>
    </div>
  );
}
