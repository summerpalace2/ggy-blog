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
      wrapper.style.maxHeight = "none";
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
      className="cm-resize-bar"
      onMouseDown={onMouseDown}
      title="拖拽调整代码块高度"
    >
      <div className="cm-resize-bar-thumb" />
    </div>
  );
}