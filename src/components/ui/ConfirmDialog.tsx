"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  /** Controlled open state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title — short, imperative (e.g. "Unenroll user?"). */
  title: string;
  /** Body copy explaining the consequence. */
  description: React.ReactNode;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** If true, confirm button uses destructive styling. Defaults to true. */
  destructive?: boolean;
  /** Called when the user confirms. Can be async; dialog stays open until resolved. */
  onConfirm: () => void | Promise<void>;
  /** Disables the confirm button AND shows "Working…" (e.g. while a request is in flight). */
  loading?: boolean;
  /** Disables the confirm button without changing its label — for unmet preconditions
   *  like an unchecked "I understand" box or an unfilled confirm-text input. */
  disabled?: boolean;
}

/**
 * Reusable confirmation dialog for destructive actions (deletes, unenrolls, etc.).
 * Built on top of shadcn's AlertDialog / Radix primitives — focus-trapped, ESC-to-close,
 * and keyboard-accessible by default.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  loading = false,
  disabled = false,
}: ConfirmDialogProps) {
  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading || disabled}
            aria-busy={loading || undefined}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
