export default function PurchaseProgressIndicator({ progress }) {
  if (progress <= 0) return null;

  return (
    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
      <div
        className="absolute bottom-0 left-0 right-0 bg-emerald-500/20 transition-all duration-75"
        style={{ height: `${progress}%` }}
      />
      <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-xl" />
    </div>
  );
}
