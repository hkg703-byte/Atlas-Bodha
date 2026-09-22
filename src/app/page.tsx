import { AtlasBrand } from "@/components/brand/AtlasBrand";
import { MessageComposer } from "@/components/conversation/MessageComposer";
import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <section className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center py-16">
          <AtlasBrand />
        </div>

        <section className="pb-2">
          <p
            className="mb-4 text-center"
            style={{
              color: "var(--atlas-color-text-secondary)",
            }}
          >
            What would you like to explore?
          </p>

          <MessageComposer />
        </section>
      </section>
    </AppShell>
  );
}
