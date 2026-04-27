import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveInboxSetup } from "../actions";
import { StepShell } from "../_components";

function slug(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "creator"
  );
}

async function getDedicatedEmail() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "handle@ops.creatrops.com";

  const { data: access } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!access?.client_id) return `${slug(user.email?.split("@")[0])}@ops.creatrops.com`;

  const { data: client } = await supabase
    .from("clients")
    .select("handle_tiktok, handle_instagram, handle_youtube, creator_display_name")
    .eq("id", access.client_id)
    .maybeSingle();

  const handle =
    client?.handle_tiktok ??
    client?.handle_instagram ??
    client?.handle_youtube ??
    client?.creator_display_name ??
    user.email?.split("@")[0];

  return `${slug(handle)}@ops.creatrops.com`;
}

export default async function OnboardingStepSix() {
  const dedicatedEmail = await getDedicatedEmail();

  return (
    <StepShell
      eyebrow="Step 6 of 7"
      title="Inbox setup"
      body="Forward brand inquiries to your dedicated ops inbox so Sarah can start triaging opportunities."
    >
      <form action={saveInboxSetup} className="space-y-6">
        <input type="hidden" name="dedicated_email" value={dedicatedEmail} />
        <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#0B0B0B] p-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
            Dedicated brand inquiry email
          </p>
          <p className="mt-3 break-all font-[var(--font-cormorant)] text-3xl text-[#C9A84C]">
            {dedicatedEmail}
          </p>
        </div>

        <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Email provider
          <select
            name="forwarding_provider"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
          >
            <option>Gmail</option>
            <option>iCloud</option>
            <option>Outlook</option>
          </select>
        </label>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#141414] p-5 text-sm leading-7 text-[#B0A89A]">
          <div>
            <p className="font-medium text-[#FAFAFA]">Gmail</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open Gmail settings and choose Forwarding and POP/IMAP.</li>
              <li>Add {dedicatedEmail} as a forwarding address.</li>
              <li>Confirm the forwarding address, then create a filter for brand inquiry emails.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-[#FAFAFA]">iCloud</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open iCloud Mail settings and choose Rules.</li>
              <li>Create a rule for partnership, collab, sponsor, and PR emails.</li>
              <li>Forward matching messages to {dedicatedEmail}.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-[#FAFAFA]">Outlook</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open Outlook settings, then Mail, Rules.</li>
              <li>Create a new rule for incoming partnership inquiries.</li>
              <li>Forward those messages to {dedicatedEmail}.</li>
            </ol>
          </div>
        </div>

        <button
          type="submit"
          name="send_test_email"
          value="on"
          className="w-full rounded-full border border-[#C9A84C]/40 px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-[#C9A84C] transition hover:border-[#C9A84C]"
        >
          Send test email
        </button>

        <div className="flex flex-col gap-3 pt-2">
          <button className="rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]">
            Save and Continue
          </button>
          <div className="flex items-center justify-between text-sm text-[#B0A89A]">
            <Link href="/onboarding/step-5">Back</Link>
            <Link href="/dashboard">Save and continue later</Link>
          </div>
        </div>
      </form>
    </StepShell>
  );
}
