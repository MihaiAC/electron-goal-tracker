import type { OAuthUser } from "../../../../types/shared";
import { Button } from "../Button";
import { Loader2 } from "lucide-react";

interface AuthenticationSectionProps {
  isSyncing: boolean;
  authIsLoading: boolean;
  isAuthenticated: boolean;
  user: OAuthUser | null;
  onSignIn: () => void;
  onCancelSignIn: () => void;
  onSignOut: () => void;
}

export default function AuthenticationSection({
  isSyncing,
  authIsLoading,
  isAuthenticated,
  user,
  onSignIn,
  onCancelSignIn,
  onSignOut,
}: AuthenticationSectionProps) {
  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Account</h3>
      {authIsLoading ? (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 text-gray-400">
            <Loader2 className="h-8 w-8 text-white animate-spin stroke-3" />
            <span>Waiting for Google sign-in...</span>
          </div>
          <Button
            onClick={onCancelSignIn}
            tailwindColors="bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </Button>
        </div>
      ) : isAuthenticated ? (
        <div className="flex items-center justify-between">
          <p>Signed in{user?.email ? ` as ${user.email}` : ""}</p>
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
