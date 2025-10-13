'use client';

import { cn } from '@/lib/utils';

export function ProductCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-sm',
        'animate-pulse',
        className
      )}
    >
      <div className="aspect-square bg-muted/50"></div>
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded-md bg-muted"></div>
        <div className="h-4 w-1/4 rounded-md bg-muted"></div>
        <div className="h-3 w-full rounded-md bg-muted"></div>
        <div className="h-3 w-5/6 rounded-md bg-muted"></div>
        <div className="flex gap-2 pt-2">
          <div className="h-9 flex-1 rounded-md bg-muted/70"></div>
          <div className="h-9 w-9 rounded-md bg-muted/70"></div>
        </div>
      </div>
    </div>
  );
}