import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_TITLE_MAX_LENGTH = 15;

function truncateToastTitle(title: string): string {
  const trimmed = title.trim() || 'To-do';
  if (trimmed.length <= TOAST_TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TOAST_TITLE_MAX_LENGTH)}…`;
}

type UndoToastState = {
  title: string;
  onUndo: () => void;
};

export function useTodoUndoToast() {
  const [toast, setToast] = useState<UndoToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissUndo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  useEffect(() => () => dismissUndo(), [dismissUndo]);

  const showCompleteUndo = useCallback(
    (title: string, undo: () => void | Promise<void>) => {
      dismissUndo();
      setToast({
        title: truncateToastTitle(title),
        onUndo: () => {
          dismissUndo();
          void undo();
        },
      });
      timerRef.current = setTimeout(dismissUndo, 5000);
    },
    [dismissUndo]
  );

  return { toast, showCompleteUndo, dismissUndo };
}
