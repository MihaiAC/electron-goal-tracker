import { Button } from "../ui/Button";

interface SyncSectionProps {
  isSyncing: boolean;
  lastSynced: string | null;
  onSync: () => void;
  onRestore: () => void;
}

export default function SyncSection({
  isSyncing,
  lastSynced,
  onSync,
  onRestore,
}: SyncSectionProps) {
  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Sync Settings</h3>
      <div className="space-y-4">
        <div className="flex justify-between space-x-4 items-center">
          <Button onClick={onSync} disabled={isSyncing} variant="primary">
            Sync to Dropbox
          </Button>
          <Button
            onClick={onRestore}
            disabled={isSyncing}
            variant="destructive"
          >
            Restore from Dropbox
          </Button>
        </div>

        <p className="text-sm text-muted">
          Last synced:{" "}
          {lastSynced ? new Date(lastSynced).toLocaleString() : "Never"}
        </p>
      </div>
    </section>
  );
}
