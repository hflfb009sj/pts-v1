'use client';

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

// Shared style tokens for button variants and sizes
const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:pointer-events-none disabled:opacity-50 active:scale-95";

const variants: Record<string, string> = {
  primary: "bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-orange-950/20",
  outline: "border-2 border-slate-800 bg-transparent text-white hover:bg-slate-800 hover:border-slate-700",
  secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
  ghost: "text-slate-400 hover:text-white hover:bg-slate-800/50",
  danger: "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-950/20",
};

const sizes: Record<string, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-8",
  lg: "h-14 px-10 text-base",
  icon: "h-10 w-10",
};

/**
 * PTrust Oracle - High-Performance Button Component
 * Standard: Industrial Design System (Shadcn-compatible)
 * Features: Variant Management, Loading States, and Ref Forwarding
 */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Processing...</span>
          </div>
        ) : (
          props.children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export interface ButtonVariantProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

export const buttonVariants = ({ variant = 'primary', size = 'md', className = '' }: ButtonVariantProps = {}) =>
  cn(baseStyles, variants[variant], sizes[size], className);

export { Button };
