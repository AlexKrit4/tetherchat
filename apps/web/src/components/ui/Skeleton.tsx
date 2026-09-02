import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse-soft rounded bg-surface-secondary', className)}
      style={style}
    />
  );
}

/** Placeholder rows that mimic the shape of grouped messages while history loads. */
export function MessageSkeletonList({ count = 8 }: { count?: number }) {
  if (isGraphite()) {
    return (
      <div className="flex flex-col gap-2 px-3 py-4 md:px-4">
        {Array.from({ length: count }).map((_, index) => {
          const mine = index % 3 === 0;
          return (
            <div key={index} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <Skeleton
                className="h-10 rounded-bubble"
                style={{ width: `${42 + ((index * 29) % 38)}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5" style={{ width: `${90 + ((index * 37) % 60)}px` }} />
            <Skeleton className="h-3.5" style={{ width: `${45 + ((index * 53) % 50)}%` }} />
            {index % 3 === 0 ? (
              <Skeleton className="h-3.5" style={{ width: `${30 + ((index * 29) % 40)}%` }} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-2 py-3">
      <Skeleton className="mb-1 h-3 w-20" />
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-8 rounded"
          style={{ width: `${60 + ((index * 41) % 35)}%` }}
        />
      ))}
    </div>
  );
}
