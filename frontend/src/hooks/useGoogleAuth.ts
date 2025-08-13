import { useState, useEffect } from "react";

// Mock Google User - should get it from the API.
export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export function useGoogleAuth() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On initial load, check for stored refresh token.
  useEffect(() => {
    const checkStoredAuth = async () => {
      setIsLoading(true);
      try {
        // const tokens = await window.api.getRefreshToken();
        // if (tokens) { /* get user info */ }

        // Mock implementation:
        // Simulate checking storage and finding nothing.
        await new Promise((resolve) => setTimeout(resolve, 500));

        // To test the "already logged in" state, you could uncomment the next line:
        // setUser({ email: 'test.user@gmail.com', name: 'Test User' });
      } catch (e) {
        setError("Failed to check authentication status.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    checkStoredAuth();
  }, []);

  const signIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Real implementation: await window.api.startGoogleAuth();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      setUser({ email: "test.user@gmail.com", name: "Test User" });
    } catch (e) {
      setError("Failed to sign in.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // Real implementation: await window.api.clearTokens();
    setUser(null);
  };

  const clearError = () => setError(null);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    signIn,
    signOut,
    clearError,
  };
}
