import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?:       string;
  alt?:       string;
  name?:      string;
  size?:      AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, { box: string; text: string }> = {
  xs: { box: 'w-6  h-6',  text: 'text-[10px]' },
  sm: { box: 'w-8  h-8',  text: 'text-xs'     },
  md: { box: 'w-10 h-10', text: 'text-sm'     },
  lg: { box: 'w-12 h-12', text: 'text-base'   },
  xl: { box: 'w-16 h-16', text: 'text-lg'     },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size      = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = React.useState(false);
  const { box, text } = SIZE_CLASSES[size];
  const showImg = Boolean(src && !imgError);
  const initials = name ? getInitials(name) : '?';

  return (
    <div
      className={[
        'rounded-full overflow-hidden shrink-0 inline-flex items-center justify-center select-none',
        box,
        text,
        showImg ? '' : 'bg-primary text-white font-semibold',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={alt ?? name}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt ?? name ?? ''}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
