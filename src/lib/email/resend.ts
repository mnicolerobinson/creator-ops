import { Resend } from "resend";
import { getEnv } from "@/lib/env";

export async function sendPersonaEmail(args: {
  from: string;
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}): Promise<{ id: string | null; skipped: boolean; error?: string }> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    return {
      id: null,
      skipped: true,
      error: "RESEND_API_KEY not configured",
    };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.EMAIL_FROM ?? args.from;
  const { data, error } = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    headers: args.headers,
  });
  if (error) {
    return { id: null, skipped: false, error: error.message };
  }
  return { id: data?.id ?? null, skipped: false };
}
