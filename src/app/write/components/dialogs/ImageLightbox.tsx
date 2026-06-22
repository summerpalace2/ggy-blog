/**
 * dialogs/ImageLightbox.tsx — 图片灯箱
 * [核心职责] 全屏查看图片，ESC关闭
 */

"use client";

import { useEffect, type FC } from "react";

interface Props {
  src: string;
  onClose: () => void;
}

export const ImageLightbox: FC<Props> = ({ src, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 cursor-zoom-out" onClick={onClose}>
      <img src={src} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
};
