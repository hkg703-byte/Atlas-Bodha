import Link from "next/link";
import { AtlasBrand } from "@/components/brand/AtlasBrand";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  const errors: Record<string, string> = {
    used: 'This link has already been used.',
    expired: 'This link has expired.',
    invalid: 'This sign-in link is not valid.',
    unavailable: 'Sign-in is temporarily unavailable. Please try again.',
    resting: 'Atlas is resting. Please try again tomorrow.',
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-6">
      <AtlasBrand />
      <section className="mt-6 rounded-2xl border bg-white p-6" style={{ borderColor: 'var(--atlas-color-border)' }}>
        <h2 className="text-2xl font-medium">Enter your email</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--atlas-color-text-secondary)' }}>New here or returning, we’ll send you a sign-in link.</p>
        {sent ? <p role="status" className="mt-4">Check your email for a sign-in link</p> : error ? (
          <div className="mt-4" role="alert"><p>{errors[error] ?? errors.invalid}</p><Link className="mt-3 inline-block underline" href="/sign-in">Send a new link</Link></div>
        ) : (
          <form action="/api/auth/sign-in" method="post" className="mt-5 space-y-4">
            <div><label className="mb-1 block text-sm" htmlFor="email">Email</label><input className="w-full rounded-lg border px-3 py-2" id="email" name="email" type="email" autoComplete="email" maxLength={320} required /></div>
            <div><label className="mb-1 block text-sm" htmlFor="firstName">First name (optional)</label><input className="w-full rounded-lg border px-3 py-2" id="firstName" name="firstName" autoComplete="given-name" maxLength={100} /></div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="adult" required />I&apos;m 18 or older</label>
            <button className="w-full rounded-lg px-4 py-3 font-medium text-white" style={{ background: 'var(--atlas-color-accent)' }} type="submit">Send sign-in link</button>
          </form>
        )}
      </section>
    </main>
  );
}
