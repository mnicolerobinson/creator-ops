import { processInboundEmail } from "@/agents/intake";
import {
  createPgBoss,
  INTAKE_PROCESS_EMAIL_JOB,
} from "@/lib/jobs/pgboss";
import { createAdminClient } from "@/lib/supabase/admin";

type IntakeProcessEmailJob = {
  messageId?: string;
};

async function main() {
  const boss = createPgBoss();
  const supabase = createAdminClient();

  boss.on("error", (error) => {
    console.error("pg-boss worker error:", error);
  });

  await boss.start();
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

  console.log(`Worker listening for ${INTAKE_PROCESS_EMAIL_JOB}`);

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
