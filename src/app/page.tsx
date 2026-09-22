import { AtlasBrand } from "@/components/brand/AtlasBrand";
import { MessageComposer } from "@/components/conversation/MessageComposer";
import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <section className="flex flex-1 flex-col justify-center gap-10 pb-[18vh] sm:gap-12">
        <AtlasBrand />

        <section>
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
