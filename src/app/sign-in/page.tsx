import { AtlasBrand } from "@/components/brand/AtlasBrand";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <AtlasBrand />

      <section
        className="mt-10 border bg-white p-6 sm:p-8"
        style={{
          borderColor: "var(--atlas-color-border)",
          borderRadius: "var(--atlas-radius-medium)",
        }}
      >
        <h2 className="text-2xl font-medium">Sign in</h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--atlas-color-text-secondary)" }}
        >
          Atlas Bodha is available by invitation.
        </p>

        {error ? (
          <p
            className="mt-4 text-sm"
            role="alert"
            style={{ color: "var(--atlas-color-accent)" }}
          >
            Email or password incorrect
          </p>
        ) : null}

        <form action="/api/auth/sign-in" className="mt-6 space-y-4" method="post">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="w-full border bg-white px-3 py-2"
              id="email"
              name="email"
              required
              style={{
                borderColor: "var(--atlas-color-border)",
                borderRadius: "var(--atlas-radius-small)",
              }}
              type="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="w-full border bg-white px-3 py-2"
              id="password"
              name="password"
              required
              style={{
                borderColor: "var(--atlas-color-border)",
                borderRadius: "var(--atlas-radius-small)",
              }}
              type="password"
            />
          </div>

          <button
            className="w-full px-4 py-2 font-medium text-white"
            style={{
              background: "var(--atlas-color-accent)",
              borderRadius: "var(--atlas-radius-small)",
            }}
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
