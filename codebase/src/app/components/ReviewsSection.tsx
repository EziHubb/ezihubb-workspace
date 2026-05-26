import { useState } from "react";
import { ThumbsUp } from "lucide-react";

interface Review {
  id: number;
  author: string;
  verified: boolean;
  date: string;
  rating: number;
  title: string;
  text: string;
  photo?: string;
  helpful: number;
}

const sampleReviews: Review[] = [
  {
    id: 1,
    author: "Sarah J.",
    verified: true,
    date: "2 days ago",
    rating: 5,
    title: "Absolutely love it! 😍",
    text: "The quality is amazing and the customization turned out perfect! I ordered this for my mom's birthday and she cried happy tears. The watercolor style is so beautiful and the names are printed clearly. Shipping was fast too!",
    photo:
      "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200",
    helpful: 12,
  },
  {
    id: 2,
    author: "Michael C.",
    verified: true,
    date: "1 week ago",
    rating: 5,
    title: "Perfect anniversary gift!",
    text: "My wife loved this mug! The photo upload feature worked great and the AI background removal saved me so much time. The preview was exactly how it came out. Highly recommend!",
    helpful: 8,
  },
  {
    id: 3,
    author: "Emily R.",
    verified: true,
    date: "2 weeks ago",
    rating: 4,
    title: "Great quality, minor color difference",
    text: "Overall very happy with the mug. The only thing is the coral color looked slightly different in person than on screen, but still beautiful. The personalization is perfect and it's dishwasher safe!",
    helpful: 5,
  },
];

interface ReviewsSectionProps {
  averageRating: number;
  totalReviews: number;
}

export function ReviewsSection({
  averageRating = 4.9,
  totalReviews = 312,
}: ReviewsSectionProps) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [showPhotosOnly, setShowPhotosOnly] = useState(false);

  const ratingDistribution = [
    { stars: 5, percentage: 78, count: 243 },
    { stars: 4, percentage: 15, count: 47 },
    { stars: 3, percentage: 5, count: 16 },
    { stars: 2, percentage: 1, count: 3 },
    { stars: 1, percentage: 1, count: 3 },
  ];

  return (
    <section className="mt-12 md:mt-16" id="reviews">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <h3 className="font-['Playfair_Display'] font-semibold text-2xl md:text-3xl">
          Customer Reviews
        </h3>
        <button className="border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white font-semibold px-6 py-2 rounded-lg transition-all text-sm uppercase tracking-wide">
          Write a Review
        </button>
      </div>

      {/* Rating Summary */}
      <div className="grid md:grid-cols-[auto_1fr] gap-8 mb-8 p-6 bg-white rounded-xl border border-[var(--color-border)]">
        {/* Left: Average Rating */}
        <div className="text-center md:text-left md:border-r md:border-[var(--color-border)] md:pr-8">
          <div className="text-6xl font-bold text-[var(--color-primary)] mb-2">
            {averageRating}
          </div>
          <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`text-2xl ${
                  i < Math.floor(averageRating)
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-border)]"
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Based on {totalReviews} reviews
          </p>
        </div>

        {/* Right: Distribution Bars */}
        <div className="space-y-2">
          {ratingDistribution.map((dist) => (
            <div key={dist.stars} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-12">
                <span className="text-sm font-medium">{dist.stars}</span>
                <span className="text-[var(--color-warning)] text-sm">★</span>
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[var(--color-warning)] h-full transition-all"
                  style={{ width: `${dist.percentage}%` }}
                />
              </div>
              <span className="text-sm text-[var(--color-text-muted)] w-12 text-right">
                {dist.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        >
          <option value="all">All Stars</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        >
          <option value="recent">Most Recent</option>
          <option value="helpful">Most Helpful</option>
          <option value="highest">Highest Rating</option>
          <option value="lowest">Lowest Rating</option>
        </select>

        <label className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors">
          <input
            type="checkbox"
            checked={showPhotosOnly}
            onChange={(e) => setShowPhotosOnly(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          <span>With Photos</span>
        </label>
      </div>

      {/* Review Cards */}
      <div className="space-y-6">
        {sampleReviews.map((review) => (
          <div
            key={review.id}
            className="border-b border-[var(--color-border)] pb-6 last:border-b-0"
          >
            {/* Review Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {review.author[0]}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {review.author}
                    </span>
                    {review.verified && (
                      <span className="text-xs text-[var(--color-success)] flex items-center gap-1">
                        <span>✓</span> Verified Purchase
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {review.date}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating & Title */}
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-sm ${
                      i < review.rating
                        ? "text-[var(--color-warning)]"
                        : "text-[var(--color-border)]"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <h4 className="font-semibold">{review.title}</h4>
            </div>

            {/* Review Text */}
            <p className="text-sm text-[var(--color-text-primary)] mb-3 leading-relaxed">
              {review.text}
            </p>

            {/* Review Photo */}
            {review.photo && (
              <div className="mb-3">
                <img
                  src={review.photo}
                  alt="Customer photo"
                  className="w-20 h-20 rounded-lg object-cover border border-[var(--color-border)]"
                />
              </div>
            )}

            {/* Helpful Button */}
            <button className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
              <ThumbsUp className="w-4 h-4" />
              <span>Helpful? ({review.helpful})</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
