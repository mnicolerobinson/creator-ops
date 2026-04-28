import { PgBoss } from "pg-boss";
import { getEnv } from "@/lib/env";

export const INTAKE_PROCESS_EMAIL_JOB = "intake.process_email";
export const QUALIFICATION_SCORE_JOB = "qualification.score";

/**
 * pg-boss uses the same Postgres instance as the app (pg-boss creates its own schema).
 * Prefer PG_BOSS_DATABASE_URL when split from DATABASE_URL on Railway.
 */
export function resolvePgBossDatabaseUrl(): string {
  const direct =
    process.env.PG_BOSS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (direct) return direct;
  const fromEnv = getEnv().DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(
    "DATABASE_URL or PG_BOSS_DATABASE_URL must be set for pg-boss (Postgres connection string).",
  );
}

export function createPgBoss() {
  return new PgBoss(resolvePgBossDatabaseUrl());
}

export async function enqueuePgBossJob(
  name: string,
  data: Record<string, unknown>,
  options?: {
    singletonKey?: string;
    retryLimit?: number;
    retryDelay?: number;
  },
) {
  const boss = createPgBoss();
  await boss.start();
  try {
    await boss.send(name, data, {
      singletonKey: options?.singletonKey,
      retryLimit: options?.retryLimit ?? 3,
      retryDelay: options?.retryDelay ?? 30,
    });
  } finally {
    await boss.stop();
  }
}
