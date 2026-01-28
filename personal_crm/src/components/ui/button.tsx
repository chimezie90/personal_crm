"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const variantClasses = {
  primary:
    "bg-terracotta text-white border-warmGray-900 shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:bg-terracotta-600",
  secondary:
    "bg-cream text-warmGray-900 border-warmGray-900 shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:bg-warmGray-100",
  ghost:
    "bg-transparent text-warmGray-900 border-transparent hover:bg-warmGray-100 active:bg-warmGray-200",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "font-display font-medium border-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-brutal disabled:hover:translate-x-0 disabled:hover:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
