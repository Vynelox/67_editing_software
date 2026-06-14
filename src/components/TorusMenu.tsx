import { useEffect, useRef } from 'react';
import { Scissors, ChevronLeft, ChevronRight, Move } from 'lucide-react';

type TorusTarget =
  | { kind: 'inside'; clipId: string; frame: number }
  | { kind: 'edge'; clipId: string; side: 'start' | 'end'; frame: number }
  | { kind: 'cut'; clipAId: string; clipBId: string; frame: number };

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  color?: string;
}

interface Props {
  pos: { x: number; y: number };
  target: TorusTarget;
  onClose: () => void;
  onSplit: () => void;
  onTrimLatter: (ripple: boolean) => void;
  onTrimFormer: (ripple: boolean) => void;
  onStep: (dir: number, ripple: boolean) => void;
  onRoll: () => void;
}

export default function TorusMenu({ pos, target, onClose, onSplit, onTrimLatter, onTrimFormer, onStep, onRoll }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const clickHandler = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      };
      const scrollHandler = () => {
        onClose();
      };
      window.addEventListener('mousedown', clickHandler);
      window.addEventListener('scroll', scrollHandler, true);
      return () => {
        window.removeEventListener('mousedown', clickHandler);
        window.removeEventListener('scroll', scrollHandler, true);
      };
    }, 10);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isEdgeOrCut = target.kind === 'edge' || target.kind === 'cut';

  const insideItems: MenuItem[] = [
    { label: 'Split', icon: <Scissors size={14} />, action: onSplit, color: '#60a5fa' },
    { label: 'Trim \u2192', icon: <ChevronRight size={14} />, action: () => onTrimLatter(false), color: '#34d399' },
    { label: 'Trim \u2190', icon: <ChevronLeft size={14} />, action: () => onTrimFormer(false), color: '#34d399' },
    { label: '\u21DD Ripple \u2192', icon: <ChevronRight size={14} />, action: () => onTrimLatter(true), color: '#fbbf24' },
    { label: '\u21DC Ripple \u2190', icon: <ChevronLeft size={14} />, action: () => onTrimFormer(true), color: '#fbbf24' },
    { label: 'Roll', icon: <Move size={14} />, action: onRoll, color: '#f472b6' },
  ];

  const edgeItems: MenuItem[] = [
    { label: 'Step +1f', icon: <ChevronRight size={14} />, action: () => onStep(1, false), color: '#60a5fa' },
    { label: 'Step \u22121f', icon: <ChevronLeft size={14} />, action: () => onStep(-1, false), color: '#60a5fa' },
    { label: '\u21DD Ripple +1f', icon: <ChevronRight size={14} />, action: () => onStep(1, true), color: '#fbbf24' },
    { label: '\u21DC Ripple \u22121f', icon: <ChevronLeft size={14} />, action: () => onStep(-1, true), color: '#fbbf24' },
  ];

  const items = isEdgeOrCut ? edgeItems : insideItems;
  const radius = 88;
  const size = 240;
  const centerX = size / 2;
  const centerY = size / 2;

  return (
    <div
      className="torus-overlay"
      ref={ref}
      style={{ left: pos.x - centerX, top: pos.y - centerY }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('.torus-item')) return;
        onClose();
      }}
    >
      {items.map((item, i) => {
        const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius - 32;
        const y = centerY + Math.sin(angle) * radius - 28;
        return (
          <button
            key={item.label}
            className="torus-item"
            style={{
              left: x,
              top: y,
              background: 'var(--input-field-bg)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
            title={item.label}
          >
            <span style={{ color: item.color }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}