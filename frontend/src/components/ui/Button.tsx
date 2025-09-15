import type React from "react";

/**
 * Reusable button component with theme-aware variants.
 * - primary, secondary, destructive: standard sized text buttons
 * - close: small circular icon-only button with red hover, no base border
 */
interface ButtonProps {
  /** Visual style of the button (single color per variant). */
  variant?: "primary" | "secondary" | "destructive" | "close";
  type?: "button" | "submit";
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  /** Optional extra classes (e.g., positioning like absolute). */
  className?: string;
}

export function Button({
  variant,
  children,
  type,
  disabled,
  onClick,
  className,
}: ButtonProps) {
  let classes = "btn btn-primary";
  if (variant === "secondary") {
    classes = "btn btn-secondary";
  } else if (variant === "destructive") {
    classes = "btn btn-destructive";
  } else if (variant === "close") {
    classes = "btn-close";
  }
  if (className) {
    classes = `${classes} ${className}`;
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
