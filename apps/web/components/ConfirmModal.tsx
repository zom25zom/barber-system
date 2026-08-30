"use client";

/**
 * Confirmation modal — migrated to shadcn/ui AlertDialog (Phase 2).
 *
 * PUBLIC PROPS API UNCHANGED: every existing call site keeps working
 * (isOpen/title/message/confirmText/cancelText/variant/icon/isLoading/
 * onConfirm/onClose). Only the presentation layer moved from a hand-rolled
 * overlay to a Radix AlertDialog styled with the Barber Smart tokens.
 *
 * `icon` now accepts a ReactNode (lucide component); each variant also has a
 * sensible lucide default so no emoji is rendered anywhere.
 */

import type { ReactNode } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CircleHelp, Trash2 } from "lucide-react";
import Spinner from "./Spinner";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  /** Optional custom icon (lucide component). Falls back to a per-variant default. */
  icon?: ReactNode;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "danger",
  icon,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  // Visual mapping (unchanged semantics): danger→destructive, warning→gold, primary→primary
  const visual = {
    danger: {
      icon: <Trash2 className="h-5 w-5 text-[var(--bs-error)]" aria-hidden="true" />,
      iconBg: "bg-[var(--bs-error-soft)] border-[var(--bs-error)]/40",
      btnVariant: "destructive" as const,
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-[var(--bs-warning)]" aria-hidden="true" />,
      iconBg: "bg-[var(--bs-warning-soft)] border-[var(--bs-warning)]/40",
      btnVariant: "default" as const, // gold — the brand accent
    },
    primary: {
      icon: <CircleHelp className="h-5 w-5 text-[var(--bs-primary)]" aria-hidden="true" />,
      iconBg: "bg-[var(--bs-primary-soft)] border-[var(--bs-primary)]/40",
      btnVariant: "default" as const,
    },
  }[variant];

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader className="sm:text-right">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${visual.iconBg}`}
            >
              {icon ?? visual.icon}
            </div>
            <div className="flex-1 text-right">
              <AlertDialogTitle className="text-right">{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-right">
                {message}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-3 border-t border-[var(--bs-border)] pt-4 sm:flex-row sm:justify-start">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={visual.btnVariant}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" color="white" />
                <span>جاري التنفيذ…</span>
              </>
            ) : (
              confirmText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
