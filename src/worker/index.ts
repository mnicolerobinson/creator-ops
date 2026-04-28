import { processInboundEmail } from "@/agents/intake";
import { runQualificationScore } from "@/agents/qualification";
import {
  createPgBoss,
  INTAKE_PROCESS_EMAIL_JOB,
  QUALIFICATION_SCORE_JOB,
  resolvePgBossDatabaseUrl,
} from "@/lib/jobs/pgboss";
import { createAdminClient } from "@/lib/supabase/admin";

type IntakeProcessEmailJob = {
  messageId?: string;
};

type QualificationScoreJob = {
  dealId: string;
  clientId?: string;
  messageId?: string;
};

async function main() {
  const dbPreview = resolvePgBossDatabaseUrl().replace(/:[^:@]+@/, ":****@");
  console.log(`[worker] pg-boss DATABASE_URL resolved (${dbPreview.slice(0, 48)}…)`);

  const boss = createPgBoss();
  const supabase = createAdminClient();

  boss.on("error", (error) => {
    console.error("pg-boss worker error:", error);
  });

  await boss.start();
  console.log("[worker] pg-boss started; registering handlers…");
  await boss.work<IntakeProcessEmailJob>(
    INTAKE_PROCESS_EMAIL_JOB,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async (jobs) => {
      for (const job of jobs) {
        if (!job.data.messageId) {
          throw new Error("intake.process_email missing messageId.");
        }
        await processInboundEmail(supabase, job.data.messageId);
      }
    },
  );

  await boss.work<QualificationScoreJob>(
    QUALIFICATION_SCORE_JOB,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async (jobs) => {
      for (const job of jobs) {
        if (!job.data.dealId) {
          throw new Error("qualification.score missing dealId.");
        }
        await runQualificationScore(supabase, {
          dealId: job.data.dealId,
          clientId: job.data.clientId,
          messageId: job.data.messageId,
        });
      }
    },
  );

  console.log(
    `Worker listening for ${INTAKE_PROCESS_EMAIL_JOB}, ${QUALIFICATION_SCORE_JOB}`,
  );

  const shutdown = async () => {
    console.log("Stopping worker...");
    await boss.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
