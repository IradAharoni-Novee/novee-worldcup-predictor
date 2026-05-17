"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { veeveeToast } from "@/components/ui/veevee-toast";
import { submitFlag, type CtfSubmitResult } from "@/lib/actions/ctf";

export function SubmitFlagForm() {
  const [state, action, pending] = useActionState<
    CtfSubmitResult | null,
    FormData
  >(submitFlag, null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      formRef.current?.reset();
      if (state.alreadyCaptured) {
        veeveeToast(`You already had ${state.slug}. VeeVee remembers.`);
      } else {
        veeveeToast(`Captured ${state.slug} — +${state.points} pts.`);
      }
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 flex flex-col gap-1.5">
        <Label htmlFor="code" className="sr-only">
          Flag
        </Label>
        <Input
          id="code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="novee{...}"
          maxLength={200}
          size="lg"
          className="font-mono"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Checking…" : "Submit"}
      </Button>
      {state && !state.ok && (
        <p className="basis-full body body-size-small text-[color:var(--color-accent-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
