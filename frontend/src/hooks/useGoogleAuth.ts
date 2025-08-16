import { useState, useEffect, useCallback } from "react";
import type { OAuthUser } from "../../../types/shared";

export function useGoogleAuth() {
  const [user, setUser] = useState<OAuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
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
    try {
      await window.api.startGoogleAuth();
      await refreshStatus();
    } catch (e) {
      setError("Failed to sign in.");
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
    signOut,
    clearError,
  };
}
