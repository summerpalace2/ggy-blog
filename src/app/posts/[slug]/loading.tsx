export default function PostLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
        <div className="h-8 w-3/4 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
        <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
        <div className="h-4 w-2/3 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
      </div>
    </div>
  );
}
