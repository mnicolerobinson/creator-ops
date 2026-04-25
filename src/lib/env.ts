import { z } from "zod";

/** Allow `next build` in CI without real Supabase project keys. */
if (process.env.CI === "true") {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://placeholder.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "ci-placeholder-anon-key";
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://app.creatrops.com";
}

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  INTAKE_WEBHOOK_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_STARTER_OPS: z.string().min(1).optional(),
  STRIPE_PRICE_GROWTH_OPS: z.string().min(1).optional(),
  STRIPE_PRICE_CREATOR_CEO: z.string().min(1).optional(),
  OPS_EMAIL_DOMAIN: z.string().min(1).default("ops.creatrops.com"),
  DOCUMENSO_API_URL: z.string().url().optional(),
  DOCUMENSO_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    INTAKE_WEBHOOK_SECRET: process.env.INTAKE_WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_STARTER_OPS: process.env.STRIPE_PRICE_STARTER_OPS,
    STRIPE_PRICE_GROWTH_OPS: process.env.STRIPE_PRICE_GROWTH_OPS,
    STRIPE_PRICE_CREATOR_CEO: process.env.STRIPE_PRICE_CREATOR_CEO,
    OPS_EMAIL_DOMAIN: process.env.OPS_EMAIL_DOMAIN,
    DOCUMENSO_API_URL: process.env.DOCUMENSO_API_URL,
    DOCUMENSO_API_KEY: process.env.DOCUMENSO_API_KEY,
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment: ${JSON.stringify(msg)}. Copy .env.example to .env.local.`,
    );
  }
  return parsed.data;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    cached = load();
  }
  return cached;
}

export function getServiceRoleKey(): string {
  const key = getEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this operation.");
  }
  return key;
}
