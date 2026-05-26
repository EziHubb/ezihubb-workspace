import { useState } from "react";
import { MobileCustomizerLayout } from "./MobileCustomizerLayout";
import { ChevronRight } from "lucide-react";

export function MobileCustomizerStep1() {
  const [namesText, setNamesText] = useState("");
  const [message, setMessage] = useState("");
  const [showAutoFill, setShowAutoFill] = useState(true);

  const handleAutoFill = () => {
    setNamesText("John & Sarah");
    setMessage("Happy Anniversary! Love always.");
    setShowAutoFill(false);
  };

  return (
    <MobileCustomizerLayout
      currentStep={1}
      stepName="Step 1: Add Names"
      productName="Custom Mug"
      hasNameOverlay={false}
    >
      <div className="px-5 pb-32">
        {/* Title */}
        <h4 className="font-semibold text-xl mt-1 mb-1">
          Add Names & Message
        </h4>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          This text will appear on your product.
        </p>

        {/* Names or Text Field */}
        <div className="mb-4">
          <label className="block mb-2">
            <span className="font-semibold text-base">Names or Text</span>
            <span className="text-[var(--color-primary)] ml-1">*</span>
          </label>
          <input
            type="text"
            value={namesText}
            onChange={(e) => setNamesText(e.target.value.slice(0, 30))}
            placeholder="e.g. John & Sarah"
            className="w-full h-11 px-4 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-base"
            maxLength={30}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-[var(--color-text-muted)]">
              💡 Use '&' between two names
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {namesText.length}/30
            </p>
          </div>
        </div>

        {/* Personal Message Field */}
        <div className="mb-4">
          <label className="block mb-2">
            <span className="font-semibold text-base">Personal Message</span>
            <span className="text-xs text-[var(--color-text-muted)] ml-2">
              (optional)
            </span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 100))}
            placeholder="Add a birthday wish, anniversary note..."
            rows={3}
            className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-base resize-none"
            maxLength={100}
          />
          <div className="flex justify-end mt-2">
            <p className="text-xs text-[var(--color-text-muted)]">
              {message.length}/100
            </p>
          </div>
        </div>

        {/* Auto-fill Banner */}
        {showAutoFill && (
          <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-lg p-3 mb-4">
            <p className="text-sm text-[var(--color-secondary)]">
              💡 You customized this before.{" "}
              <button
                onClick={handleAutoFill}
                className="text-[var(--color-primary)] font-semibold hover:underline"
              >
                Auto-fill →
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          disabled={!namesText}
          className={`w-full h-12 rounded-lg font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${
            namesText
              ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
              : "bg-gray-200 text-[var(--color-text-muted)] cursor-not-allowed"
          }`}
        >
          Continue: Add Photo
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </MobileCustomizerLayout>
  );
}
