import React, { useEffect } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { Button } from "./Button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";

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
  const FormSchema = z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Title is required")
        .max(100, "Max 100 characters"),
      current: z.number().int("Must be an integer").min(0, "Must be ≥ 0"),
      max: z.number().int("Must be an integer").min(1, "Must be ≥ 1"),
      unit: z.string().min(1, "Unit is required").max(50, "Max 50 characters"),
      incrementDelta: z
        .number()
        .int("Must be an integer")
        .min(1, "Must be ≥ 1"),
      completedColor: z
        .string()
        .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Must be a hex color"),
      remainingColor: z
        .string()
        .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Must be a hex color"),
      incrementHoverGlowHex: z
        .string()
        .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Must be a hex color")
        .optional(),
      decrementHoverGlowHex: z
        .string()
        .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Must be a hex color")
        .optional(),
    })
    .refine(
      (formValues) => {
        if (formValues) {
          return formValues.current < formValues.max;
        } else {
          return true;
        }
      },
      {
        message: "Must be smaller than Max.",
        path: ["current"],
      }
    )
    .refine(
      (formValues) => {
        if (formValues) {
          return formValues.incrementDelta < formValues.max;
        } else {
          return true;
        }
      },
      {
        message: "Must be smaller than Max.",
        path: ["incrementDelta"],
      }
    );

  type BarFormValues = z.infer<typeof FormSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<BarFormValues>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: bar.title,
      current: bar.current,
      max: bar.max,
      unit: bar.unit,
      incrementDelta: bar.incrementDelta,
      completedColor: bar.completedColor,
      remainingColor: bar.remainingColor,
      incrementHoverGlowHex: bar.incrementHoverGlowHex ?? "#84cc16",
      decrementHoverGlowHex: bar.decrementHoverGlowHex ?? "#ea580c",
    },
  });

  // Sync the form if the selected bar changes
  useEffect(() => {
    reset({
      title: bar.title,
      current: bar.current,
      max: bar.max,
      unit: bar.unit,
      incrementDelta: bar.incrementDelta,
      completedColor: bar.completedColor,
      remainingColor: bar.remainingColor,
      incrementHoverGlowHex: bar.incrementHoverGlowHex ?? "#84cc16",
      decrementHoverGlowHex: bar.decrementHoverGlowHex ?? "#ea580c",
    });
  }, [bar, reset]);

  const onSubmit = (formValues: BarFormValues) => {
    onSave({
      title: formValues.title,
      current: formValues.current,
      max: formValues.max,
      unit: formValues.unit,
      incrementDelta: formValues.incrementDelta,
      completedColor: formValues.completedColor,
      remainingColor: formValues.remainingColor,
      incrementHoverGlowHex: formValues.incrementHoverGlowHex,
      decrementHoverGlowHex: formValues.decrementHoverGlowHex,
    });
  };

  const completedColorValue = watch("completedColor");
  const remainingColorValue = watch("remainingColor");
  const incrementHoverGlowHexValue = watch("incrementHoverGlowHex");
  const decrementHoverGlowHexValue = watch("decrementHoverGlowHex");

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative"
        onClick={(event) => {
          if (event) {
            event.stopPropagation();
          }
        }}
      >
        <h2 className="text-xl font-bold mb-4">Edit Progress Bar</h2>
        {/* TODO: This type of "button" gets repeated quite a lot -> new variant? */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="titlebar-button hover:bg-red-500 absolute top-3 right-3"
        >
          <X className="close-icon" />
        </button>

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1 break-words">
              Title
            </label>
            <input
              type="text"
              {...register("title")}
              className={`w-full p-2 rounded bg-gray-700 border-2 ${errors.title ? "border-red-500" : "border-transparent"} whitespace-normal break-words`}
              placeholder="Enter a title"
              inputMode="text"
            />
            <p
              className={`mt-1 text-xs min-h-4 ${errors.title ? "text-red-400" : "opacity-0"}`}
            >
              {errors.title?.message ?? "placeholder"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Current Value
              </label>
              <input
                type="number"
                step={1}
                min={0}
                {...register("current", { valueAsNumber: true })}
                className={`w-full p-2 rounded bg-gray-700 border-2 ${errors.current ? "border-red-500" : "border-transparent"}`}
                inputMode="numeric"
              />
              <p
                className={`mt-1 text-xs min-h-4 ${errors.current ? "text-red-400" : "opacity-0"}`}
              >
                {errors.current?.message ?? "placeholder"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Value
              </label>
              <input
                type="number"
                min={1}
                step={1}
                {...register("max", { valueAsNumber: true })}
                className={`w-full p-2 rounded bg-gray-700 border-2 ${errors.max ? "border-red-500" : "border-transparent"}`}
                inputMode="numeric"
              />
              <p
                className={`mt-1 text-xs min-h-4 ${errors.max ? "text-red-400" : "opacity-0"}`}
              >
                {errors.max?.message ?? "placeholder"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input
              type="text"
              {...register("unit")}
              className={`w-full p-2 rounded bg-gray-700 border-2 ${errors.unit ? "border-red-500" : "border-transparent"}`}
              placeholder="e.g., days, lbs, %"
              inputMode="text"
            />
            <p
              className={`mt-1 text-xs min-h-4 ${errors.unit ? "text-red-400" : "opacity-0"}`}
            >
              {errors.unit?.message ?? "placeholder"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Increment Step
            </label>
            <input
              type="number"
              min={1}
              step={1}
              {...register("incrementDelta", { valueAsNumber: true })}
              className={`w-full p-2 rounded bg-gray-700 border-2 ${errors.incrementDelta ? "border-red-500" : "border-transparent"}`}
              inputMode="numeric"
            />
            <p
              className={`mt-1 text-xs min-h-4 ${errors.incrementDelta ? "text-red-400" : "opacity-0"}`}
            >
              {errors.incrementDelta?.message ?? "placeholder"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Completed Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register("completedColor")}
                  className="flex-1 h-10"
                />
                <span className="text-xs opacity-75">
                  {completedColorValue}
                </span>
              </div>
              <p
                className={`mt-1 text-xs min-h-4 ${errors.completedColor ? "text-red-400" : "opacity-0"}`}
              >
                {errors.completedColor?.message ?? "placeholder"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Remaining Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register("remainingColor")}
                  className="flex-1 h-10"
                />
                <span className="text-xs opacity-75">
                  {remainingColorValue}
                </span>
              </div>
              <p
                className={`mt-1 text-xs min-h-4 ${errors.remainingColor ? "text-red-400" : "opacity-0"}`}
              >
                {errors.remainingColor?.message ?? "placeholder"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Increment Hover Glow
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register("incrementHoverGlowHex")}
                  className="flex-1 h-10"
                />
                <span className="text-xs opacity-75">
                  {incrementHoverGlowHexValue}
                </span>
              </div>
              <p
                className={`mt-1 text-xs min-h-4 ${errors.incrementHoverGlowHex ? "text-red-400" : "opacity-0"}`}
              >
                {errors.incrementHoverGlowHex?.message ?? "placeholder"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Decrement Hover Glow
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register("decrementHoverGlowHex")}
                  className="flex-1 h-10"
                />
                <span className="text-xs opacity-75">
                  {decrementHoverGlowHexValue}
                </span>
              </div>
              <p
                className={`mt-1 text-xs min-h-4 ${errors.decrementHoverGlowHex ? "text-red-400" : "opacity-0"}`}
              >
                {errors.decrementHoverGlowHex?.message ?? "placeholder"}
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button onClick={onDelete} variant="destructive">
              Delete Bar
            </Button>

            <div className="space-x-4">
              <Button onClick={onClose} type="button" variant="secondary">
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
