import { useEffect } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm action as destructive (red). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirm dialog — on-brand replacement for window.confirm.
 *  role=dialog + aria-modal, Esc / overlay to cancel, focus moves to confirm. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-dark-textPri">
          {title}
        </h2>
        {message && <p className="mt-1.5 text-sm text-dark-textSec">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" className="min-h-[44px]" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            autoFocus
            size="sm"
            className={`min-h-[44px] ${destructive ? 'bg-dark-red hover:bg-red-500 focus:ring-dark-red' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
