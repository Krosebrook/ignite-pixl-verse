/**
 * Unified LoadingState component to replace duplicated loading patterns
 * Provides consistent loading experiences across all pages
 */

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from './card';

interface LoadingStateProps {
  variant?: 'page' | 'section' | 'inline' | 'card' | 'table';
  message?: string;
  className?: string;
  rows?: number;
}

export function LoadingState({ 
  variant = 'page', 
  message = 'Loading...', 
  className,
  rows = 5 
}: LoadingStateProps) {
  switch (variant) {
    case 'inline':
      return (
        <div 
          className={cn('flex items-center gap-2', className)}
          role="status"
          aria-label={message}
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      );

    case 'section':
      return (
        <div 
          className={cn('flex flex-col items-center justify-center py-12 gap-3', className)}
          role="status"
          aria-label={message}
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      );

    case 'card':
      return (
        <Card className={cn('animate-pulse', className)}>
          <CardHeader className="space-y-2">
            <div className="h-5 w-3/4 bg-muted rounded" />
            <div className="h-4 w-1/2 bg-muted rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
            <div className="flex gap-2 pt-4">
              <div className="h-8 w-20 bg-muted rounded" />
              <div className="h-8 w-20 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      );

    case 'table':
      return (
        <div className={cn('space-y-3', className)} role="status" aria-label={message}>
          <div className="flex gap-4 pb-2 border-b border-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-1/4 bg-muted rounded animate-pulse" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 w-1/4 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      );

    case 'page':
    default:
      return (
        <div 
          className={cn('flex flex-col items-center justify-center min-h-[400px] gap-4', className)}
          role="status"
          aria-label={message}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">{message}</p>
        </div>
      );
  }
}

/**
 * Grid of skeleton cards for list views
 */
export function LoadingCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingState key={i} variant="card" />
      ))}
    </div>
  );
}

/**
 * Metric tiles loading skeleton
 */
export function LoadingMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
              <div className="h-10 w-10 bg-muted rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
