import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email is not configured." }, { status: 501 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: parsed.data.email,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard`,
    },
  });

  if (error || !data.properties?.action_link) {
    console.error("Unable to generate onboarding magic link", error);
    return NextResponse.json(
      { error: "Could not create a sign-in link." },
      { status: 500 },
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: "CreatrOps <noreply@clairenhaus.com>",
    to: parsed.data.email,
    subject: "Your secure CreatrOps sign-in link",
    text: `Access your CreatrOps dashboard here: ${data.properties.action_link}`,
    html: `<p>Access your CreatrOps dashboard here:</p><p><a href="${data.properties.action_link}">Open your dashboard</a></p>`,
  });

  return NextResponse.json({ ok: true });
}
