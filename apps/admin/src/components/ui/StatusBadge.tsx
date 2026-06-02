const STATUS_CONFIG = {
  Active:   { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  Draft:    { bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
  Expired:  { bg: 'bg-red-100',   text: 'text-red-600',   dot: 'bg-red-500'   },
  Archived: { bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-300'  },
} as const;

interface Props {
  status: keyof typeof STATUS_CONFIG;
}

export function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.Draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
