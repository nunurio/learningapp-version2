"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: "default" | "gradient" | "striped" | "animated";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ 
    className, 
    value = 0, 
    max = 100, 
    variant = "default", 
    size = "md",
    showLabel = false,
    ...props 
  }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    
    const sizeStyles = {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    };
    
    const variantStyles = {
      default: "bg-[hsl(var(--primary))]",
      gradient: "bg-gradient-to-r from-[hsl(var(--primary-500))] to-[hsl(var(--secondary-500))]",
      striped: "bg-gradient-to-r from-[hsl(var(--primary-500))] to-[hsl(var(--primary-600))] bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]",
      animated: "bg-gradient-to-r from-[hsl(var(--primary-500))] to-[hsl(var(--secondary-500))] animate-pulse",
    };

    return (
      <div className={cn("relative", className)} ref={ref} {...props}>
        <div 
          className={cn(
            "w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden",
            sizeStyles[size]
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              variantStyles[variant]
            )}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
          />
        </div>
        {showLabel && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    );
  }
);

Progress.displayName = "Progress";

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  variant?: "default" | "gradient";
}

export const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ 
    className, 
    value = 0, 
    max = 100,
    size = 120,
    strokeWidth = 8,
    showLabel = true,
    variant = "default",
    ...props 
  }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    
    return (
      <div 
        className={cn("relative inline-flex items-center justify-center", className)} 
        ref={ref}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          <defs>
            <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary-500))" />
              <stop offset="100%" stopColor="hsl(var(--secondary-500))" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={variant === "gradient" ? "url(#progress-gradient)" : "hsl(var(--primary))"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-2xl font-bold text-gradient">
                {Math.round(percentage)}%
              </span>
              <p className="text-xs text-[hsl(var(--fg))]/60 mt-1">完了</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CircularProgress.displayName = "CircularProgress";