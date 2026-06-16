import { useEffect, useRef, useState } from 'react';
import { Scissors, ChevronLeft, ChevronRight, Move, Settings } from 'lucide-react';
import DraggableModal from './DraggableModal';

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

/** Interactive torus menu preview for the editor modal */
function TorusMenuPreview({ items, cx, cy, innerR, outerR, rotationOffset, onSectorClick }: {
  items: MenuItem[];
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  rotationOffset: number;
  onSectorClick: (label: string) => void;
}) {
  const sectorAngle = (Math.PI * 2) / items.length;

  return (
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
              style={{ cursor: 'pointer' }}
              onClick={() => onSectorClick(item.label)}
            />
            <foreignObject
              x={labelX - 36}
              y={labelY - 16}
              width={72}
              height={32}
              style={{ cursor: 'pointer', overflow: 'visible', pointerEvents: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: 'var(--text-primary)',
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
}

export default function TorusMenu({ pos, target, onClose, onSplit, onTrimLatter, onTrimFormer, onStep, onRoll }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);

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

  const cx = 120;
  const cy = 120;
  const innerR = 52;
  const outerR = 100;
  const sectorAngle = (Math.PI * 2) / items.length;
  const rotationOffset = -Math.PI / 6;

  // Calculate gear button position (above the Split sector)
  const splitIndex = items.findIndex(item => item.label === 'Split');
  const gearAngle = splitIndex >= 0
    ? splitIndex * sectorAngle - Math.PI / 2 + rotationOffset + sectorAngle / 2
    : -Math.PI / 2;
  const gearR = outerR + 18;
  const gearX = cx + gearR * Math.cos(gearAngle);
  const gearY = cy + gearR * Math.sin(gearAngle);

  // Convert gear position to viewport coordinates
  const gearViewportX = pos.x - cx + gearX;
  const gearViewportY = pos.y - cy + gearY;

  const handleOpenEditor = () => {
    setShowEditor(true);
    onClose();
  };

  const handleSectorClick = (label: string) => {
    console.log('Torus sector clicked:', label);
  };

  return (
    <>
      <style>{`
        @keyframes torus-open {
          0% { opacity: 0; transform: scale(0.3); }
          60% { opacity: 1; }
          80% { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div
        className="torus-overlay"
        ref={ref}
        style={{ left: pos.x - cx, top: pos.y - cy, animation: 'torus-open 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.torus-sector')) return;
          onClose();
        }}
      >
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
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
                />
                <foreignObject
                  x={labelX - 36}
                  y={labelY - 16}
                  width={72}
                  height={32}
                  className="torus-sector"
                  style={{ cursor: 'pointer', overflow: 'visible' }}
                  onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      color: 'var(--text-primary)',
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
      </div>

      {/* Gear button — rendered as a separate fixed element above the torus overlay */}
      <div
        onClick={handleOpenEditor}
        style={{
          position: 'fixed',
          left: gearViewportX - 14,
          top: gearViewportY - 14,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-mid)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          color: 'var(--text-secondary)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <Settings size={14} />
      </div>

      {showEditor && (
        <DraggableModal
          title="Torus Menu Editor"
          onClose={() => setShowEditor(false)}
          style={{ width: 420, minHeight: 400 }}
          body={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
                Interactive preview — click sectors to test
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: 280,
                height: 280,
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                <TorusMenuPreview
                  items={insideItems}
                  cx={140}
                  cy={140}
                  innerR={52}
                  outerR={100}
                  rotationOffset={-Math.PI / 6}
                  onSectorClick={handleSectorClick}
                />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
                {items.length} sectors • {isEdgeOrCut ? 'Edge/Cut' : 'Inside'} mode
              </div>
            </div>
          }
        />
      )}
    </>
  );
}