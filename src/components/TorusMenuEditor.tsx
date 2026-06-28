import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import DraggableModal from './DraggableModal';
import TorusMenu from './TorusMenu';
import { Slider } from './Adjustables';
import { RotateCcw } from 'lucide-react';

interface SizeGraphPoint {
  time: number;
  size: number;
}

const GRAPH_WIDTH = 260;
const GRAPH_HEIGHT = 180;
const GRAPH_PADDING = 20;
const GRAPH_PLOT_WIDTH = GRAPH_WIDTH - GRAPH_PADDING * 2;
const GRAPH_PLOT_HEIGHT = GRAPH_HEIGHT - GRAPH_PADDING * 2;

const DEFAULT_TORUS_SIZE_GRAPH: SizeGraphPoint[] = [
  { time: 0, size: 0 },
  { time: 0.75, size: 1 },
  { time: 1, size: 1 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getSavedSizeGraph(): SizeGraphPoint[] {
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

// Logarithmic mapping for delay slider: slider 0..1000 → delay -1000..1000
// Slider 0 = -1000ms, slider 500 = 0ms, slider 1000 = 1000ms
// Both halves use log scale for magnitude
function sliderToDelay(slider: number): number {
  if (slider === 500) return 0;
  if (slider < 500) {
    // Left half: slider 0 → -1000, slider 499 → ~-1
    const t = (500 - slider) / 500; // 1 → 0 as slider goes 0 → 500
    const logVal = Math.pow(10, t * 3); // 1000 → 1
    return -Math.round(logVal);
  } else {
    // Right half: slider 501 → ~1, slider 1000 → 1000
    const t = (slider - 500) / 500;
    const logVal = Math.pow(10, t * 3); // 1 → 1000
    return Math.round(logVal);
  }
}

function delayToSlider(delay: number): number {
  if (delay === 0) return 500;
  if (delay < 0) {
    // Map -1000..-1 to slider 0..499
    const absVal = Math.max(1, Math.abs(delay));
    const t = Math.log10(absVal) / 3; // 0..1
    return Math.round(500 - t * 500); // 500..0
  } else {
    // Map 1..1000 to slider 501..1000
    const t = Math.log10(Math.max(1, delay)) / 3;
    return Math.round(500 + t * 500);
  }
}

export function OpenTorusMenuEditor(onCloseCallback?: () => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const closeAndReturnToSettings = () => {
    try { root.unmount(); } catch (e) {}
    if (container.parentNode) container.parentNode.removeChild(container);
    (window as any).__popClose?.();
    if (onCloseCallback) onCloseCallback();
  };
  const closeDirectly = () => {
    try { root.unmount(); } catch (e) {}
    if (container.parentNode) container.parentNode.removeChild(container);
    (window as any).__popClose?.();
  };
  (window as any).__pushClose?.(closeDirectly);
  root.render(<TorusMenuEditorModal onClose={closeDirectly} onBack={closeAndReturnToSettings} />);
  return closeDirectly;
}

export interface TorusMenuEditorModalProps {
  onClose: () => void;
  onBack: () => void;
}

export default function TorusMenuEditorModal({ onClose, onBack }: TorusMenuEditorModalProps) {
  const [torusOpen, setTorusOpen] = useState(false);
  const [duration, setDuration] = useState(getSavedDuration);
  const [sizeGraph, setSizeGraph] = useState<SizeGraphPoint[]>(getSavedSizeGraph);
  const [delay, setDelay] = useState(getSavedDelay);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const graphRef = useRef<SVGSVGElement | null>(null);
  const draggingPointIndex = useRef<number | null>(null);

  const sortedSizeGraph = useMemo(() => sizeGraph.slice().sort((a, b) => a.time - b.time), [sizeGraph]);
  const graphPath = useMemo(() => buildSmoothCurvePath(sortedSizeGraph), [sortedSizeGraph]);
  const graphAnchors = useMemo(() => buildCurveAnchors(sortedSizeGraph), [sortedSizeGraph]);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.torusDuration', String(duration)); } catch {}
  }, [duration]);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.torusSizeGraph', JSON.stringify(sortedSizeGraph)); } catch {}
  }, [sortedSizeGraph]);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.torusDelay', String(delay)); } catch {}
  }, [delay]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const index = draggingPointIndex.current;
      if (index === null) return;
      const coords = graphCoordsFromEvent(e, graphRef.current);
      if (!coords) return;
      setSizeGraph(prev => {
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
  }, []);

  const handleCloseTorus = useCallback(() => {
    setTorusOpen(false);
  }, []);

  const noop = useCallback(() => {}, []);
  const noopBool = useCallback((_ripple: boolean) => {}, []);
  const noopNumBool = useCallback((_dir: number, _ripple: boolean) => {}, []);
  const dummyTarget = { kind: 'inside' as const, clipId: '__preview__', frame: 0 };

  // Delay slider uses logarithmic mapping
  const delaySliderValue = delayToSlider(delay);

  return (
    <DraggableModal
      title="Torus Menu Editor"
      onClose={onClose}
      headerLeft={
        <button
          className="icon-btn"
          onClick={onBack} 
          style={
            {
              position: 'absolute', 
              left: 8, 
              top: '50%', 
              transform: 'translateY(-50%)', 
              width: 26, 
              height: 26, 
              color: 'var(--text-secondary)',

            }
          }
          title="Back"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
      }
      style={{ width: 620, minHeight: 0 }}
      body={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 12px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, width: 260 }}>
              <Slider
                label="Duration"
                value={duration}
                min={0}
                max={2000}
                step={10}
                onChange={setDuration}
                onReset={() => setDuration(300)}
                formatValue={v => `${v}ms`}
              />
              <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Size over time</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Click to add anchors</span>
                </div>
                <svg
                  ref={graphRef}
                  width={GRAPH_WIDTH}
                  height={GRAPH_HEIGHT}
                  viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                  onClick={e => {
                    if ((e.target as SVGElement).tagName.toLowerCase() === 'circle') return;
                    const coords = graphCoordsFromEvent(e, graphRef.current);
                    if (!coords) return;
                    const time = clamp(coords.time, 0.01, 0.99);
                    const size = clamp(coords.size, 0, 1);
                    const next = [...sortedSizeGraph, { time, size }].sort((a, b) => a.time - b.time);
                    setSizeGraph(next);
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
                  {sortedSizeGraph.map((point, index) => {
                    const svgPoint = graphPointToSvg(point);
                    const isSelected = selectedPointIndex === index;
                    return (
                      <circle
                        key={`point-${index}`}
                        cx={svgPoint.x}
                        cy={svgPoint.y}
                        r={isSelected ? 6 : 5}
                        fill={index === 0 || index === sortedSizeGraph.length - 1 ? 'var(--accent-blue)' : 'var(--bg)'}
                        stroke="var(--accent-blue)"
                        strokeWidth={isSelected ? 2 : 1}
                        style={{ cursor: index === 0 || index === sortedSizeGraph.length - 1 ? 'default' : 'grab' }}
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
                      <span>{`${Math.round(sortedSizeGraph[selectedPointIndex].time * 100)}% / ${sortedSizeGraph[selectedPointIndex].size.toFixed(2)}`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 60, fontSize: 11 }}>Size</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(sortedSizeGraph[selectedPointIndex].size * 100)}
                        onChange={e => {
                          const value = clamp(Number(e.target.value) / 100, 0, 1);
                          setSizeGraph(prev => {
                            const next = prev.slice().sort((a, b) => a.time - b.time);
                            next[selectedPointIndex] = { ...next[selectedPointIndex], size: value };
                            return next;
                          });
                        }}
                      />
                    </div>
                    {selectedPointIndex > 0 && selectedPointIndex < sortedSizeGraph.length - 1 && (
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                          setSizeGraph(prev => {
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
                      setSizeGraph(DEFAULT_TORUS_SIZE_GRAPH);
                      setSelectedPointIndex(null);
                    }}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Reset graph
                  </button>
                </div>
              </div>
              <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Delay</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{delay}ms</span>
                    <button type="button" className="icon-btn" onClick={() => setDelay(0)} title="Reset to default" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                  </div>
                </div>
                <input
                  type="range"
                  className="settings-range-input"
                  min={0}
                  max={1000}
                  step={1}
                  value={delaySliderValue}
                  onChange={e => setDelay(sliderToDelay(Number(e.target.value)))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>-1000ms</span>
                  <span style={{ color: 'var(--text-muted)' }}>0ms</span>
                  <span>1000ms</span>
                </div>
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: 260,
                height: 260,
              }}
            >
              {torusOpen && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 5,
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                  }}>
                    <TorusMenu
                      interactive
                      pos={{ x: 0, y: 0 }}
                      target={dummyTarget}
                      onClose={handleCloseTorus}
                      onSplit={noop}
                      onTrimLatter={noopBool}
                      onTrimFormer={noopBool}
                      onStep={noopNumBool}
                      onRoll={noop}
                      showCloseButton
                      duration={duration}
                      sizeGraph={sortedSizeGraph}
                      delay={delay}
                      closeOnBackgroundClick={false}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                className="torus-toggle-btn"
                onClick={() => setTorusOpen(o => !o)}
                title="Toggle torus menu"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1px solid var(--border-mid)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3000,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                •••
              </button>
            </div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            Torus Menu Editor
          </div>
        </div>
      }
    />
  );
}