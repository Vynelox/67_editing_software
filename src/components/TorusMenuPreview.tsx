import { Scissors, ChevronLeft, ChevronRight, Move } from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  color?: string;
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

interface Props {
  items: MenuItem[];
  cx?: number;
  cy?: number;
  innerR?: number;
  outerR?: number;
  rotationOffset?: number;
  onSectorClick?: (label: string) => void;
}

export default function TorusMenuPreview({
  items,
  cx = 140,
  cy = 140,
  innerR = 52,
  outerR = 100,
  rotationOffset = -Math.PI / 6,
  onSectorClick,
}: Props) {
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
              onClick={() => onSectorClick?.(item.label)}
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

export const insideMenuItems: MenuItem[] = [
  { label: 'Split', icon: <Scissors size={14} />, color: '#60a5fa' },
  { label: 'Trim \u2192', icon: <ChevronRight size={14} />, color: '#34d399' },
  { label: 'Trim \u2190', icon: <ChevronLeft size={14} />, color: '#34d399' },
  { label: '\u21DD Ripple \u2192', icon: <ChevronRight size={14} />, color: '#fbbf24' },
  { label: '\u21DC Ripple \u2190', icon: <ChevronLeft size={14} />, color: '#fbbf24' },
  { label: 'Roll', icon: <Move size={14} />, color: '#f472b6' },
];