import React, { useState, useEffect } from "react";

interface BarSettingsProps {
  bar: {
    id: string;
    title: string;
    current: number;
    max: number;
    unit: string;
    incrementDelta: number;
    completedColor: string;
    remainingColor: string;
  };
  onSave: (updates: {
    title: string;
    current: number;
    max: number;
    unit: string;
    incrementDelta: number;
    completedColor: string;
    remainingColor: string;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function BarSettings({
  bar,
  onSave,
  onDelete,
  onClose,
}: BarSettingsProps) {
  const [formData, setFormData] = useState(bar);

  // Update form data when the bar prop changes
  useEffect(() => {
    setFormData(bar);
  }, [bar]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
        <h2 className="text-xl font-bold mb-4">Edit Progress Bar</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full p-2 rounded bg-gray-700"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Current Value
              </label>
              <input
                type="number"
                value={formData.current}
                onChange={(e) =>
                  setFormData({ ...formData, current: Number(e.target.value) })
                }
                className="w-full p-2 rounded bg-gray-700"
                min="0"
                step="0.1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Value
              </label>
              <input
                type="number"
                value={formData.max}
                onChange={(e) =>
                  setFormData({ ...formData, max: Number(e.target.value) })
                }
                className="w-full p-2 rounded bg-gray-700"
                min="1"
                step="1"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              className="w-full p-2 rounded bg-gray-700"
              placeholder="e.g., days, lbs, %"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Increment Step
            </label>
            <input
              type="number"
              value={formData.incrementDelta}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  incrementDelta: Number(e.target.value),
                })
              }
              className="w-full p-2 rounded bg-gray-700"
              min="0.1"
              step="0.1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Completed Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.completedColor}
                  onChange={(e) =>
                    setFormData({ ...formData, completedColor: e.target.value })
                  }
                  className="flex-1 h-10"
                />
                <span className="text-xs opacity-75">
                  {formData.completedColor}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Remaining Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.remainingColor}
                  onChange={(e) =>
                    setFormData({ ...formData, remainingColor: e.target.value })
                  }
                  className="flex-1 h-10"
                />
                <span className="text-xs opacity-75">
                  {formData.remainingColor}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
            >
              Delete Bar
            </button>
            <div className="space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
