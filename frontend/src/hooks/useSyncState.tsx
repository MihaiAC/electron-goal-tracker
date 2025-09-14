import { useReducer } from "react";
import { useMinDurationDispatch } from "./useMinDurationDispatch";

/**
 * State machine for sync/restore operations
 */
type SettingsState =
  // Idle states - normal app operation
  | { type: "SIGNED_OUT" }
  | { type: "SIGNED_IN" }

  // Operation in progress
  | { type: "SYNCING"; operation: "sync" | "restore" }

  // Operation results
  | { type: "SUCCESS"; operation: "sync" | "restore"; message: string }
  | { type: "ERROR"; message: string; code?: string; status?: number }

  // User interaction required states
  | { type: "CONFIRM_RESTORE" }
  | { type: "PASSWORD_SYNC" }
  | { type: "PASSWORD_RESTORE" }
  | { type: "SAVE_PASSWORD"; password: string };

type SettingsAction =
  // Auth
  | { type: "SIGN_IN_SUCCESS" }
  | { type: "SIGN_OUT" }

  // Operation triggers
  | { type: "START_SYNC" }
  | { type: "START_RESTORE" }
  | { type: "CONFIRM_RESTORE" }
  | { type: "NEED_PASSWORD"; purpose: "sync" | "restore" }
  | { type: "PASSWORD_PROVIDED"; password: string; purpose: "sync" | "restore" }
  | {
      type: "OPERATION_SUCCESS";
      operation: "sync" | "restore";
      message: string;
    }
  | {
      type: "OPERATION_FAILED";
      message: string;
      code?: string;
      status?: number;
    }

  // Password saving
  | { type: "OFFER_SAVE_PASSWORD"; password: string }
  | { type: "SAVE_PASSWORD_CONFIRMED" }
  | { type: "SAVE_PASSWORD_CANCELLED" }

  // Dialog actions
  | { type: "BACK_TO_IDLE" }; // Goes back to signed in/out idle

function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    // Auth transitions
    case "SIGN_IN_SUCCESS":
      return { type: "SIGNED_IN" };

    case "SIGN_OUT":
      return { type: "SIGNED_OUT" };

    // Start operations
    case "START_SYNC":
      return { type: "SYNCING", operation: "sync" };

    case "START_RESTORE":
      return { type: "CONFIRM_RESTORE" };

    case "CONFIRM_RESTORE":
      return { type: "SYNCING", operation: "restore" };

    // Password flows
    case "NEED_PASSWORD":
      return action.purpose === "sync"
        ? { type: "PASSWORD_SYNC" }
        : { type: "PASSWORD_RESTORE" };

    case "PASSWORD_PROVIDED":
      return { type: "SYNCING", operation: action.purpose };

    // Operation results
    case "OPERATION_SUCCESS":
      return {
        type: "SUCCESS",
        operation: action.operation,
        message: action.message,
      };

    case "OPERATION_FAILED":
      return {
        type: "ERROR",
        message: action.message,
        code: action.code,
        status: action.status,
      };

    // Password saving
    case "OFFER_SAVE_PASSWORD":
      return { type: "SAVE_PASSWORD", password: action.password };

    case "SAVE_PASSWORD_CONFIRMED":
    case "SAVE_PASSWORD_CANCELLED":
      return { type: "SIGNED_IN" };

    // Return to idle state
    case "BACK_TO_IDLE":
      if (state.type === "SIGNED_OUT") return state;
      return { type: "SIGNED_IN" };

    default:
      return state;
  }
}

// Minimum duration to show loading state for better UX
const MIN_SYNCING_MS = 700;

function useSyncStateMachine(isAuthenticated: boolean) {
  const initialState: SettingsState = isAuthenticated
    ? { type: "SIGNED_IN" }
    : { type: "SIGNED_OUT" };

  const [state, baseDispatch] = useReducer(settingsReducer, initialState);

  // Wrap our baseDispatch so loader shows for at least 700ms.
  const dispatch = useMinDurationDispatch(baseDispatch, MIN_SYNCING_MS);

  const isBusy =
    state.type === "SYNCING" ||
    state.type === "PASSWORD_SYNC" ||
    state.type === "PASSWORD_RESTORE" ||
    state.type === "SAVE_PASSWORD";

  const canClose = !isBusy;

  return {
    state,
    dispatch,
    isBusy,
    canClose,
  };
}

export {
  useSyncStateMachine as useSettingsState,
  type SettingsState,
  type SettingsAction,
};
