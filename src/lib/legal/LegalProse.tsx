import type { ReactNode } from "react";

function splitToSections(markdown: string) {
  return markdown
    .split(/(?=^### )/m)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatBold(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-[#F7F0E8]">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

function renderParagraphs(body: string) {
  const lines = body.split("\n");
  const out: ReactNode[] = [];
  const list: string[] = [];
  const flushList = (key: number) => {
    if (list.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#B0A89A]">
        {list.splice(0).map((line, li) => (
          <li key={li} className="pl-0.5">
            {formatBold(line.replace(/^- /, ""))}
          </li>
        ))}
      </ul>,
    );
  };
  let listKey = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("- ")) {
      list.push(t);
    } else {
      flushList(listKey++);
      out.push(
        <p
          key={`p-${out.length}`}
          className="text-sm leading-relaxed text-[#B0A89A] [&+p]:mt-3"
        >
          {formatBold(t)}
        </p>,
      );
    }
  }
  flushList(listKey);
  return out;
}

function SectionBlock({ block }: { block: string }) {
  const lines = block.split("\n");
  const first = lines[0] ?? "";
  const h3 = first.startsWith("### ") ? first.slice(4).trim() : null;
  const body = h3 ? lines.slice(1).join("\n") : block;
  if (h3) {
    return (
      <div className="border-b border-[#C9A84C]/25 pb-8 pt-2 last:border-0 last:pb-0">
        <h3 className="font-[var(--font-cormorant)] text-xl font-light tracking-wide text-[#F7F0E8]">
          {h3}
        </h3>
        <div className="mt-4 space-y-4">{renderParagraphs(body)}</div>
      </div>
    );
  }
  return (
    <div className="space-y-4 border-b border-[#C9A84C]/25 pb-8 first:pt-0 last:border-0">
      {renderParagraphs(body)}
    </div>
  );
}

export function LegalProse({ markdown }: { markdown: string }) {
  const sections = splitToSections(markdown);
  return (
    <div className="space-y-10">
      {sections.map((block, i) => (
        <SectionBlock key={i} block={block} />
      ))}
    </div>
  );
}
