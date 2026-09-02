interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export default function LoadingSkeleton({ rows = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-ink-100" style={{ width: `${85 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-ink-100 bg-surface p-5">
      <div className="h-3 w-24 rounded bg-ink-100" />
      <div className="mt-3 h-6 w-32 rounded bg-ink-100" />
      <div className="mt-3 h-3 w-20 rounded bg-ink-100" />
    </div>
  );
}
