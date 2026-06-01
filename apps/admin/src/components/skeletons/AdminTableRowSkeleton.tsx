function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer ${className ?? ''}`}
    />
  );
}

export function AdminTableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Shimmer className={`h-4 ${i === 0 ? 'w-8' : i === 1 ? 'w-32' : i % 2 === 0 ? 'w-24' : 'w-16'}`} />
        </td>
      ))}
    </tr>
  );
}
