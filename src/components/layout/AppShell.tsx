import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="h-dvh overflow-hidden px-4 sm:px-6">
      <div
        className="mx-auto flex h-full w-full flex-col"
        style={{
          maxWidth: "var(--atlas-content-width)",
        }}
      >
        {children}
      </div>
    </main>
  );
}
