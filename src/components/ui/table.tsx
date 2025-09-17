"use client"

import * as React from "react"

import { cn } from "@/lib/utils/cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:relative [&_tr]:after:absolute [&_tr]:after:bottom-0 [&_tr]:after:left-0 [&_tr]:after:right-0 [&_tr]:after:h-px [&_tr]:after:bg-gradient-to-r [&_tr]:after:from-transparent [&_tr]:after:via-[hsl(var(--border-default)_/_0.6)] [&_tr]:after:to-transparent [&_tr]:after:content-['']",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "relative bg-[hsl(var(--muted)_/_0.5)] font-medium",
        "before:absolute before:top-0 before:left-0 before:right-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-[hsl(var(--border-default)_/_0.6)] before:to-transparent before:content-['']",
        "[&>tr]:last:after:hidden",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "relative hover:bg-[hsl(var(--accent)_/_0.5)] data-[state=selected]:bg-[hsl(var(--accent))] transition-all duration-200",
        "after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px",
        "after:bg-gradient-to-r after:from-transparent after:via-[hsl(var(--border-default)_/_0.3)] after:to-transparent after:content-['']",
        "hover:after:via-[hsl(var(--border-default)_/_0.5)]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
