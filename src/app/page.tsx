import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Clairen Haus
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
        Creator Ops
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-600">
        Autonomous back-office for creators — intake, deals, contracts, and billing
        with human approval where it matters.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/login"
          className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Sign in
        </Link>
        <Link
          href="/portal"
          className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Creator portal
        </Link>
        <Link
          href="/ops"
          className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Ops console
        </Link>
      </div>
    </div>
  );
}
