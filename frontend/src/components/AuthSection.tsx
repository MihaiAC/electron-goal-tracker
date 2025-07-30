import type { GoogleUser } from "../hooks/useGoogleAuth";
import { SpinnerIcon } from "./Icons";
import { Button } from "./Button";

interface AuthenticationSectionProps {
  isSyncing: boolean;
  authIsLoading: boolean;
  isAuthenticated: boolean;
  user: GoogleUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function AuthenticationSection({
  isSyncing,
  authIsLoading,
  isAuthenticated,
  user,
  onSignIn,
  onSignOut,
}: AuthenticationSectionProps) {
  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Account</h3>
      {authIsLoading ? (
        <div className="flex items-center space-x-2 text-gray-400">
          <SpinnerIcon />
          <span>Checking authentication status...</span>
        </div>
      ) : isAuthenticated ? (
        <div className="flex items-center justify-between">
          <p>Signed in as {user?.email}</p>
          <Button
            onClick={onSignOut}
            disabled={isSyncing}
            tailwindColors="bg-gray-600 hover:bg-gray-700"
          >
            Sign Out
          </Button>
        </div>
      ) : (
        <Button onClick={onSignIn} disabled={isSyncing}>
          Sign in with Google
        </Button>
      )}
    </section>
  );
}
