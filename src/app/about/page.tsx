export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-sans text-3xl font-bold mb-6">关于</h1>
      <div className="card p-8 space-y-4">
        <p style={{ color: "var(--text-secondary)" }}>这里把技术记录和日常想法放在同一个地方，但保留不同的语气。写作尽量简单，界面尽量安静。</p>
        <p style={{ color: "var(--text-secondary)" }}>技术类文章追求清晰和准确，随笔则是自由流动的思考。</p>
      </div>
    </div>
  );
}
