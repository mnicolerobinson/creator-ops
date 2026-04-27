import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

async function getContext(clientId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const [{ data: profile }, { data: access }] = await Promise.all([
    supabase.from("user_profiles").select("role, email, full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_clients")
      .select("client_id")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  const role = profile?.role ?? "";
  if (!access && !["operator", "superadmin"].includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, user, profile, role };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ client_id: string }> },
) {
  const { client_id: clientId } = await params;
  const ctx = await getContext(clientId);
  if ("error" in ctx) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("creator_messages")
    .select("id, client_id, sender, sender_user_id, body, read_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ client_id: string }> },
) {
  const { client_id: clientId } = await params;
  const ctx = await getContext(clientId);
  if ("error" in ctx) return ctx.error;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const sender = ["operator", "superadmin"].includes(ctx.role) ? "operator" : "creator";
  const { data: message, error } = await ctx.supabase
    .from("creator_messages")
    .insert({
      client_id: clientId,
      sender,
      sender_user_id: ctx.user.id,
      body: parsed.data.body,
      read_at: sender === "operator" ? null : null,
    })
    .select("id, client_id, sender, sender_user_id, body, read_at, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json(
      { error: error?.message ?? "Could not send message." },
      { status: 500 },
    );
  }

  if (sender === "creator") {
    const env = getEnv();
    if (env.RESEND_API_KEY) {
      const resend = new Resend(env.RESEND_API_KEY);
      await resend.emails.send({
        from: "CreatrOps <noreply@clairenhaus.com>",
        to: "ops@clairenhaus.com",
        subject: "New creator message in CreatrOps",
        text: `${ctx.profile?.full_name ?? ctx.profile?.email ?? "A creator"} sent a message:\n\n${parsed.data.body}`,
        html: `<p><strong>${ctx.profile?.full_name ?? ctx.profile?.email ?? "A creator"}</strong> sent a message:</p><p>${parsed.data.body.replace(/\n/g, "<br/>")}</p>`,
      });
    }
  }

  return NextResponse.json({ message });
}
