import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface SizeGraphPoint {
  time: number;
  size: number;
}

const GRAPH_HEIGHT = 180;
const GRAPH_PADDING = 40; //left padding, THIS AFFECTS CLIPPING
const MIN_TIME_DELTA = 0.01;

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

function getGraphMetrics(graphWidth: number) {
  const plotWidth = Math.max(0, graphWidth - GRAPH_PADDING * 2);
  const plotHeight = Math.max(0, GRAPH_HEIGHT - GRAPH_PADDING * 2);
  return { plotWidth, plotHeight };
}

function graphPointToSvg(point: SizeGraphPoint, graphWidth: number) {
  const { plotWidth, plotHeight } = getGraphMetrics(graphWidth);
  return {
    x: GRAPH_PADDING + point.time * plotWidth,
    y: GRAPH_PADDING + (1 - point.size) * plotHeight,
  };
}

function graphCoordsFromEvent(event: { clientX: number; clientY: number }, svg: SVGSVGElement | null, graphWidth: number) {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const { plotWidth, plotHeight } = getGraphMetrics(graphWidth);
  const x = clamp((event.clientX - rect.left - GRAPH_PADDING) / plotWidth, 0, 1);
  const y = clamp(1 - (event.clientY - rect.top - GRAPH_PADDING) / plotHeight, 0, 1);
  return { time: x, size: y };
}

function buildSmoothCurvePath(points: SizeGraphPoint[], graphWidth: number, easingOffsets: number[] = []) {
   if (points.length === 0) return '';
   const samples = 10;
   let d = ``;
   d += `M ${graphPointToSvg(points[0], graphWidth).x} ${graphPointToSvg(points[0], graphWidth).y}`;
   for (let i = 1; i < points.length; i++) {
     const pointA = points[i - 1];
     const pointB = points[i];
     const svgPointA = graphPointToSvg(pointA, graphWidth);
     const svgPointB = graphPointToSvg(pointB, graphWidth);
     const handlerY = easingOffsets[i - 1] || (svgPointA.y + svgPointB.y) / 2;
     
     const minY = Math.min(svgPointA.y, svgPointB.y);
     const maxY = Math.max(svgPointA.y, svgPointB.y);
     const handlerMinY = (2 * minY + svgPointA.y + svgPointB.y) / 4;
     const handlerMaxY = (2 * maxY + svgPointA.y + svgPointB.y) / 4;
     
     const midpointY = (svgPointA.y + svgPointB.y) / 2;
     let handleValue = 0;
     const range = handlerMaxY - handlerMinY;
     if (range > 0) {
       handleValue = (handlerY - midpointY) * 2 / range;
     }
     handleValue = Math.max(-1, Math.min(1, handleValue));
     
     const strength = 3;
     const { plotWidth, plotHeight } = getGraphMetrics(graphWidth);
     
     for (let s = 0; s <= samples; s++) {
       const t = s / samples;
       let curvedProgress = t;
       if (handleValue < 0) {
         const power = 1 - (handleValue * strength);
         curvedProgress = Math.pow(t, power);
       } else if (handleValue > 0) {
         const power = 1 + (handleValue * strength);
         curvedProgress = 1 - Math.pow(1 - t, power);
       }
       const finalY = pointA.size + (pointB.size - pointA.size) * curvedProgress;
       const finalX = pointA.time + (pointB.time - pointA.time) * t;
       const svgX = GRAPH_PADDING + finalX * plotWidth;
       const svgY = GRAPH_PADDING + (1 - finalY) * plotHeight;
       d += ` L ${svgX} ${svgY}`;
     }
   }
   return d;
}

