import { Button } from "./Button";

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
        <div className="flex space-x-2">
          <Button onClick={onSync} disabled={isSyncing}>
            Sync to Drive
          </Button>
          <Button
            onClick={onRestore}
            disabled={isSyncing}
            tailwindColors="bg-amber-600 hover:bg-amber-700"
          >
            Restore from Drive
          </Button>
        </div>

        <p className="text-sm text-gray-400">
          Last synced:{" "}
          {lastSynced ? new Date(lastSynced).toLocaleString() : "Never"}
        </p>
      </div>
    </section>
  );
}
