import { useState } from "react";
import { MobileCustomizerLayout } from "./MobileCustomizerLayout";
import { Eye, RefreshCw, ShoppingBag } from "lucide-react";

type ArtStyle = "watercolor" | "cartoon" | "realistic" | "vangogh";
type PreviewState = "none" | "generating" | "generated";

export function MobileCustomizerStep3() {
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>("watercolor");
  const [previewState, setPreviewState] = useState<PreviewState>("none");

  const styles = [
    {
      id: "watercolor" as const,
      name: "Watercolor",
      image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=200",
    },
    {
      id: "cartoon" as const,
      name: "Cartoon",
      image: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=200",
    },
    {
      id: "realistic" as const,
      name: "Realistic",
      image: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=200",
    },
    {
      id: "vangogh" as const,
      name: "Van Gogh",
      image: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=200",
    },
  ];

  const handleGeneratePreview = () => {
    setPreviewState("generating");
    setTimeout(() => {
      setPreviewState("generated");
    }, 3000);
  };

  const handleRegenerate = () => {
    setPreviewState("generating");
    setTimeout(() => {
      setPreviewState("generated");
    }, 2000);
  };

  return (
    <MobileCustomizerLayout
      currentStep={3}
      stepName="Step 3: Art Style"
      productName="Custom Mug"
      hasNameOverlay={true}
      hasPhotoOverlay={true}
    >
      <div className="px-5 pb-40">
        {/* Title */}
        <h4 className="font-semibold text-xl mt-1 mb-1">
          Choose Your Art Style
        </h4>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          Your photo will be transformed in this style.
        </p>

        {/* Style Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                selectedStyle === style.id
                  ? "border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:border-gray-300"
              }`}
            >
              <div className="h-[100px] overflow-hidden">
                <img
                  src={style.image}
                  alt={style.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3 bg-white">
                <h5 className="font-semibold text-base">{style.name}</h5>
              </div>
              {selectedStyle === style.id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Generate Preview Zone - None/Generating State */}
        {previewState !== "generated" && (
          <button
            onClick={handleGeneratePreview}
            disabled={previewState === "generating"}
            className={`w-full border-2 rounded-xl h-[60px] flex flex-col items-center justify-center transition-all ${
              previewState === "generating"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                : "border-dashed border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
            }`}
          >
            {previewState === "generating" ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                  <p className="font-semibold text-base text-[var(--color-primary)]">
                    Generating...
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  This takes about 20 seconds
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-5 h-5 text-[var(--color-primary)]" />
                  <p className="font-semibold text-base text-[var(--color-primary)]">
                    Generate Preview
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  See exactly how it'll look (≈20 sec)
                </p>
              </>
            )}
          </button>
        )}

        {/* Preview Result State */}
        {previewState === "generated" && (
          <div>
            <div className="rounded-xl overflow-hidden mb-3">
              <img
                src="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop"
                alt="Preview result"
                className="w-full h-[200px] object-cover"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-green-600">
                Looking good! ✨
              </p>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1 px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-[var(--color-primary)]">
              $27.99
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              11oz · {styles.find((s) => s.id === selectedStyle)?.name}
            </p>
          </div>
          <button className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide">
            <ShoppingBag className="w-5 h-5" />
            Add to Cart
          </button>
        </div>
      </div>
    </MobileCustomizerLayout>
  );
}
