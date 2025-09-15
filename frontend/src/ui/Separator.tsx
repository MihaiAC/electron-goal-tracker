import React from "react";

interface SeparatorProps {
  /**
   * Additional CSS classes to apply to the separator
   */
  className?: string;
}

/**
 * A simple horizontal separator/divider component
 *
 * @example
 * // Basic usage
 * <Separator className="my-4" />
 *
 * @example
 * // Full-width separator that extends beyond container padding
 * <Separator className="-mx-6 mb-4" />
 */
export function Separator({ className = "" }: SeparatorProps) {
  return <div className={`h-px bg-neutral ${className}`} role="separator" />;
}
