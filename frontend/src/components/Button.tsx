import type React from "react";

interface ButtonProps {
  /** Visual style of the button (single color per variant). */
  variant?: "primary" | "secondary" | "destructive";
  type?: "button" | "submit";
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({
  variant,
  children,
  type,
  disabled,
  onClick,
}: ButtonProps) {
  let classes = "btn btn-primary";
  if (variant === "secondary") {
    classes = "btn btn-secondary";
  } else if (variant === "destructive") {
    classes = "btn btn-destructive";
  }
  return (
    <button
      type={type ?? "button"}
      onClick={onClick ?? (() => {})}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
