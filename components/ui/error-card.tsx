'use client';

import { Button } from './Button';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorCardProps {
  title: string;
  description: string;
  onRetry?: () => void;
  className?: string;
  retryText?: string;
  showIcon?: boolean;
}

export function ErrorCard({
  title,
  description,
  onRetry,
  className,
  retryText = 'Reintentar',
  showIcon = true,
}: ErrorCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-red-200 bg-red-50 p-6 text-center shadow-sm dark:border-red-900/50 dark:bg-red-900/20',
        className
      )}
    >
      <div className="flex flex-col items-center">
        {showIcon && (
          <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
        )}
        <h3 className="mt-3 text-lg font-medium text-red-800 dark:text-red-200">
          {title}
        </h3>
        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
          <p>{description}</p>
        </div>
        {onRetry && (
          <div className="mt-6">
            <Button
              variant="outline"
              onClick={onRetry}
              className="border-red-300 bg-white text-red-700 hover:bg-red-50 focus:ring-red-500 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              {retryText}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}