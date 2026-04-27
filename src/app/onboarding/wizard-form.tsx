"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type SaveAction = (formData: FormData) => Promise<void>;
type Intent = "next" | "back" | "later" | "test";

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-[#C8102E]"
    />
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4 text-[#B0A89A]">
        <span
          aria-hidden="true"
          className="h-9 w-9 animate-spin rounded-full border-2 border-[#2A211C] border-t-[#C8102E]"
        />
        <p className="text-[11px] uppercase tracking-[0.25em]">Loading...</p>
      </div>
    </div>
  );
}

export function WizardForm({
  action,
  children,
  nextHref,
  backHref,
  showBack = true,
  showTestButton = false,
}: {
  action: SaveAction;
  children: React.ReactNode;
  nextHref: string;
  backHref: string;
  showBack?: boolean;
  showTestButton?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeIntent, setActiveIntent] = useState<Intent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSaving = isPending || activeIntent !== null;

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  function saveAndNavigate(intent: Intent) {
    const form = formRef.current;
    if (!form) return;
    if (intent === "next" && !form.reportValidity()) return;

    setError(null);
    setActiveIntent(intent);
    const formData = new FormData(form);
    if (intent === "test") {
      formData.set("send_test_email", "on");
    }

    startTransition(async () => {
      try {
        await action(formData);
        if (intent === "back") {
          router.push(backHref);
        } else if (intent === "later") {
          router.push("/dashboard");
        } else {
          router.push(nextHref);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this step.");
        setActiveIntent(null);
      }
    });
  }

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <form ref={formRef} className="space-y-6">
      {children}

      {showTestButton ? (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => saveAndNavigate("test")}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#C9A84C]/40 px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-[#C9A84C] transition hover:border-[#C9A84C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeIntent === "test" ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Send test email"
          )}
        </button>
      ) : null}

      {error ? <p className="text-sm text-[#C9A84C]">{error}</p> : null}

      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => saveAndNavigate("next")}
          className="flex items-center justify-center gap-2 rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeIntent === "next" ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Save and Continue"
          )}
        </button>
        <div className="flex items-center justify-between text-sm text-[#B0A89A]">
          {showBack ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => saveAndNavigate("back")}
              className="transition hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeIntent === "back" ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Saving...
                </span>
              ) : (
                "Back"
              )}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => saveAndNavigate("later")}
            className="transition hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeIntent === "later" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Saving...
              </span>
            ) : (
              "Save and continue later"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
