import React, { useRef, useEffect } from 'react';

interface Props {
  orientation: 'vertical' | 'horizontal';
  onChange: (delta: number) => void; // delta in px
  onDragEnd?: () => void;
  thickness?: number;
  background?: string;
}

export default function Splitter({ orientation, onChange, onDragEnd, thickness = 8, background = 'transparent' }: Props) {
  const startRef = useRef(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const handlePointerMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const pos = orientation === 'vertical' ? e.clientX : e.clientY;
    const delta = pos - startRef.current;
    startRef.current = pos;
    // For horizontal splitter, delta should move timeline height in the same direction as pointer (down increases height)
    onChange(delta);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (onDragEnd) onDragEnd();
  };

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    startRef.current = orientation === 'vertical' ? e.clientX : e.clientY;
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    // attach document-level pointer listeners
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const style: React.CSSProperties = orientation === 'vertical'
    ? { width: thickness, cursor: 'col-resize', background: background, flexShrink: 0 }
    : { height: thickness, cursor: 'row-resize', background: background, flexShrink: 0 };

  return <div role="separator" aria-orientation={orientation} onPointerDown={handleDown} style={style} />;
}
