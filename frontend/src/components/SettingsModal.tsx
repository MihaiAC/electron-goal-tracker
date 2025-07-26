import { Button } from "./Button";
import { CloseIcon } from "./Icons";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SYNC_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 2 * 60 * 1000, label: "Every 2 minutes" },
  { value: 5 * 60 * 1000, label: "Every 5 minutes" },
  { value: 15 * 60 * 1000, label: "Every 15 minutes" },
  { value: 30 * 60 * 1000, label: "Every 30 minutes" },
  { value: 60 * 60 * 1000, label: "Every hour" },
] as const;

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) {
    return null;
  }

  const handleSync = () => {
    // TODO: Implement sync with Google Drive.
    console.log("Syncing...");
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="titlebar-button hover:bg-red-500 border-2 border-white hover:border-red-500"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3">Sync Settings</h3>

            <div className="space-y-4">
              <Button
                onClick={handleSync}
                tailwindColors="bg-blue-600 hover:bg-blue-700"
              >
                Sync with Google
              </Button>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Auto-sync frequency
                </label>
                <select className="w-full p-2 rounded bg-gray-700">
                  {SYNC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-gray-400">Last synced: Never</p>
            </div>
          </section>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              onClick={onClose}
              tailwindColors="bg-gray-700 hover:bg-gray-600"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
