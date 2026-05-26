import { useState } from "react";
import { Upload, Crop, Wand2, RotateCcw, X, Eye, Loader2 } from "lucide-react";

interface ArtStyle {
  id: string;
  name: string;
  preview: string;
}

const artStyles: ArtStyle[] = [
  {
    id: "watercolor",
    name: "Watercolor",
    preview:
      "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200&h=120&fit=crop",
  },
  {
    id: "cartoon",
    name: "Cartoon",
    preview:
      "https://images.unsplash.com/photo-1645497265341-38cabe0f4414?w=200&h=120&fit=crop",
  },
  {
    id: "realistic",
    name: "Realistic",
    preview:
      "https://images.unsplash.com/photo-1764267704086-261af367c19f?w=200&h=120&fit=crop",
  },
  {
    id: "vangogh",
    name: "Van Gogh",
    preview:
      "https://images.unsplash.com/photo-1618607070410-09a4aef07b45?w=200&h=120&fit=crop",
  },
];

interface CustomizerPanelProps {
  price: number;
  onAddToCart?: () => void;
}

export function CustomizerPanel({ price, onAddToCart }: CustomizerPanelProps) {
  const [namesText, setNamesText] = useState("");
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("watercolor");
  const [message, setMessage] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const isFormValid = namesText.trim().length > 0 && selectedStyle;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneratePreview = () => {
    setIsGeneratingPreview(true);
    setPreviewProgress(0);
    const interval = setInterval(() => {
      setPreviewProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGeneratingPreview(false);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  return (
    <div className="bg-[#FFF8F5] border border-[#E8D5CC] rounded-2xl p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-semibold text-lg flex items-center gap-2">
          <span>✏️</span> Personalize Your Mug
        </h4>
        <span className="text-sm text-[var(--color-primary)] font-medium">
          Required *
        </span>
      </div>

      {/* Field 1: Names or Text */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="font-semibold text-base">Names or Text</span>
          <span className="text-[var(--color-primary)] ml-1">* required</span>
        </label>
        <input
          type="text"
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          placeholder="e.g. John & Sarah"
          maxLength={30}
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
        />
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="text-[var(--color-text-muted)] flex items-center gap-1">
            💬 Tip: Keep it under 20 chars for best results
          </span>
          <span className="text-[var(--color-text-muted)]">
            {namesText.length} / 30
          </span>
        </div>
      </div>

      {/* Field 2: Upload Photo */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="font-semibold text-base">Upload a Photo</span>
          <span className="text-[var(--color-text-muted)] ml-2">(optional)</span>
        </label>

        {!uploadedPhoto ? (
          <label className="block border-2 border-dashed border-[#E8D5CC] rounded-lg h-[100px] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/heic"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-[var(--color-primary)] mb-2" />
            <p className="text-sm text-[var(--color-secondary)]">
              Drop photo here or click to browse
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              JPG, PNG, HEIC up to 10MB
            </p>
          </label>
        ) : (
          <div className="border border-[#E8D5CC] rounded-lg p-3 bg-white">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={uploadedPhoto}
                alt="Uploaded"
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">photo.jpg</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Upload complete
                </p>
              </div>
              <button
                onClick={() => setUploadedPhoto(null)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <Crop className="w-4 h-4" />
                Crop
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors relative">
                <Wand2 className="w-4 h-4" />
                Remove BG
                <span className="absolute -top-2 -right-2 text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                  ✨ AI
                </span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <RotateCcw className="w-4 h-4" />
                Replace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Field 3: Art Style */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="font-semibold text-base">Art Style</span>
          <span className="text-[var(--color-primary)] ml-1">* required</span>
        </label>

        <div className="grid grid-cols-2 gap-2 md:gap-3">
          {artStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`relative bg-white border rounded-lg overflow-hidden transition-all ${
                selectedStyle === style.id
                  ? "border-2 border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
                  : "border border-[#E8D5CC] hover:border-[var(--color-primary)]/50"
              }`}
            >
              {/* Preview Image */}
              <div className="aspect-[16/10] overflow-hidden">
                <img
                  src={style.preview}
                  alt={style.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Style Name */}
              <div className="p-2 text-center">
                <p className="text-sm font-semibold">{style.name}</p>
              </div>

              {/* Checkmark */}
              {selectedStyle === style.id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Field 4: Personal Message */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="font-semibold text-base">Personal Message</span>
          <span className="text-[var(--color-text-muted)] ml-2">(optional)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a special message..."
          maxLength={100}
          rows={3}
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all resize-none"
        />
        <div className="flex justify-end mt-2 text-sm text-[var(--color-text-muted)]">
          {message.length} / 100
        </div>
      </div>

      {/* Preview Button */}
      <button
        onClick={handleGeneratePreview}
        disabled={!isFormValid || isGeneratingPreview}
        className="w-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white font-semibold py-4 rounded-lg transition-all mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGeneratingPreview ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating your preview...
          </>
        ) : (
          <>
            <Eye className="w-5 h-5" />
            Generate Preview — takes ~20 sec
          </>
        )}
      </button>

      {/* Progress Bar */}
      {isGeneratingPreview && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[var(--color-primary)] h-full transition-all duration-300"
              style={{ width: `${previewProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Add to Cart Button */}
      <button
        onClick={onAddToCart}
        disabled={!isFormValid}
        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base uppercase tracking-wide"
        title={!isFormValid ? "Please complete all required fields" : ""}
      >
        Add to Cart — ${price.toFixed(2)}
      </button>

      {/* Trust Strip */}
      <div className="mt-4 flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <span>🚚</span>
          <span>Ships in 3–5 business days</span>
        </div>
        <div className="hidden md:block text-[var(--color-border)]">|</div>
        <div className="flex items-center gap-2">
          <span>✅</span>
          <span>Cancel within 2 hours</span>
        </div>
        <div className="hidden md:block text-[var(--color-border)]">|</div>
        <div className="flex items-center gap-2">
          <span>🔒</span>
          <span>Secure checkout</span>
        </div>
      </div>
    </div>
  );
}
