"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* eslint-disable @next/next/no-img-element */

export function PostBody({ content }: { content: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          img: ({ src, alt }: any) => {
            if (!src) return null;
            return <img src={src} alt={alt || ""} loading="lazy" style={{ maxWidth: "100%", borderRadius: 8 }} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
