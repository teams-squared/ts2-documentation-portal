"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type FormButtonState = "idle" | "pending" | "success";

interface FormButtonProps extends React.ComponentProps<typeof Button> {
  /** Override automatic useFormStatus() detection. Use when submitting via fetch instead of a server action. */
  loading?: boolean;
  /** Edge-triggered: when this prop transitions truthy, the button flashes the success affirmation and self-clears. */
  success?: boolean;
  /** Label rendered while pending. Defaults to the children. */
  pendingLabel?: React.ReactNode;
  /** Label rendered during the success affirmation. Defaults to the children. */
  successLabel?: React.ReactNode;
  /** ms to hold the success state before reverting to idle. Default 1200 (600ms full + 600ms decay). */
  successHoldMs?: number;
}

/**
 * Submit-state button — design-system §9.9.
 *
 * Wraps `<Button>` with an idle → pending → success state machine. Renders
 * a spinner while pending, a checkmark on success. Inside a `<form>` it
 * picks up React 19's `useFormStatus()` automatically; outside a form,
 * pass `loading={isPending}` for fetch-based submits.
 *
 * The `success` prop is edge-triggered: set it true once after the mutation
 * resolves and the button manages the hold + revert. Consumer never needs
 * to clear `success` back to false.
 *
 * Three-layer reduced-motion: the Loader2 spinner and Check icon use Tailwind
 * `animate-spin` / `animate-scale-in`, both already covered by the global
 * CSS kill-switch in `globals.css`. The success timer is purely a state
 * transition, not animation frames — no JS short-circuit required.
 */
export function FormButton({
  loading: loadingProp,
  success,
  pendingLabel,
  successLabel,
  successHoldMs = 1200,
  children,
  disabled,
  ...props
}: FormButtonProps) {
  const formStatus = useFormStatus();
  const loading = loadingProp ?? formStatus.pending;

  const [internalSuccess, setInternalSuccess] = useState(false);
  const timerRef = useRef<number | null>(null);
  const prevSuccessRef = useRef<boolean>(false);

  useEffect(() => {
    const wasFalse = !prevSuccessRef.current;
    prevSuccessRef.current = !!success;
    if (!success || !wasFalse) return;

    // Legitimate prop-watching: success transitions false→true once per
    // submit cycle. The pulse-and-clear pattern needs to setState here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalSuccess(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setInternalSuccess(false);
      timerRef.current = null;
    }, successHoldMs);
  }, [success, successHoldMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const state: FormButtonState = loading
    ? "pending"
    : internalSuccess
      ? "success"
      : "idle";

  return (
    <Button
      {...props}
      disabled={disabled || loading}
      data-state={state}
      aria-busy={state === "pending" || undefined}
    >
      {state === "pending" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {pendingLabel ?? children}
        </>
      ) : state === "success" ? (
        <>
          <Check
            className="h-4 w-4 motion-safe:animate-scale-in"
            aria-hidden="true"
          />
          {successLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
