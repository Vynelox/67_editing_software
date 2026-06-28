import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface SizeGraphPoint {
  time: number;
  size: number;
}

const GRAPH_WIDTH = 260;
const GRAPH_HEIGHT = 180;
const GRAPH_PADDING = 20;
const GRAPH_PLOT_WIDTH = GRAPH_WIDTH - GRAPH_PADDING * 2;
const GRAPH_PLOT_HEIGHT = GRAPH_HEIGHT - GRAPH_PADDING * 2;

export const DEFAULT_TORUS_SIZE_GRAPH: SizeGraphPoint[] = [
  { time: 0, size: 0 },
  { time: 0.75, size: 1 },
  { time: 1, size: 1 },
];

export function getSavedSizeGraph(): SizeGraphPoint[] {
  try {
    const raw = window.localStorage.getItem('juicecut.settings.torusSizeGraph');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const points = parsed
          .map((item: any) => ({ time: Number(item?.time), size: Number(item?.size) }))
          .filter(p => !Number.isNaN(p.time) && !Number.isNaN(p.size));
        if (points.length >= 2) {
          const sorted = points.sort((a, b) => a.time - b.time);
          return [
            { time: 0, size: 0 },
            ...sorted.filter(p => p.time > 0 && p.time < 1),
            { time: 1, size: 1 },
          ];
        }
      }
    }
  } catch {}
  return DEFAULT_TORUS_SIZE_GRAPH;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function graphPointToSvg(point: SizeGraphPoint) {
  return {
    x: GRAPH_PADDING + point.time * GRAPH_PLOT_WIDTH,
    y: GRAPH_PADDING + (1 - point.size) * GRAPH_PLOT_HEIGHT,
  };
}

function graphCoordsFromEvent(event: { clientX: number; clientY: number }, svg: SVGSVGElement | null) {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left - GRAPH_PADDING) / GRAPH_PLOT_WIDTH, 0, 1);
  const y = clamp(1 - (event.clientY - rect.top - GRAPH_PADDING) / GRAPH_PLOT_HEIGHT, 0, 1);
  return { time: x, size: y };
}

