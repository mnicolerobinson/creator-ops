"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";

const SHARE_URL_BASE = "https://creatrops.com";

export function ReferralQrClient({
  referralCode,
  qrDataUrl,
}: {
  referralCode: string;
  qrDataUrl: string;
}) {
  const refUrl = `${SHARE_URL_BASE}?ref=${encodeURIComponent(referralCode)}`;
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const onCopy = useCallback(async () => {
    await navigator.clipboard.writeText(refUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [refUrl]);

  const onDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050505",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `creatrops-referral-${referralCode}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }, [referralCode]);

  const onShare = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      void onCopy();
      return;
    }
    try {
      await navigator.share({
        title: "CreatrOps",
        text: "Join me on CreatrOps",
        url: refUrl,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") void onCopy();
    }
  }, [onCopy, refUrl]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div
        ref={cardRef}
        className="relative w-full max-w-[360px] overflow-hidden rounded-none border border-white/[0.08] p-10"
        style={{
          background: `
            linear-gradient(135deg, rgba(30,20,20,0.98) 0%, rgba(18,12,12,0.99) 30%,
            rgba(24,16,16,0.97) 50%, rgba(14,10,10,0.99) 70%, rgba(26,18,18,0.98) 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: `repeating-linear-gradient(
              92deg, transparent, transparent 48px, rgba(255,255,255,0.03) 49px, transparent 50px)`,
            mixBlendMode: "overlay",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 animate-[sheen_4s_ease-in-out_infinite]"
          style={{
            background: `linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.04) 35%,
            rgba(255,255,255,0.06) 45%, rgba(201,168,76,0.05) 50%, rgba(255,255,255,0.04) 55%,
            transparent 70%)`,
            transform: "translateX(-100%)",
            animation: "sheen 4s ease-in-out infinite",
          }}
        />
        <style>{`
          @keyframes sheen {
            0% { transform: translateX(-100%); }
            40%, 100% { transform: translateX(200%); }
          }
        `}</style>
        <div
          className="absolute left-0 right-0 top-0 h-0.5"
          style={{
            background: "linear-gradient(to right, transparent, #C8102E, #C9A84C, transparent)",
          }}
        />

        <div className="relative z-[2] text-center">
          <p
            className="font-[family-name:var(--font-bebas)] text-[26px] tracking-[0.35em] text-[#FAFAFA]"
            style={{ fontFamily: "var(--font-bebas), Bebas Neue, sans-serif" }}
          >
            Creatr<span className="text-[#C8102E]">Ops</span>
          </p>
          <p className="mt-1.5 text-[7px] uppercase tracking-[0.4em] text-[#C9A84C]">Referral</p>
        </div>

        <div className="relative z-[2] mt-6 flex flex-col items-center">
          <div
            className="relative flex h-[220px] w-[220px] items-center justify-center"
            style={{
              boxShadow: "0 0 40px rgba(200, 16, 46, 0.2)",
            }}
          >
            <div
              className="absolute inset-[-20px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(200,16,46,0.2) 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute inset-0 animate-[bd_3s_ease-in-out_infinite_alternate] border"
              style={{ borderColor: "rgba(200,16,46,0.3)" }}
            />
            <style>{`
              @keyframes bd { from { border-color: rgba(200,16,46,0.2);} to { border-color: rgba(200,16,46,0.45);} }
            `}</style>
            <div className="absolute inset-[-6px] rounded-full border border-dashed border-[#C9A84C]/20" />
            <div
              className="relative z-[1] flex h-[200px] w-[200px] items-center justify-center"
              style={{ background: "#FAFAFA" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt=""
                width={180}
                height={180}
                className="h-[180px] w-[180px]"
                style={{ imageRendering: "pixelated" }}
              />
              <div
                className="pointer-events-none absolute left-0 right-0 h-0.5"
                style={{
                  background: "linear-gradient(to right, transparent, rgba(200,16,46,0.7), transparent)",
                  animation: "scan 2.5s ease-in-out infinite",
                  top: 0,
                }}
              />
              <style>{`
                @keyframes scan {
                  0% { top: 0; opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
              `}</style>
            </div>
          </div>
        </div>

        <p
          className="relative z-[2] mt-6 text-center font-[family-name:var(--font-cormorant)] text-xl font-light text-[#FAFAFA]"
          style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif" }}
        >
          Your referral link
        </p>
        <p className="relative z-[2] mt-2 break-all px-1 text-center text-[10px] font-light leading-relaxed tracking-[0.2em] text-[#B0A89A]">
          {refUrl}
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={downloading}
          className="rounded-full border border-[#C8102E] bg-[#C8102E] px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-[#A50D25] disabled:opacity-50"
        >
          {downloading ? "…" : "Download"}
        </button>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="rounded-full border border-[#C9A84C]/50 bg-transparent px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C9A84C] transition hover:border-[#C9A84C]"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => void onShare()}
          className="rounded-full border border-[#2A211C] bg-[#111] px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-[#F7F0E8] transition hover:border-[#C9A84C]/40"
        >
          Share
        </button>
      </div>
    </div>
  );
}
