import { useCallback, useEffect, useRef } from "react";
import type { SettingsAction } from "../state/settingsStateMachine";

type DispatchFn = (action: SettingsAction) => void;

export function useMinDurationDispatch(
  baseDispatch: DispatchFn,
  minMs: number
) {
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const dispatch = useCallback<DispatchFn>(
    (action) => {
      // Mark start of a syncing/restore operation
      if (action.type === "START_SYNC" || action.type === "START_RESTORE") {
        startedAtRef.current = Date.now();
        clearTimer();
        baseDispatch(action);
        return;
      }

      // Defer revealing result to ensure min visible time
      if (
        action.type === "OPERATION_SUCCESS" ||
        action.type === "OPERATION_FAILED"
      ) {
        const started = startedAtRef.current;
        if (started != null) {
          const elapsed = Date.now() - started;
          const remaining = Math.max(0, minMs - elapsed);
          if (remaining > 0) {
            clearTimer();
            timerRef.current = window.setTimeout(() => {
              baseDispatch(action);
              startedAtRef.current = null;
              timerRef.current = null;
            }, remaining);
            return;
          }
          startedAtRef.current = null;
        }
        baseDispatch(action);
        return;
      }

      baseDispatch(action);
    },
    [baseDispatch, minMs]
  );

  return dispatch;
}
