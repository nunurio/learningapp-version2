"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

export function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex items-center gap-1", className)} {...props} />;
}

export function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("", className)} {...props} />;
}

type PaginationLinkProps = React.ComponentProps<"a"> &
  VariantProps<typeof buttonVariants> & {
    isActive?: boolean;
  };

export function PaginationLink({
  className,
  isActive,
  size = "icon",
  href = "#",
  onClick,
  ...props
}: PaginationLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onClick?.(e);
  }
  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      onClick={handleClick}
      {...props}
    />
  );
}

type PrevNextProps = Omit<React.ComponentProps<"a">, "children"> & {
  disabled?: boolean;
};

export function PaginationPrevious({ className, disabled, onClick, ...props }: PrevNextProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (disabled) return;
    onClick?.(e);
  }
  return (
    <PaginationLink
      aria-label="前へ"
      size="default"
      className={cn("px-2 w-auto", className)}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onClick={handleClick}
      {...props}
    >
      <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
      前へ
    </PaginationLink>
  );
}

export function PaginationNext({ className, disabled, onClick, ...props }: PrevNextProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (disabled) return;
    onClick?.(e);
  }
  return (
    <PaginationLink
      aria-label="次へ"
      size="default"
      className={cn("px-2 w-auto", className)}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onClick={handleClick}
      {...props}
    >
      次へ
      <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
    </PaginationLink>
  );
}

export function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>
      <MoreHorizontal className="h-4 w-4" aria-hidden />
      <span className="sr-only">省略</span>
    </span>
  );
}

