import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div
        className="mx-auto flex min-h-[calc(100vh-3rem)] w-full flex-col sm:min-h-[calc(100vh-5rem)]"
        style={{
          maxWidth: "var(--atlas-content-width)",
        }}
      >
        {children}
      </div>
    </main>
  );
}
