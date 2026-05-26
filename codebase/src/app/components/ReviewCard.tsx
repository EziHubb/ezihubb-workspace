interface ReviewCardProps {
  rating: number;
  text: string;
  customerName: string;
  productName: string;
  avatarInitials?: string;
}

export function ReviewCard({
  rating,
  text,
  customerName,
  productName,
  avatarInitials,
}: ReviewCardProps) {
  const initials =
    avatarInitials || customerName.split(" ").map((n) => n[0]).join("");

  return (
    <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-floating)]">
      {/* Stars */}
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className={`text-lg ${
              i < rating
                ? "text-[var(--color-warning)]"
                : "text-[var(--color-border)]"
            }`}
          >
            ★
          </span>
        ))}
      </div>

      {/* Review Text */}
      <p className="text-[var(--color-text-primary)] mb-4 leading-relaxed italic">
        "{text}"
      </p>

      {/* Customer Info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm">
          {initials}
        </div>

        {/* Name & Product */}
        <div>
          <p className="font-semibold text-sm">{customerName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Purchased: {productName}
          </p>
        </div>
      </div>
    </div>
  );
}
