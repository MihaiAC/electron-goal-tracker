import { useReducer } from "react";

// One state for each screen/modal the user sees
type SettingsState =
  | { type: "SIGNED_OUT" }
  | { type: "SIGNED_IN" }
  | { type: "SYNCING"; operation: "sync" | "restore" }
  | { type: "SUCCESS"; operation: "sync" | "restore"; message: string }
  | { type: "ERROR"; message: string; code?: string }
  | { type: "CONFIRM_RESTORE" }
  | { type: "PASSWORD_SYNC" }
  | { type: "PASSWORD_RESTORE" }
  | { type: "SAVE_PASSWORD"; password: string };

type SettingsAction =
  // Auth
  | { type: "SIGN_IN_SUCCESS" }
  | { type: "SIGN_OUT" }

  // Operations
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
  | { type: "OPERATION_FAILED"; message: string; code?: string }

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
      };

    // Password saving
    case "OFFER_SAVE_PASSWORD":
      return { type: "SAVE_PASSWORD", password: action.password };

    case "SAVE_PASSWORD_CONFIRMED":
    case "SAVE_PASSWORD_CANCELLED":
      return { type: "SIGNED_IN" };

    // Go back to idle
    case "BACK_TO_IDLE":
      // Goes back to appropriate idle state
      if (state.type === "SIGNED_OUT") return state;
      return { type: "SIGNED_IN" };

    default:
      return state;
  }
}

// Simple helpers
const isBusy = (state: SettingsState) => state.type === "SYNCING";
const canClose = (state: SettingsState) => !isBusy(state);

// Custom hook
function useSettingsState(isAuthenticated: boolean) {
  const initialState: SettingsState = isAuthenticated
    ? { type: "SIGNED_IN" }
    : { type: "SIGNED_OUT" };

  const [state, dispatch] = useReducer(settingsReducer, initialState);

  return {
    state,
    dispatch,
    isBusy: isBusy(state),
    canClose: canClose(state),
  };
}

export { useSettingsState, type SettingsState, type SettingsAction };
