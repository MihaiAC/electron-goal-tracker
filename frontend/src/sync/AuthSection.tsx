import type { OAuthUser } from "../../../types/shared";
import { Button } from "../ui/Button";
import { Loader2, CheckCircle } from "lucide-react";

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
          <div className="flex items-center space-x-2 text-muted">
            <Loader2 className="loader-icon" />
            <span>Waiting for Dropbox sign-in...</span>
          </div>
          <Button onClick={onCancelSignIn} variant="secondary" className="w-24">
            Cancel
          </Button>
        </div>
      ) : isAuthenticated ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#22c55e]" />
            <p className="font-medium">
              Signed in{user?.email ? ` as ${user.email}` : ""}
            </p>
          </div>
          <Button
            onClick={onSignOut}
            disabled={isSyncing}
            variant="destructive"
            className="w-24"
          >
            Sign out
          </Button>
        </div>
      ) : (
        <Button
          onClick={onSignIn}
          disabled={isSyncing}
          variant="primary"
          className="w-48"
        >
          Sign in with Dropbox
        </Button>
      )}
    </section>
  );
}
