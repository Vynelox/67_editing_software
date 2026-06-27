import { useEffect, useRef, ReactNode } from 'react';
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
  // Mode
  interactive?: boolean;

  // Interactive-only
  pos?: { x: number; y: number };
  target?: TorusTarget;
  onClose?: () => void;
  onSplit?: () => void;
  onTrimLatter?: (ripple: boolean) => void;
  onTrimFormer?: (ripple: boolean) => void;
  onStep?: (dir: number, ripple: boolean) => void;
  onRoll?: () => void;
  showCloseButton?: boolean;

  // Preview-only
  items?: MenuItem[];
  cx?: number;
  cy?: number;
  innerR?: number;
  outerR?: number;
  rotationOffset?: number;
  onSectorClick?: (label: string) => void;

  // Animation
  duration?: number;
  easing?: number;
  delay?: number;

  // Shared
  closeOnBackgroundClick?: boolean;
}

function annularSectorPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
  gap: number = 1.5
): string {
  const sa = startAngle + gap * 0.5 * (Math.PI / 180);
  const ea = endAngle - gap * 0.5 * (Math.PI / 180);

  const x1 = cx + innerR * Math.cos(sa);
  const y1 = cy + innerR * Math.sin(sa);
  const x2 = cx + outerR * Math.cos(sa);
  const y2 = cy + outerR * Math.sin(sa);
  const x3 = cx + outerR * Math.cos(ea);
  const y3 = cy + outerR * Math.sin(ea);
  const x4 = cx + innerR * Math.cos(ea);
  const y4 = cy + innerR * Math.sin(ea);

  const largeArc = (ea - sa) > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3}`,
    `L ${x4} ${y4}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1}`,
    'Z',
  ].join(' ');
}

function getSavedDuration(): number {
  try {
    const v = window.localStorage.getItem('juicecut.settings.torusDuration');
    if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 2000) return n; }
  } catch {}
  return 300;
}

function getSavedEasing(): number {
  try {
    const v = window.localStorage.getItem('juicecut.settings.torusEasing');
    if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 100) return n; }
  } catch {}
  return 50;
}

function getSavedDelay(): number {
  try {
    const v = window.localStorage.getItem('juicecut.settings.torusDelay');
    if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= -1000 && n <= 1000) return n; }
  } catch {}
  return 0;
}

export default function TorusMenu({
  interactive = false,
  pos = { x: 0, y: 0 },
  target,
  onClose = () => {},
  onSplit = () => {},
  onTrimLatter = () => {},
  onTrimFormer = () => {},
  onStep = () => {},
  onRoll = () => {},
  showCloseButton = false,
  duration: durationProp,
  easing: easingProp,
  delay: delayProp,
  items: propItems,
  cx: propCx,
  cy: propCy,
  innerR: propInnerR,
  outerR: propOuterR,
  rotationOffset: propRotationOffset,
  onSectorClick,
  closeOnBackgroundClick = true,
}: Props) {
  const duration = durationProp ?? getSavedDuration();
  const easing = easingProp ?? getSavedEasing();
  const delay = delayProp ?? getSavedDelay();

  const cx = propCx ?? 120;
  const cy = propCy ?? 120;
  const innerR = propInnerR ?? 52;
  const outerR = propOuterR ?? 100;
  const rotationOffset = propRotationOffset ?? (-Math.PI / 6);

  const isEdgeOrCut = interactive && target ? (target.kind === 'edge' || target.kind === 'cut') : false;

  const insideItems: MenuItem[] = interactive
    ? [
        { label: 'Split', icon: <Scissors size={14} />, action: onSplit, color: '#60a5fa' },
        { label: 'Trim', icon: <ChevronRight size={14} />, action: () => onTrimLatter(false), color: '#34d399' },
        { label: 'Trim', icon: <ChevronLeft size={14} />, action: () => onTrimFormer(false), color: '#34d399' },
        { label: 'Ripple', icon: <ChevronRight size={14} />, action: () => onTrimLatter(true), color: '#fbbf24' },
        { label: 'Ripple', icon: <ChevronLeft size={14} />, action: () => onTrimFormer(true), color: '#fbbf24' },
        { label: 'Roll', icon: <Move size={14} />, action: onRoll, color: '#f472b6' },
      ]
    : (propItems ?? []);

  const edgeItems: MenuItem[] = interactive
    ? [
        { label: '+1f', icon: <ChevronRight size={14} />, action: () => onStep(1, false), color: '#60a5fa' },
        { label: '-1f', icon: <ChevronLeft size={14} />, action: () => onStep(-1, false), color: '#60a5fa' },
        { label: 'Ripple +1f', icon: <ChevronRight size={14} />, action: () => onStep(1, true), color: '#fbbf24' },
        { label: 'Ripple -1f', icon: <ChevronLeft size={14} />, action: () => onStep(-1, true), color: '#fbbf24' },
      ]
    : [];

  const items = isEdgeOrCut ? edgeItems : insideItems;
  const sectorAngle = (Math.PI * 2) / items.length;

  // Interactive-only: scroll-to-close and background-click-to-close
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!interactive) return;
    const timer = setTimeout(() => {
      const scrollHandler = () => { onClose(); };
      window.addEventListener('scroll', scrollHandler, true);

      let clickHandler: ((e: MouseEvent) => void) | null = null;
      if (closeOnBackgroundClick) {
        clickHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('.torus-toggle-btn')) return;
          if (target.closest('.torus-center-btn')) return;
          if (ref.current && !ref.current.contains(target)) {
            onClose();
          }
        };
        window.addEventListener('mousedown', clickHandler);
      }

      return () => {
        window.removeEventListener('scroll', scrollHandler, true);
        if (clickHandler) window.removeEventListener('mousedown', clickHandler);
      };
    }, 10);
    return () => clearTimeout(timer);
  }, [onClose, interactive, closeOnBackgroundClick]);

  // Animation helpers
  const durationSec = duration / 1000;
  const t = easing / 100; // 0 = linear, 1 = max ease-in

  const getEasing = () => {
    // 0 = linear (cubic-bezier(0, 0, 1, 1))
    // max = strong ease-in (cubic-bezier(0.2, 0, 1, 1.3))
    const x2 = 1 - t * 0.8; // 1.0 (linear) -> 0.2 (strong ease-in)
    const y2 = 1 + t * 0.3; // slight overshoot for bounce feel
    return `cubic-bezier(${x2.toFixed(2)}, 0, 1, ${y2.toFixed(2)})`;
  };

  // Compute per-sector delay based on delay prop and sector index
  // delay = 0: all sectors animate at once (same as old pop)
  // delay > 0: sectors pop in clockwise one by one
  // delay < 0: sectors pop in anticlockwise one by one
  const getSectorDelay = (index: number): number => {
    if (delay === 0) return 0;
    const count = items.length;
    if (delay > 0) {
      // Clockwise: index 0 first, then 1, 2, ...
      return index * (delay / 1000);
    } else {
      // Anticlockwise: last index first
      return (count - 1 - index) * (-delay / 1000);
    }
  };

  const getSectorStyle = (index: number): React.CSSProperties => {
    const sectorDelay = getSectorDelay(index);
    return {
      cursor: 'pointer',
      animation: `torus-sector-pop ${durationSec}s ${getEasing()} ${sectorDelay.toFixed(3)}s forwards`,
      opacity: 0,
      transform: 'scale(0)',
      transformOrigin: `${cx}px ${cy}px`,
      transformBox: 'view-box' as const,
    };
  };

  const handleSectorClick = (item: MenuItem) => {
    if (interactive) {
      item.action();
      onClose();
    } else {
      onSectorClick?.(item.label);
    }
  };

  const svgContent = (
    <svg width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      {items.map((item, i) => {
        const startAngle = i * sectorAngle - Math.PI / 2 + rotationOffset;
        const endAngle = (i + 1) * sectorAngle - Math.PI / 2 + rotationOffset;
        const midAngle = (startAngle + endAngle) / 2;
        const labelR = (innerR + outerR) / 2;
        const labelX = cx + labelR * Math.cos(midAngle);
        const labelY = cy + labelR * Math.sin(midAngle);

        return (
          <g key={item.label}>
            <path
              d={annularSectorPath(cx, cy, innerR, outerR, startAngle, endAngle)}
              fill="var(--input-field-bg)"
              stroke="var(--border-mid)"
              strokeWidth={0.5}
              className="torus-sector"
              style={getSectorStyle(i)}
              onClick={(e) => { e.stopPropagation(); handleSectorClick(item); }}
            />
            <foreignObject
              x={labelX - 36}
              y={labelY - 16}
              width={72}
              height={32}
              className="torus-sector"
              style={{ cursor: 'pointer', overflow: 'visible', ...getSectorStyle(i) }}
              onClick={(e) => { e.stopPropagation(); handleSectorClick(item); }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: item.color,
                  fontSize: 10,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  pointerEvents: 'none',
                  gap: 1,
                }}
              >
                <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );

  return (
    <>
      <style>{`
        @keyframes torus-sector-pop {
          0% { opacity: 0; transform: scale(0); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {interactive ? (
        <div
          className="torus-overlay"
          ref={ref}
          style={{ left: pos.x - cx, top: pos.y - cy, transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}
          onMouseDown={(e) => { e.stopPropagation(); }}
        >
          {svgContent}
          {showCloseButton && (
            <button
              type="button"
              className="torus-center-btn"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              title="Close"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '2px solid var(--accent-blue)',
                background: 'rgba(56,189,248,0.2)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        svgContent
      )}
    </>
  );
}
export const insideMenuItems: MenuItem[] = [
  { label: 'Split', icon: <Scissors size={14} />, action: () => {}, color: '#60a5fa' },
  { label: 'Trim', icon: <ChevronRight size={14} />, action: () => {}, color: '#34d399' },
  { label: 'Trim', icon: <ChevronLeft size={14} />, action: () => {}, color: '#34d399' },
  { label: 'Ripple', icon: <ChevronRight size={14} />, action: () => {}, color: '#fbbf24' },
  { label: 'Ripple', icon: <ChevronLeft size={14} />, action: () => {}, color: '#fbbf24' },
  { label: 'Roll', icon: <Move size={14} />, action: () => {}, color: '#f472b6' },
];
