const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

interface AdminTableRowSkeletonProps {
  cols?: number;
}

export function AdminTableRowSkeleton({ cols = 5 }: AdminTableRowSkeletonProps) {
  return (
    <tr aria-busy="true" aria-label="Loading row" className="border-b border-border last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className={`h-4 ${S}`}
            style={{ width: i === 0 ? '80%' : i === cols - 1 ? '60%' : '70%' }}
          />
        </td>
      ))}
    </tr>
  );
}
