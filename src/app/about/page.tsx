export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-sans text-3xl font-bold mb-6">关于</h1>
      <div className="card p-8 space-y-4" style={{ lineHeight: 2 }}>
        <p style={{ color: "var(--text-secondary)" }}>
          最近看到一个观点——人要尽早搭建属于自己的知识库。虽然说得简短，但让我产生了联想：什么是属于自己的知识库？
        </p>
        <p style={{ color: "var(--text-secondary)" }}>
          高中时，我偶尔灵光一闪，会把想法写在便利贴上，然后进一步去思考。所以迁移思维，应该就是自己经历过的事，去想过，最后总结起来。哪怕只是看了一个长视频、读了一篇文章、写了一些代码、经历了一些生活。这些完全可以收集起来，搭建属于自己的知识库。
        </p>
        <p style={{ color: "var(--text-secondary)" }}>
          一年两年，也许能积累不少。这个博客就这样诞生了。为了给自己更好的学习体验，我花了几天时间实现了类似飞书云文档的写作效果，方便迁移思维。后续我也会把这个写法开源出来，方便大家取经。
        </p>
      </div>
    </div>
  );
}
