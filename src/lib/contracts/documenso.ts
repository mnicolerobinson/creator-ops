import { getEnv } from "@/lib/env";

export type DocumensoDraftArgs = {
  templateId: string;
  title: string;
  meta: Record<string, string>;
};

/**
 * Create a Documenso document from a template (hosted v1).
 * Requires DOCUMENSO_API_URL and DOCUMENSO_API_KEY when enabled.
 */
export async function createDraftFromTemplate(
  args: DocumensoDraftArgs,
): Promise<{ documentId: string | null; skipped: boolean; detail?: string }> {
  const env = getEnv();
  if (!env.DOCUMENSO_API_KEY || !env.DOCUMENSO_API_URL) {
    return {
      documentId: null,
      skipped: true,
      detail: "Documenso not configured",
    };
  }

  const res = await fetch(`${env.DOCUMENSO_API_URL.replace(/\/$/, "")}/api/v1/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DOCUMENSO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: args.title,
      templateId: args.templateId,
      meta: args.meta,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { documentId: null, skipped: false, detail: text };
  }

  const json = (await res.json()) as { id?: string };
  return { documentId: json.id ?? null, skipped: false };
}
