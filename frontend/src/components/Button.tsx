import type React from "react";

interface ButtonProps {
  tailwindColors?: string; // Contains the button color, hover color, and text color.
  type?: "button" | "submit";
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({
  tailwindColors,
  children,
  type,
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick ?? (() => {})}
      disabled={disabled}
      className={`px-4 py-2 rounded ${tailwindColors || "bg-blue-600 hover:bg-blue-700 text-white"}`}
    >
      {children}
    </button>
  );
}
