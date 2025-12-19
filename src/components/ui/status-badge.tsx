/**
 * Reusable Status Badge component
 * Displays status with consistent styling across the app
 */

import { cn } from '@/lib/utils';
import { STATUS_STYLES, StatusType } from '@/lib/constants';
import { Badge } from './badge';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  Pause, 
  AlertCircle,
  Calendar,
  Edit
} from 'lucide-react';

interface StatusBadgeProps {
  status: StatusType | string;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const statusIcons: Record<string, typeof CheckCircle> = {
  pending: Clock,
  active: CheckCircle,
  scheduled: Calendar,
  completed: CheckCircle,
  failed: XCircle,
  draft: Edit,
  paused: Pause,
  error: AlertCircle,
};

export function StatusBadge({ 
  status, 
  showIcon = true, 
  className,
  size = 'md'
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as StatusType;
  const styles = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.draft;
  const Icon = statusIcons[normalizedStatus] || Clock;

  return (
    <Badge
      variant="outline"
      className={cn(
        styles,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        'border font-medium capitalize',
        className
      )}
    >
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />}
      {status}
    </Badge>
  );
}

/**
 * Progress indicator for goal tracking
 */
interface ProgressIndicatorProps {
  current: number;
  target: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function ProgressIndicator({
  current,
  target,
  label,
  showPercentage = true,
  className,
  variant = 'default',
}: ProgressIndicatorProps) {
  const percentage = Math.min(Math.round((current / target) * 100), 100);
  
  const getVariant = () => {
    if (variant !== 'default') return variant;
    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'warning';
    return 'default';
  };

  const variantStyles = {
    default: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
  };

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className="font-medium">
              {percentage}% ({current.toLocaleString()} / {target.toLocaleString()})
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-500 rounded-full',
            variantStyles[getVariant()]
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={label || `Progress: ${percentage}%`}
        />
      </div>
    </div>
  );
}
