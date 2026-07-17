"use client";

import { useState, useCallback, RefObject } from "react";

interface ResizerProps {
  wrapperRef: RefObject<HTMLDivElement | null>;
  lineHeightPx: number;
}

export function Resizer({ wrapperRef, lineHeightPx }: ResizerProps) {
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);

    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const startY = e.clientY;
    const startHeight = wrapper.clientHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newHeight = Math.max(lineHeightPx * 3, startHeight + delta);
      wrapper.style.height = newHeight + "px";
      wrapper.style.maxHeight = "none"; // user override
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [wrapperRef, lineHeightPx]);

  return (
    <div
      className="cm-resize-handle"
      onMouseDown={onMouseDown}
      title="拖拽调整代码块高度"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 11L11 1" />
        <path d="M5 11L11 5" />
        <path d="M9 11L11 9" />
      </svg>
    </div>
  );
}
