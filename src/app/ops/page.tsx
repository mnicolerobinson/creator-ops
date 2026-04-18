import Link from "next/link";

export default async function OpsHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ops console</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Internal view — queue, escalations, and agent actions.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/ops/deals"
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
        >
          <p className="font-medium text-zinc-900">Deals</p>
          <p className="mt-1 text-sm text-zinc-600">
            Pipeline, approvals, and contract workflow.
          </p>
        </Link>
        <Link
          href="/ops/escalations"
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
        >
          <p className="font-medium text-zinc-900">Escalations</p>
          <p className="mt-1 text-sm text-zinc-600">
            Bot detection, legal, and policy exceptions.
          </p>
        </Link>
        <Link
          href="/ops/audit"
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
        >
          <p className="font-medium text-zinc-900">Audit log</p>
          <p className="mt-1 text-sm text-zinc-600">
            Agent actions with confidence and results.
          </p>
        </Link>
      </ul>
    </div>
  );
}
