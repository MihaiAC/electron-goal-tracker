import React, { useState, useEffect } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { Button } from "./Button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// TODO: Do this yourself, I don''t understand why it casts them to strings first.

interface BarSettingsProps {
  bar: ProgressBarData;
  onSave: (updates: Partial<Omit<ProgressBarData, "id">>) => void;
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

  // Zod schema + RHF (numbers via valueAsNumber)
  const Schema = z
    .object({
      current: z.number().min(0, "Must be ≥ 0"),
      max: z.number().int("Must be an integer").min(1, "Must be ≥ 1"),
    })
    .refine((val) => val.current <= val.max, {
      message: "Must be ≤ Max.",
      path: ["current"],
    });

  type RHFValues = z.infer<typeof Schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<RHFValues>({
    mode: "onChange",
    resolver: zodResolver(Schema),
    defaultValues: { current: bar.current, max: bar.max },
  });

  useEffect(() => {
    reset({ current: bar.current, max: bar.max });
  }, [bar, reset]);

  const onSubmit = (vals: RHFValues) => {
    onSave({
      ...formData,
      current: vals.current,
      max: vals.max,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative"
        onClick={(e) => {
          if (e) {
            e.stopPropagation();
          } else {
            // no-op
          }
        }}
      >
        <h2 className="text-xl font-bold mb-4">Edit Progress Bar</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
        >
          ×
        </button>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                step="0.1"
                min="0"
                {...register("current", { valueAsNumber: true })}
                className={`w-full p-2 rounded bg-gray-700 ${errors.current ? "border-2 border-red-500" : ""}`}
                required
              />
              {(() => {
                if (errors.current) {
                  return (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.current.message as string}
                    </p>
                  );
                } else {
                  return null;
                }
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Value
              </label>
              <input
                type="number"
                min="1"
                step="1"
                {...register("max", { valueAsNumber: true })}
                className={`w-full p-2 rounded bg-gray-700 ${errors.max ? "border-2 border-red-500" : ""}`}
                required
              />
              {(() => {
                if (errors.max) {
                  return (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.max.message as string}
                    </p>
                  );
                } else {
                  return null;
                }
              })()}
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
            <Button
              onClick={onDelete}
              tailwindColors="bg-red-600 hover:bg-red-700"
            >
              Delete Bar
            </Button>

            <div className="space-x-4">
              <Button
                onClick={onClose}
                tailwindColors="bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !isValid || !formData.title.trim() || !formData.unit.trim()
                }
              >
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
