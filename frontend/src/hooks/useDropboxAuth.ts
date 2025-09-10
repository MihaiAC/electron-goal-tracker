import { useState, useEffect, useCallback, useRef } from "react";
import type { OAuthUser } from "../../../types/shared";

export function useDropboxAuth() {
  const [user, setUser] = useState<OAuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signInCanceledByUser = useRef(false);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    signInCanceledByUser.current = false;

    try {
      console.info("[auth][renderer] Checking authentication status...");
      const status = await window.api.getAuthStatus();
      setIsAuthenticated(Boolean(status?.isAuthenticated));
      setUser(status?.user ?? null);
      console.info("[auth][renderer] Auth status updated", {
        isAuthenticated: Boolean(status?.isAuthenticated),
        hasUser: Boolean(status?.user),
      });
    } catch (e) {
      console.error(
        "[auth][renderer] Failed to check authentication status",
        e
      );
      setError("Failed to check authentication status");
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const signIn = async () => {
    setIsLoading(true);
    setError(null);
    signInCanceledByUser.current = false;

    try {
      console.info("[auth][renderer] Starting Dropbox sign-in");
      await window.api.startDropboxAuth();
      if (!signInCanceledByUser.current) {
        await refreshStatus();
        console.info("[auth][renderer] Sign-in completed");
      } else {
        console.info("[auth][renderer] Sign-in was canceled by user");
      }
    } catch (e) {
      if (!signInCanceledByUser.current) {
        setError("Failed to sign in.");
        console.error("[auth][renderer] Sign-in failed", e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSignIn = async () => {
    signInCanceledByUser.current = true;
    try {
      console.info("[auth][renderer] Cancelling Dropbox sign-in");
      await window.api.cancelDropboxAuth();
    } catch (e) {
      console.error("[auth][renderer] Failed to cancel sign-in", e);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.info("[auth][renderer] Signing out");
      await window.api.authSignOut();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      console.info("[auth][renderer] Signed out (local state cleared)");
    }
  };

  const clearError = () => setError(null);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    signIn,
    cancelSignIn,
    signOut,
    clearError,
  };
}
