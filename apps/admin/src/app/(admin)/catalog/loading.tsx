function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer ${className ?? ''}`} />
  );
}


function TreeNodeSkeleton({ indent = 0 }: { indent?: number }) {
  return (
    <div className="flex items-center gap-2 py-2" style={{ paddingLeft: `${12 + indent * 16}px` }}>
      <Shimmer className="w-3 h-3 rounded-sm shrink-0" />
      <Shimmer className={`h-3.5 ${indent === 0 ? 'w-28' : indent === 1 ? 'w-24' : 'w-20'}`} />
      <Shimmer className="w-6 h-4 rounded-pill ml-auto mr-3" />
    </div>
  );
}

export default function CatalogLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Shimmer className="h-7 w-40" />
          <Shimmer className="h-4 w-52" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-36 rounded-button" />
          <Shimmer className="h-9 w-32 rounded-button" />
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex gap-5 h-[calc(100vh-200px)]">
        {/* Left: tree */}
        <div className="w-[300px] shrink-0 bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Shimmer className="h-4 w-32" />
          </div>
          <div className="p-2 space-y-0.5">
            {[0, 1, 1, 2, 2, 0, 1, 1, 2, 0, 1].map((indent, i) => (
              <TreeNodeSkeleton key={i} indent={indent} />
            ))}
          </div>
        </div>

        {/* Center: form */}
        <div className="flex-1 bg-surface rounded-card border border-border shadow-card p-4 sm:p-6 space-y-4">
          <Shimmer className="h-5 w-48" />
          <div className="space-y-3">
            {[1, 0.7, 1, 0.5, 0.8].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <Shimmer className="h-3.5 w-20" />
                <Shimmer className={`h-9 w-full rounded-button`} style={{ maxWidth: `${w * 100}%` } as React.CSSProperties} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: stats */}
        <div className="w-[240px] shrink-0 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-card border border-border p-4 space-y-2">
              <Shimmer className="h-3.5 w-24" />
              <Shimmer className="h-7 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