export default function GraphEditor({
  graph,
  onChange,
  Y_label = 'value',
  X_label = 'time',
  onEasingChange,
}: {
  graph: SizeGraphPoint[];
  onChange: Dispatch<SetStateAction<SizeGraphPoint[]>>;
  Y_label?: string;
  X_label?: string;
  onEasingChange?: (offsets: number[]) => void;
}) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [svgWidth, setSvgWidth] = useState(260);
  const [easingOffsets, setEasingOffsets] = useState<number[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingPointIndex = useRef<number | null>(null);
  const draggingEasingIndex = useRef<number | null>(null);

  const sortedGraph = useMemo(() => graph.slice().sort((a, b) => a.time - b.time), [graph]);
  
  useEffect(() => {
    const initialOffsets = sortedGraph.map((point, index) => {
      if (index < sortedGraph.length - 1) {
        const nextPoint = sortedGraph[index + 1];
        const point1Svg = graphPointToSvg(point, svgWidth);
        const point2Svg = graphPointToSvg(nextPoint, svgWidth);
        const midY = (point1Svg.y + point2Svg.y) / 2;
        const minY = Math.min(point1Svg.y, point2Svg.y);
        const maxY = Math.max(point1Svg.y, point2Svg.y);
        
        // Constrain midpoint to valid range that keeps curve within bounds
        const handlerMinY = (2 * minY + point1Svg.y + point2Svg.y) / 4;
        const handlerMaxY = (2 * maxY + point1Svg.y + point2Svg.y) / 4;
        return clamp(midY, handlerMinY, handlerMaxY);
      }
      return 0;
    });
    setEasingOffsets(initialOffsets);
  }, [sortedGraph.length, svgWidth]);
  
  const graphPath = useMemo(() => buildSmoothCurvePath(sortedGraph, svgWidth, easingOffsets), [sortedGraph, svgWidth, easingOffsets]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const pointIndex = draggingPointIndex.current;
      const easingIndex = draggingEasingIndex.current;
      
      if (pointIndex !== null) {
        const coords = graphCoordsFromEvent(e, svgRef.current, svgWidth);
        if (!coords) return;
        onChange(prev => {
          const next = prev.slice().sort((a, b) => a.time - b.time);
          if (pointIndex === 0 || pointIndex === next.length - 1) {
            next[pointIndex] = {
              ...next[pointIndex],
              size: clamp(coords.size, 0, 1),
            };
            return next;
          }
          const minTime = pointIndex > 0 ? next[pointIndex - 1].time + MIN_TIME_DELTA : 0;
          const maxTime = pointIndex < next.length - 1 ? next[pointIndex + 1].time - MIN_TIME_DELTA : 1;
          if (minTime > maxTime) return next;
          next[pointIndex] = {
            time: clamp(coords.time, minTime, maxTime),
            size: clamp(coords.size, 0, 1),
          };
          return next;
        });
      } else if (easingIndex !== null) {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const desiredY = e.clientY - rect.top;
        
        // Get the two adjacent points to constrain the handler
        const point1 = sortedGraph[easingIndex];
        const point2 = sortedGraph[easingIndex + 1];
        const svgPoint1 = graphPointToSvg(point1, svgWidth);
        const svgPoint2 = graphPointToSvg(point2, svgWidth);
        
        const minY = Math.min(svgPoint1.y, svgPoint2.y);
        const maxY = Math.max(svgPoint1.y, svgPoint2.y);
        
        // To ensure the Bezier curve stays within [minY, maxY], the control point cy must also stay within bounds
        // cy = (4*handlerY - y0 - y1) / 2
        // For cy to be in [minY, maxY]:
        // handlerY must be in [(2*minY + y0 + y1) / 4, (2*maxY + y0 + y1) / 4]
        const handlerMinY = (2 * minY + svgPoint1.y + svgPoint2.y) / 4;
        const handlerMaxY = (2 * maxY + svgPoint1.y + svgPoint2.y) / 4;
        
        const constrainedY = clamp(desiredY, handlerMinY, handlerMaxY);
        
        setEasingOffsets(prev => {
          const next = [...prev];
          next[easingIndex] = constrainedY;
          return next;
        });
      }
    };

    const handlePointerUp = () => {
      draggingPointIndex.current = null;
      draggingEasingIndex.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onChange, svgWidth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const nextWidth = container.clientWidth || 260;
      setSvgWidth(prev => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const plotHeight = GRAPH_HEIGHT - GRAPH_PADDING * 2;
  const plotWidth = Math.max(0, svgWidth - GRAPH_PADDING * 2);

  return (
    <div ref={containerRef} className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, width: '100%', position: 'relative', zIndex: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.2 }}>{Y_label} over {X_label}</span>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={GRAPH_HEIGHT}
        viewBox={`0 0 ${svgWidth} ${GRAPH_HEIGHT}`}
        onPointerDown={e => {
          if ((e.target as SVGElement).tagName.toLowerCase() === 'circle') return;
          const coords = graphCoordsFromEvent(e, svgRef.current, svgWidth);
          if (!coords) return;
          const time = clamp(coords.time, 0.01, 0.99);
          if (sortedGraph.some(p => Math.abs(p.time - time) < MIN_TIME_DELTA)) return;
          const size = clamp(coords.size, 0, 1);
          const next = [...sortedGraph, { time, size }].sort((a, b) => a.time - b.time);
          const newIndex = next.findIndex(p => p.time === time && p.size === size);
          onChange(next);
          setSelectedPointIndex(newIndex);
          draggingPointIndex.current = newIndex;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', cursor: 'crosshair' }}
      >
        <rect x={0} y={0} width={svgWidth} height={GRAPH_HEIGHT} fill="transparent" />
        <g stroke="var(--border-mid)" strokeWidth={1} fill="none">
          <line x1={GRAPH_PADDING} y1={GRAPH_PADDING} x2={GRAPH_PADDING} y2={GRAPH_HEIGHT - GRAPH_PADDING} />
          <line x1={GRAPH_PADDING} y1={GRAPH_HEIGHT - GRAPH_PADDING} x2={svgWidth - GRAPH_PADDING} y2={GRAPH_HEIGHT - GRAPH_PADDING} />
        </g>
        <text x={svgWidth / 2} y={GRAPH_HEIGHT - 10} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">{X_label}</text>
        <text x={GRAPH_PADDING - 15} y={GRAPH_PADDING - 14} textAnchor="start" fontSize={11} fill="var(--text-secondary)">{Y_label}</text>
        <path d={graphPath} fill="none" stroke="var(--accent-blue)" strokeWidth={2} />
        {sortedGraph.map((point, index) => {
          if (index < sortedGraph.length - 1) {
            const nextPoint = sortedGraph[index + 1];
            const midPoint: SizeGraphPoint = {
              time: (point.time + nextPoint.time) / 2,
              size: (point.size + nextPoint.size) / 2,
            };
            const midSvg = graphPointToSvg(midPoint, svgWidth);
            const point1Svg = graphPointToSvg(point, svgWidth);
            const point2Svg = graphPointToSvg(nextPoint, svgWidth);
            
            const minY = Math.min(point1Svg.y, point2Svg.y);
            const maxY = Math.max(point1Svg.y, point2Svg.y);
            // easingOffsets now stores actual Y positions
            const handleY = easingOffsets[index] || midSvg.y;
            
            return (
              <circle
                key={`easing-${index}`}
                cx={midSvg.x}
                cy={handleY}
                r={4}
                fill="var(--accent-pink)"
                stroke="var(--accent-pink)"
                strokeWidth={1}
                style={{ cursor: 'ns-resize', zIndex: 5 }}
                onPointerDown={e => {
                  e.stopPropagation();
                  draggingEasingIndex.current = index;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
              />
            );
          }
          return null;
        })}
        {sortedGraph.map((point, index) => {
          const svgPoint = graphPointToSvg(point, svgWidth);
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
              style={{ cursor: index === 0 || index === sortedGraph.length - 1 ? 'default' : 'grab', zIndex: 10 }}
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
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                if (index === 0 || index === sortedGraph.length - 1) return;
                onChange(prev => {
                  const next = prev.slice().sort((a, b) => a.time - b.time);
                  next.splice(index, 1);
                  return next;
                });
                setSelectedPointIndex(null);
              }}
              onDoubleClick={e => {
                e.preventDefault();
                e.stopPropagation();
                if (index === 0 || index === sortedGraph.length - 1) return;
                onChange(prev => {
                  const next = prev.slice().sort((a, b) => a.time - b.time);
                  next.splice(index, 1);
                  return next;
                });
                setSelectedPointIndex(null);
              }}
            />
          );
        })}
        {Array.from({ length: 5 }).map((_, index) => {
          const y = GRAPH_PADDING + index * (plotHeight / 4);
          return (
            <g key={`y-tick-${index}`}>
              <line x1={GRAPH_PADDING - 6} y1={y} x2={GRAPH_PADDING} y2={y} stroke="var(--border-mid)" strokeWidth={1} />
              <text x={GRAPH_PADDING - 14} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-secondary)">{`${Math.round((1 - index * 0.25) * 100)}%`}</text>
            </g>
          );
        })}
        {Array.from({ length: 5 }).map((_, index) => {
          const x = GRAPH_PADDING + index * (plotWidth / 4);
          return (
            <g key={`x-tick-${index}`}>
              <line x1={x} y1={GRAPH_HEIGHT - GRAPH_PADDING} x2={x} y2={GRAPH_HEIGHT - GRAPH_PADDING + 6} stroke="var(--border-mid)" strokeWidth={1} />
              <text x={x} y={GRAPH_HEIGHT - GRAPH_PADDING + 18} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">{`${index * 25}%`}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
