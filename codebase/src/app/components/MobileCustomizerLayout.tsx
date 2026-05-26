import { X, Eye } from "lucide-react";

interface MobileCustomizerLayoutProps {
  children: React.ReactNode;
  currentStep: 1 | 2 | 3;
  stepName: string;
  productName: string;
  previewImage?: string;
  hasNameOverlay?: boolean;
  hasPhotoOverlay?: boolean;
  activeAngle?: "front" | "side" | "back";
  onAngleChange?: (angle: "front" | "side" | "back") => void;
}

export function MobileCustomizerLayout({
  children,
  currentStep,
  stepName,
  productName,
  previewImage = "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=400",
  hasNameOverlay = false,
  hasPhotoOverlay = false,
  activeAngle = "front",
  onAngleChange,
}: MobileCustomizerLayoutProps) {
  const progressPercentage = (currentStep / 3) * 100;

  return (
    <div className="relative w-[390px] h-[844px] bg-white mx-auto overflow-hidden">
      {/* Canvas Preview Zone */}
      <div className="relative h-[388px] bg-[#1A1A1A] flex flex-col">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-10">
          <button
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <p className="text-sm text-white font-medium">{stepName}</p>

          <button className="flex items-center gap-1 px-3 py-1.5 text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-semibold">
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </div>

        {/* Product Mockup */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="relative w-[300px] h-[300px]">
            <img
              src={previewImage}
              alt="Product mockup"
              className="w-full h-full object-contain drop-shadow-2xl"
            />

            {/* Name Overlay */}
            {hasNameOverlay && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white font-['Playfair_Display'] text-2xl font-bold text-center px-8">
                  John & Sarah
                </p>
              </div>
            )}

            {/* Photo Overlay */}
            {hasPhotoOverlay && (
              <div className="absolute inset-0 flex items-center justify-center p-12">
                <div className="w-32 h-32 bg-white/20 rounded-lg backdrop-blur-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Angle Tabs */}
        <div className="flex items-center justify-center gap-2 pb-4 px-4">
          <button
            onClick={() => onAngleChange?.("front")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeAngle === "front"
                ? "bg-white text-[#1A1A1A]"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Front {activeAngle === "front" && "✓"}
          </button>
          <button
            onClick={() => onAngleChange?.("side")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeAngle === "side"
                ? "bg-white text-[#1A1A1A]"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Side
          </button>
          <button
            onClick={() => onAngleChange?.("back")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeAngle === "back"
                ? "bg-white text-[#1A1A1A]"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Back
          </button>
        </div>
      </div>

      {/* Form Sheet */}
      <div className="h-[456px] bg-white rounded-t-[20px] -mt-4 relative flex flex-col">
        {/* Drag Handle */}
        <div className="flex justify-center pt-2">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Progress Bar */}
        <div className="px-5 pt-3">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Step Label */}
        <div className="px-5 pt-2 flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-muted)]">
            Step {currentStep} of 3
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {productName}
          </p>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
