import { useState } from "react";
import { MobileCustomizerLayout } from "./MobileCustomizerLayout";
import { Cloud, X, Scissors, Wand2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

type UploadState = "default" | "uploaded" | "processing";

export function MobileCustomizerStep2() {
  const [uploadState, setUploadState] = useState<UploadState>("default");
  const [progress, setProgress] = useState(0);

  const handleUpload = () => {
    setUploadState("uploaded");
  };

  const handleRemoveBg = () => {
    setUploadState("processing");
    setProgress(0);

    // Simulate processing
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setUploadState("uploaded"), 500);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const handleRemove = () => {
    setUploadState("default");
    setProgress(0);
  };

  return (
    <MobileCustomizerLayout
      currentStep={2}
      stepName="Step 2: Add Photo"
      productName="Custom Mug"
      hasNameOverlay={true}
      hasPhotoOverlay={uploadState !== "default"}
    >
      <div className="px-5 pb-32">
        {/* Title */}
        <h4 className="font-semibold text-xl mt-1 mb-1">Upload a Photo</h4>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          A clear, high-res close-up works best.
        </p>

        {/* Upload Zone - Default State */}
        {uploadState === "default" && (
          <div
            onClick={handleUpload}
            className="border-2 border-dashed border-[#E8D5CC] rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
          >
            <Cloud className="w-10 h-10 text-[var(--color-primary)] mb-2" />
            <p className="font-semibold text-base">Tap to upload</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              or take a photo
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              JPG · PNG · HEIC up to 10MB
            </p>
          </div>
        )}

        {/* Upload Zone - Uploaded State */}
        {uploadState === "uploaded" && (
          <div>
            <div className="border border-[var(--color-border)] rounded-xl p-3 flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200"
                alt="Uploaded"
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  family-photo.jpg
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  2.4 MB · ✓ Ready
                </p>
              </div>
              <button
                onClick={handleRemove}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Action Row */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button className="flex items-center justify-center gap-1 px-3 py-2.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold">
                <Scissors className="w-4 h-4" />
                Crop
              </button>
              <button
                onClick={handleRemoveBg}
                className="flex items-center justify-center gap-1 px-3 py-2.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
              >
                <Wand2 className="w-4 h-4" />
                Remove BG
                <span className="text-xs">✨AI</span>
              </button>
              <button
                onClick={() => setUploadState("default")}
                className="flex items-center justify-center gap-1 px-3 py-2.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                Replace
              </button>
            </div>
          </div>
        )}

        {/* Upload Zone - Processing State */}
        {uploadState === "processing" && (
          <div className="border border-[var(--color-border)] rounded-xl p-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200"
                  alt="Processing"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-white/40 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">
                  🪄 Removing background...
                </p>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] text-center">
              Usually 5–10 seconds
            </p>
          </div>
        )}

        {/* Skip Row */}
        <div className="text-center mt-5">
          <p className="text-sm text-[var(--color-text-muted)] inline">
            No photo?{" "}
          </p>
          <button className="text-sm text-[var(--color-primary)] font-semibold hover:underline">
            Skip this step →
          </button>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-3">
          <button className="flex-[0.4] h-12 border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] rounded-lg font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-2">
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <button
            disabled={uploadState === "default" || uploadState === "processing"}
            className={`flex-[0.6] h-12 rounded-lg font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${
              uploadState === "uploaded"
                ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
                : "bg-gray-200 text-[var(--color-text-muted)] cursor-not-allowed"
            }`}
          >
            Continue: Choose Style
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </MobileCustomizerLayout>
  );
}
