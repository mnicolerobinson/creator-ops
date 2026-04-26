import { PgBoss } from "pg-boss";
import { getEnv } from "@/lib/env";

export const INTAKE_PROCESS_EMAIL_JOB = "intake.process_email";
export const QUALIFICATION_SCORE_JOB = "qualification.score";

export function createPgBoss() {
  const databaseUrl = getEnv().DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for pg-boss.");
  }

  return new PgBoss(databaseUrl);
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
