/**
 * The "working" mark inside the forward button while an answer is being saved: a small spinner, or
 * three static dots when the customer prefers reduced motion. It is decoration: the text next to it
 * says what is happening.
 */
export default function SavingIndicator({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return (
      <span data-testid="saving-indicator" data-variant="dots" aria-hidden="true" className="flex items-center gap-1">
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
    );
  }
  return (
    <span
      data-testid="saving-indicator"
      data-variant="spinner"
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
