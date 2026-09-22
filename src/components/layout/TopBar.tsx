import Link from "next/link";

export function TopBar() {
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 border-b py-3"
      style={{ borderColor: "var(--atlas-color-border)" }}
    >
      <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm">
        <Link className="font-medium hover:underline" href="/">
          New conversation
        </Link>
        <Link className="hover:underline" href="/memory">
          Memory
        </Link>
      </nav>
    </header>
  );
}
