import { useState, useEffect, useCallback, useRef } from "react";
import type { OAuthUser } from "../../../types/shared";

export function useGoogleAuth() {
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
      const status = await window.api.getAuthStatus();
      setIsAuthenticated(Boolean(status?.isAuthenticated));
      setUser(status?.user ?? null);
    } catch (e) {
      console.error(e);
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
      await window.api.startGoogleAuth();
      if (!signInCanceledByUser.current) {
        await refreshStatus();
      }
    } catch (e) {
      if (!signInCanceledByUser.current) {
        setError("Failed to sign in.");
        console.error(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSignIn = async () => {
    signInCanceledByUser.current = true;
    try {
      await window.api.cancelGoogleAuth();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await window.api.authSignOut();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
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
