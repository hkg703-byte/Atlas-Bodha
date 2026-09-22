import { MemoryManager } from "@/components/memory/MemoryManager";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { requireCurrentUser } from "@/server/auth/requireCurrentUser";

export default async function MemoryPage() {
  await requireCurrentUser();

  return (
    <AppShell>
      <TopBar />
      <MemoryManager />
    </AppShell>
  );
}