function buildSmoothCurvePath(points: SizeGraphPoint[]) {
  if (points.length === 0) return '';
  const svgPoints = points.map(graphPointToSvg);
  if (svgPoints.length === 1) return `M ${svgPoints[0].x} ${svgPoints[0].y}`;

  let d = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
  for (let i = 0; i < svgPoints.length - 1; i++) {
    const p0 = svgPoints[i - 1] ?? svgPoints[i];
    const p1 = svgPoints[i];
    const p2 = svgPoints[i + 1];
    const p3 = svgPoints[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function buildCurveAnchors(points: SizeGraphPoint[]) {
  const anchors: Array<{ x: number; y: number }> = [];
  const svgPoints = points.map(graphPointToSvg);
  for (let i = 0; i < svgPoints.length - 1; i++) {
    const p0 = svgPoints[i - 1] ?? svgPoints[i];
    const p1 = svgPoints[i];
    const p2 = svgPoints[i + 1];
    const p3 = svgPoints[i + 2] ?? p2;
    anchors.push({ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 });
    anchors.push({ x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 });
  }
  return anchors;
}

export default function GraphEditor({
  graph,
  onChange,
}: {
  graph: SizeGraphPoint[];
  onChange: Dispatch<SetStateAction<SizeGraphPoint[]>>;
}) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingPointIndex = useRef<number | null>(null);

  const sortedGraph = useMemo(() => graph.slice().sort((a, b) => a.time - b.time), [graph]);
  const graphPath = useMemo(() => buildSmoothCurvePath(sortedGraph), [sortedGraph]);
  const graphAnchors = useMemo(() => buildCurveAnchors(sortedGraph), [sortedGraph]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const index = draggingPointIndex.current;
      if (index === null) return;
      const coords = graphCoordsFromEvent(e, svgRef.current);
      if (!coords) return;
      onChange(prev => {
        const next = prev.slice().sort((a, b) => a.time - b.time);
        const minTime = index > 0 ? next[index - 1].time + 0.01 : 0;
        const maxTime = index < next.length - 1 ? next[index + 1].time - 0.01 : 1;
        next[index] = {
          time: clamp(coords.time, minTime, maxTime),
          size: clamp(coords.size, 0, 1),
        };
        return next;
      });
    };

    const handlePointerUp = () => {
      draggingPointIndex.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onChange]);

  return (
    <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.2 }}>Size over time</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Click to add anchors</span>
      </div>
      <svg
        ref={svgRef}
        width={GRAPH_WIDTH}
        height={GRAPH_HEIGHT}
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        onClick={e => {
          if ((e.target as SVGElement).tagName.toLowerCase() === 'circle') return;
          const coords = graphCoordsFromEvent(e, svgRef.current);
          if (!coords) return;
          const time = clamp(coords.time, 0.01, 0.99);
          const size = clamp(coords.size, 0, 1);
          const next = [...sortedGraph, { time, size }].sort((a, b) => a.time - b.time);
          onChange(next);
          setSelectedPointIndex(next.findIndex(p => p.time === time && p.size === size));
        }}
        style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', cursor: 'crosshair' }}
      >
        <rect x={0} y={0} width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="transparent" />
        <g stroke="var(--border-mid)" strokeWidth={1} fill="none">
          <line x1={GRAPH_PADDING} y1={GRAPH_PADDING} x2={GRAPH_PADDING} y2={GRAPH_HEIGHT - GRAPH_PADDING} />
          <line x1={GRAPH_PADDING} y1={GRAPH_HEIGHT - GRAPH_PADDING} x2={GRAPH_WIDTH - GRAPH_PADDING} y2={GRAPH_HEIGHT - GRAPH_PADDING} />
        </g>
        {Array.from({ length: 5 }).map((_, index) => {
          const y = GRAPH_PADDING + index * (GRAPH_PLOT_HEIGHT / 4);
          return (
            <g key={`y-tick-${index}`}>
              <line x1={GRAPH_PADDING - 6} y1={y} x2={GRAPH_PADDING} y2={y} stroke="var(--border-mid)" strokeWidth={1} />
              <text x={GRAPH_PADDING - 10} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-secondary)">{`${(1 - index * 0.25).toFixed(2)}`}</text>
            </g>
          );
        })}
        {Array.from({ length: 5 }).map((_, index) => {
          const x = GRAPH_PADDING + index * (GRAPH_PLOT_WIDTH / 4);
          return (
            <g key={`x-tick-${index}`}>
              <line x1={x} y1={GRAPH_HEIGHT - GRAPH_PADDING} x2={x} y2={GRAPH_HEIGHT - GRAPH_PADDING + 6} stroke="var(--border-mid)" strokeWidth={1} />
              <text x={x} y={GRAPH_HEIGHT - GRAPH_PADDING + 18} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">{`${index * 25}%`}</text>
            </g>
          );
        })}
        <path d={graphPath} fill="none" stroke="var(--accent-blue)" strokeWidth={2} />
        {graphAnchors.map((anchor, index) => (
          <circle key={`anchor-${index}`} cx={anchor.x} cy={anchor.y} r={3} fill="rgba(59,130,246,0.3)" />
        ))}
        {sortedGraph.map((point, index) => {
          const svgPoint = graphPointToSvg(point);
          const isSelected = selectedPointIndex === index;
          return (
            <circle
              key={`point-${index}`}
              cx={svgPoint.x}
              cy={svgPoint.y}
              r={isSelected ? 6 : 5}
              fill={index === 0 || index === sortedGraph.length - 1 ? 'var(--accent-blue)' : 'var(--bg)'}
              stroke="var(--accent-blue)"
              strokeWidth={isSelected ? 2 : 1}
              style={{ cursor: index === 0 || index === sortedGraph.length - 1 ? 'default' : 'grab' }}
              onPointerDown={e => {
                e.stopPropagation();
                draggingPointIndex.current = index;
                setSelectedPointIndex(index);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onClick={e => {
                e.stopPropagation();
                setSelectedPointIndex(index);
              }}
            />
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Time runs from 0 to 100% of the duration slider. By default the menu reaches full size at 75% of the animation and stays at 1 through the end.
      </div>
      {selectedPointIndex !== null && (
        <div style={{ display: 'grid', gap: 8, padding: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
            <span>Selected anchor</span>
            <span>{`${Math.round(sortedGraph[selectedPointIndex].time * 100)}% / ${sortedGraph[selectedPointIndex].size.toFixed(2)}`}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ minWidth: 60, fontSize: 11 }}>Size</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(sortedGraph[selectedPointIndex].size * 100)}
              onChange={e => {
                const value = clamp(Number(e.target.value) / 100, 0, 1);
                onChange(prev => {
                  const next = prev.slice().sort((a, b) => a.time - b.time);
                  next[selectedPointIndex] = { ...next[selectedPointIndex], size: value };
                  return next;
                });
              }}
            />
          </div>
          {selectedPointIndex > 0 && selectedPointIndex < sortedGraph.length - 1 && (
            <button
              type="button"
              className="icon-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                onChange(prev => {
                  const next = prev.slice().sort((a, b) => a.time - b.time);
                  next.splice(selectedPointIndex as number, 1);
                  return next;
                });
                setSelectedPointIndex(null);
              }}
            >
              Remove anchor
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            onChange(DEFAULT_TORUS_SIZE_GRAPH);
            setSelectedPointIndex(null);
          }}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Reset graph
        </button>
      </div>
    </div>
  );
}
