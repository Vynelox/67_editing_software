import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Film, Music } from 'lucide-react';
import type { TimelineClip, Track, MediaItem } from '../types';
import { FPS, formatTimecode } from '../types';
import TorusMenu from './TorusMenu';
import Waveform from './Waveform';
import ThumbnailRoll from './ThumbnailRoll';

interface Props {
  clips: TimelineClip[];
  tracks: Track[];
  playhead: number;
  selectedIds: string[];
  onSeek: (frame: number) => void;
  onDropMedia: (mediaId: string, track: number, startFrame: number) => void;
  onSelectClip: (id: string, multi: boolean) => void;
  onSplitClip: (clipId: string, frame: number) => void;
  onTrimLatter: (clipId: string, frame: number, ripple: boolean) => void;
  onTrimFormer: (clipId: string, frame: number, ripple: boolean) => void;
  onNudge: (ids: string[], delta: number) => void;
  onJoin: (clipAId: string, clipBId: string) => void;
  onFadeChange: (clipId: string, side: 'in' | 'out', frames: number) => void;
  onRoll: (clipId: string) => void;
  onStepEdge: (clipId: string | null, cutBetween: [string, string] | null, direction: number, ripple: boolean) => void;
  totalFrames: number;
}

const TRACK_H = 64;
const HEADER_H = 32;
const PX_PER_FRAME = 4;
const PLAYHEAD_BTN_H = 16;
const DEFAULT_PLAYHEAD_TOP_PCT = 15;

function playheadTopStyle(percent: number | undefined): string {
  const pct = typeof percent === 'number' ? Math.min(100, Math.max(0, percent)) : DEFAULT_PLAYHEAD_TOP_PCT;
  return `calc((100% - ${PLAYHEAD_BTN_H}px) * ${pct} / 100)`;
}

function frameToX(frame: number, zoom: number) { return frame * PX_PER_FRAME * zoom; }
function xToFrame(x: number, zoom: number) { return Math.round(x / (PX_PER_FRAME * zoom)); }

type TorusTarget =
  | { kind: 'inside'; clipId: string; frame: number }
  | { kind: 'edge'; clipId: string; side: 'start' | 'end'; frame: number }
  | { kind: 'cut'; clipAId: string; clipBId: string; frame: number };

interface PropsWithMedia extends Props {
  mediaItems: Map<string, MediaItem>;
  playheadTop?: number;
}

export default function Timeline({
  clips, tracks, playhead, selectedIds,
  onSeek, onDropMedia, onSelectClip,
  onSplitClip, onTrimLatter, onTrimFormer,
  onNudge, onJoin, onFadeChange, onRoll, onStepEdge,
  totalFrames
  , mediaItems, playheadTop
}: PropsWithMedia) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [torusPos, setTorusPos] = useState<{ x: number; y: number } | null>(null);
  const [torusTarget, setTorusTarget] = useState<TorusTarget | null>(null);
  const [dragState, setDragState] = useState<{
    clipId: string; origStart: number; mouseStartX: number;
  } | null>(null);
  const [fadeState, setFadeState] = useState<{
    clipId: string; side: 'in' | 'out'; origFrames: number; mouseStartX: number;
  } | null>(null);
  const playheadDraggingRef = useRef(false);
  const lastMouseClientX = useRef(0);
  const playheadRef = useRef(playhead);
  useEffect(() => { playheadRef.current = playhead; }, [playhead]);

  // Smooth scrolling state - read directly in handlers for immediate updates
  const getScrollSmoothFactor = () => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollSmooth'); return v ? Number(v) : 50; } catch { return 50; }
  };
  const getScrollAmount = () => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollAmount'); return v ? Number(v) : 100; } catch { return 100; }
  };
  const getScrollZoomAmount = () => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollZoomAmount'); return v ? Number(v) : 25; } catch { return 25; }
  };
  const getScrollZoomSmoothness = () => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollZoomSmoothness'); return v ? Number(v) : 70; } catch { return 70; }
  };
  const getCancelZoomOnScroll = () => {
    try { const v = window.localStorage.getItem('juicecut.settings.cancelZoomOnScroll'); return v === null ? true : v === 'true'; } catch { return true; }
  };
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  // Smooth zoom state
  const zoomTargetRef = useRef<number>(1);
  const zoomRafRef = useRef<number | null>(null);
  const zoomScrollElRef = useRef<HTMLElement | null>(null);
  const zoomMouseXRef = useRef<number>(0);
  const zoomBeforeFrameRef = useRef<number>(0);
  const zoomCurrentRef = useRef<number>(1);
  const zoomAnimatingRef = useRef(false);
  const [zoomAnimTrigger, setZoomAnimTrigger] = useState(0);
  const scrollTargetRef = useRef<number | null>(null);
  const zoomMouseXTargetRef = useRef<number>(0); // for smooth centering: mouseX lerps toward center

  // Keep zoomCurrentRef and zoomTargetRef in sync with zoom state
  useEffect(() => {
    zoomCurrentRef.current = zoom;
    if (!zoomAnimatingRef.current) zoomTargetRef.current = zoom;
  }, [zoom]);

  // After React re-renders from a zoom animation frame, correct scrollLeft to keep the anchor in place.
  // This runs after every render but is gated so it only acts on zoom-animation-triggered renders.
  const pendingScrollCorrection = useRef<{ el: HTMLElement; scrollLeft: number } | null>(null);
  useLayoutEffect(() => {
    if (!pendingScrollCorrection.current) return;
    const { el, scrollLeft } = pendingScrollCorrection.current;
    pendingScrollCorrection.current = null;
    el.scrollLeft = scrollLeft;
  });

  // Start zoom animation when trigger changes
  useEffect(() => {
    if (zoomRafRef.current !== null) return;

    const animateZoom = () => {
      const currentZoom = zoomCurrentRef.current;
      const targetZoom = zoomTargetRef.current;
      const diff = targetZoom - currentZoom;
      const smoothness = getScrollZoomSmoothness();
      const t = smoothness === 0 ? 1 : Math.pow(1 - smoothness / 100, 2) * 0.96 + 0.04;
      const done = Math.abs(diff) < 0.0001;
      const clampedZoom = done ? targetZoom : Math.max(0.25, Math.min(4, currentZoom + diff * t));

      zoomCurrentRef.current = clampedZoom;
      zoomAnimatingRef.current = !done;

      if (zoomScrollElRef.current) {
        const el = zoomScrollElRef.current;
        const centerPlayneedle = (() => { try { const v = window.localStorage.getItem('juicecut.settings.centerPlayneedle'); return v === null ? false : v === 'true'; } catch { return false; } })();

        let targetScrollLeft: number;
        if (centerPlayneedle) {
          // Perfectly centered on playhead — no lerp, no offset, just direct math.
          // The smooth travel to center is handled by lerping mouseX offset separately.
          const centeredScrollLeft = frameToX(zoomBeforeFrameRef.current, clampedZoom) - el.clientWidth / 2;
          // zoomMouseXRef starts at (playheadViewportX - center) offset and lerps to 0
          const scrollSmoothness = getScrollSmoothFactor();
          const st = scrollSmoothness === 0 ? 1 : 0.02 + (1 - scrollSmoothness / 100) * 0.18;
          zoomMouseXRef.current = zoomMouseXRef.current + (0 - zoomMouseXRef.current) * st;
          targetScrollLeft = Math.max(0, centeredScrollLeft - zoomMouseXRef.current);
        } else {
          targetScrollLeft = Math.max(0, frameToX(zoomBeforeFrameRef.current, clampedZoom) - zoomMouseXRef.current);
        }

        pendingScrollCorrection.current = { el, scrollLeft: targetScrollLeft };
      }

      setZoom(clampedZoom);

      if (done) {
        zoomRafRef.current = null;
      } else {
        zoomRafRef.current = requestAnimationFrame(animateZoom);
      }
    };

    if (Math.abs(zoomTargetRef.current - zoomCurrentRef.current) > 0.001) {
      zoomRafRef.current = requestAnimationFrame(animateZoom);
    }
  }, [zoomAnimTrigger]);

  const totalWidth = Math.max(frameToX(totalFrames + 60 * FPS, zoom), 1200);

  const rulerTicks = () => {
    const ticks: Array<{ x: number; label: string }> = [];
    const pxPerSec = PX_PER_FRAME * zoom * FPS;
    const step = pxPerSec < 40 ? 5 : pxPerSec < 80 ? 2 : 1;
    const frames = totalFrames + 60 * FPS;
    for (let s = 0; s * FPS <= frames; s += step) {
      ticks.push({ x: frameToX(s * FPS, zoom), label: formatTimecode(s * FPS) });
    }
    return ticks;
  };

  const getPlayheadContext = useCallback((): TorusTarget => {
    for (const clip of clips) {
      if (Math.abs(playhead - clip.startFrame) <= 1) {
        const adj = clips.find(c => c.track === clip.track && Math.abs(c.endFrame - clip.startFrame) <= 1);
        if (adj) return { kind: 'cut', clipAId: adj.id, clipBId: clip.id, frame: playhead };
        return { kind: 'edge', clipId: clip.id, side: 'start', frame: playhead };
      }
      if (Math.abs(playhead - clip.endFrame) <= 1) {
        const adj = clips.find(c => c.track === clip.track && Math.abs(c.startFrame - clip.endFrame) <= 1);
        if (adj) return { kind: 'cut', clipAId: clip.id, clipBId: adj.id, frame: playhead };
        return { kind: 'edge', clipId: clip.id, side: 'end', frame: playhead };
      }
      if (playhead > clip.startFrame && playhead < clip.endFrame) {
        return { kind: 'inside', clipId: clip.id, frame: playhead };
      }
    }
    return { kind: 'inside', clipId: '', frame: playhead };
  }, [clips, playhead]);

  const handleNeedleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const target = getPlayheadContext();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTorusTarget(target);
    // position in viewport coordinates so menu can be fixed and escape stacking contexts
    const playheadEl = containerRef.current?.querySelector('.tl-playhead') as HTMLElement | null;
    const playheadH = playheadEl?.clientHeight ?? 0;
    const pct = typeof playheadTop === 'number' ? Math.min(100, Math.max(0, playheadTop)) : DEFAULT_PLAYHEAD_TOP_PCT;
    const offset = (pct / 100) * Math.max(0, playheadH - PLAYHEAD_BTN_H);
    setTorusPos({ x: e.clientX, y: rect.top + (HEADER_H - 2) + offset });
  }, [getPlayheadContext, playheadTop]);

  const getJoinPairs = useCallback(() => {
    const pairs: Array<{ clipA: TimelineClip; clipB: TimelineClip }> = [];
    for (const clipA of clips) {
      const clipB = clips.find(c =>
        c.track === clipA.track &&
        c.id !== clipA.id &&
        Math.abs(c.startFrame - clipA.endFrame) <= 1
      );
      if (clipB) {
        const alreadyAdded = pairs.some(p => p.clipA.id === clipB.id || p.clipB.id === clipA.id);
        if (!alreadyAdded) pairs.push({ clipA, clipB });
      }
    }
    return pairs;
  }, [clips]);

  const startClipDrag = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    if (!selectedIds.includes(clipId)) onSelectClip(clipId, e.shiftKey);
    setDragState({ clipId, origStart: clip.startFrame, mouseStartX: e.clientX });
  };

  const startFadeDrag = (e: React.MouseEvent, clipId: string, side: 'in' | 'out') => {
    e.stopPropagation();
    e.preventDefault();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    setFadeState({
      clipId, side,
      origFrames: side === 'in' ? clip.fades.in : clip.fades.out,
      mouseStartX: e.clientX
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMouseClientX.current = e.clientX;
    if (dragState) {
      const dx = e.clientX - dragState.mouseStartX;
      const deltaFrames = xToFrame(dx, zoom);
      const newStart = Math.max(0, dragState.origStart + deltaFrames);
      const el = document.querySelector(`[data-clip-id="${dragState.clipId}"]`) as HTMLElement;
      if (el) el.style.transform = `translateX(${frameToX(newStart - dragState.origStart, zoom)}px)`;
    }
    if (fadeState) {
      const dx = e.clientX - fadeState.mouseStartX;
      const deltaFrames = xToFrame(dx, zoom) * (fadeState.side === 'in' ? 1 : -1);
      const newFrames = Math.max(0, fadeState.origFrames + deltaFrames);
      onFadeChange(fadeState.clipId, fadeState.side, newFrames);
    }
    if (playheadDraggingRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollEl = containerRef.current.querySelector('.tl-scroll') as HTMLElement;
      const scrollX = scrollEl?.scrollLeft ?? 0;
      const x = lastMouseClientX.current - rect.left - 60 + scrollX;
      const frame = Math.max(0, xToFrame(x, zoom));
      onSeek(frame);
    }
  }, [dragState, fadeState, zoom, onFadeChange, onSeek]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragState) {
      const dx = e.clientX - dragState.mouseStartX;
      const deltaFrames = xToFrame(dx, zoom);
      if (deltaFrames !== 0) onNudge([dragState.clipId], deltaFrames);
      const el = document.querySelector(`[data-clip-id="${dragState.clipId}"]`) as HTMLElement;
      if (el) el.style.transform = '';
      setDragState(null);
    }
    if (fadeState) setFadeState(null);
    if (playheadDraggingRef.current) {
      playheadDraggingRef.current = false;
    }
  }, [dragState, fadeState, zoom, onNudge]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Update playhead position on scroll while dragging
  useEffect(() => {
    const scrollEl = containerRef.current?.querySelector('.tl-scroll') as HTMLElement | null;
    if (!scrollEl) return;
    const handleScroll = () => {
      if (playheadDraggingRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollX = scrollEl.scrollLeft;
        const x = lastMouseClientX.current - rect.left - 60 + scrollX;
        const frame = Math.max(0, xToFrame(x, zoom));
        onSeek(frame);
      }
    };
    scrollEl.addEventListener('scroll', handleScroll);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [zoom, onSeek]);

  // Momentum animation loop for smooth scrolling
  useEffect(() => {
    const animate = () => {
      const vel = velocityRef.current;
      if (Math.abs(vel) > 0.5 && scrollElRef.current) {
        scrollElRef.current.scrollLeft += vel;
        // Friction: higher smooth factor = less friction = more momentum
        // Map 0-100 to friction 0.92-0.98
        const scrollSmoothFactor = getScrollSmoothFactor();
        const friction = 0.92 + (scrollSmoothFactor / 100) * 0.06;
        velocityRef.current = vel * friction;
        rafRef.current = requestAnimationFrame(animate);
      } else {
        velocityRef.current = 0;
        rafRef.current = null;
      }
    };

    if (velocityRef.current !== 0 && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const handleWheel = useCallback((_e: React.WheelEvent<HTMLElement>) => {
    // All wheel handling is done in the native listener below
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedIds.length > 0) { e.preventDefault(); onNudge(selectedIds, -1); }
      if (e.key === 'ArrowRight' && selectedIds.length > 0) { e.preventDefault(); onNudge(selectedIds, 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, onNudge]);

  // Single non-passive native wheel listener handles everything so preventDefault is always honoured
  useEffect(() => {
    const scrollEl = containerRef.current?.querySelector('.tl-scroll') as HTMLElement | null;
    if (!scrollEl) return;
    const handler = (e: WheelEvent) => {
      const el = scrollEl;
      scrollElRef.current = el;
      const scrollSmoothFactor = getScrollSmoothFactor();
      const scrollAmount = getScrollAmount();

      if (e.altKey) {
        e.preventDefault();
        velocityRef.current = 0;

        const zoomAmountSetting = getScrollZoomAmount();
        const zoomScale = 1 + zoomAmountSetting / 100;
        const scale = e.deltaY < 0 ? zoomScale : 1 / zoomScale;
        const targetZoom = Math.max(0.25, Math.min(4, zoomTargetRef.current * scale));

        const centerPlayneedle = (() => { try { const v = window.localStorage.getItem('juicecut.settings.centerPlayneedle'); return v === null ? false : v === 'true'; } catch { return false; } })();

        if (!zoomAnimatingRef.current) {
          if (centerPlayneedle) {
            zoomBeforeFrameRef.current = playheadRef.current;
            // zoomMouseXRef = initial offset: positive means playhead is left of center (view needs to scroll right)
            const playheadViewportX = frameToX(playheadRef.current, zoomCurrentRef.current) - el.scrollLeft;
            zoomMouseXRef.current = el.clientWidth / 2 - playheadViewportX;
            zoomMouseXTargetRef.current = 0;
          } else {
            const rect = el.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            zoomBeforeFrameRef.current = xToFrame(el.scrollLeft + mouseX, zoomCurrentRef.current);
            zoomMouseXRef.current = mouseX;
            zoomMouseXTargetRef.current = mouseX;
          }
        }

        zoomTargetRef.current = targetZoom;
        zoomScrollElRef.current = el;
        setZoomAnimTrigger(n => n + 1);
        return;
      }

      // Horizontal pan
      const rawDelta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
      const delta = rawDelta * (scrollAmount / 100);
      if (delta === 0) return;
      e.preventDefault();

      if (zoomAnimatingRef.current) {
        if (getCancelZoomOnScroll()) {
          if (zoomRafRef.current !== null) { cancelAnimationFrame(zoomRafRef.current); zoomRafRef.current = null; }
          pendingScrollCorrection.current = null;
          zoomScrollElRef.current = null;
          scrollTargetRef.current = null;
          zoomCurrentRef.current = zoomTargetRef.current;
          zoomAnimatingRef.current = false;
          setZoom(zoomTargetRef.current);
        } else {
          pendingScrollCorrection.current = null;
          zoomScrollElRef.current = null;
          scrollTargetRef.current = null;
        }
      }

      if (scrollSmoothFactor === 0) {
        el.scrollLeft += delta;
      } else {
        velocityRef.current += delta * 0.5;
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(function animate() {
            const vel = velocityRef.current;
            if (Math.abs(vel) > 0.5 && scrollElRef.current) {
              scrollElRef.current.scrollLeft += vel;
              const friction = 0.92 + (getScrollSmoothFactor() / 100) * 0.06;
              velocityRef.current = vel * friction;
              rafRef.current = requestAnimationFrame(animate);
            } else {
              velocityRef.current = 0;
              rafRef.current = null;
            }
          });
        }
      }
    };
    scrollEl.addEventListener('wheel', handler, { passive: false });
    return () => scrollEl.removeEventListener('wheel', handler);
  }, []);

  // Listen for settings changes to update zoom behavior in real-time
  useEffect(() => {
    const handleSettingsChange = () => {
      // Settings changed - if we have a pending zoom target, restart animation with new smoothness
      if (Math.abs(zoomTargetRef.current - zoom) > 0.001 && zoomRafRef.current === null) {
        // Animation will restart via the zoom dependency in the animation useEffect
      }
    };
    window.addEventListener('juicecut-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('juicecut-settings-changed', handleSettingsChange);
  }, [zoom]);

  const handleTrackDrop = (e: React.DragEvent, trackIdx: number) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('text/plain');
    if (!mediaId) return;
    const scrollEl = containerRef.current?.querySelector('.tl-scroll') as HTMLElement;
    const scrollX = scrollEl?.scrollLeft ?? 0;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const frame = Math.max(0, xToFrame(x, zoom));
    onDropMedia(mediaId, trackIdx, frame);
  };

  const playheadX = frameToX(playhead, zoom);

  const clipColor = (type: string) =>
    type === 'video' ? 'clip-video' : type === 'audio' ? 'clip-audio' : 'clip-image';

  return (
    <div className="timeline" ref={containerRef}>
      <div className="tl-toolbar">
        <span className="panel-title">Timeline</span>
        <div className="zoom-ctrl">
          <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>-</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>+</button>
        </div>
        <span className="timecode">{formatTimecode(playhead)}</span>
      </div>

      <div className="tl-main">
        <div className="tl-labels">
          {tracks.map(tr => (
            <div key={tr.id} className="tl-label" style={{ height: TRACK_H }}>
              {tr.type === 'video' ? <Film size={13} /> : <Music size={13} />}
              <span>{tr.label}</span>
            </div>
          ))}
        </div>

        <div className="tl-scroll" style={{ position: 'relative', overflow: 'auto hidden', flex: 1, height: '100%' }} onWheel={handleWheel}>
          {/* wheel handler attached via prop below for proper typing */}
          <div 
            className="tl-inner" 
            style={{ width: totalWidth, position: 'relative', height: '100%' }}
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              // Ignore clicks on clips, fade handles, join buttons, or the playhead itself
              if (target.closest('.tl-clip') || target.closest('.fade-handle') || target.closest('.join-btn') || target.closest('.tl-playhead')) {
                return;
              }
              e.preventDefault();
              const scrollEl = containerRef.current?.querySelector('.tl-scroll') as HTMLElement;
              const scrollX = scrollEl?.scrollLeft ?? 0;
              const rect = containerRef.current!.getBoundingClientRect();
              const x = e.clientX - rect.left - 60 + scrollX;
              onSeek(Math.max(0, xToFrame(x, zoom)));
              playheadDraggingRef.current = true;
            }}
          >
            <div className="tl-ruler" style={{ height: HEADER_H, width: totalWidth }}>
              {rulerTicks().map((t, i) => (
                <div key={i} className="ruler-tick" style={{ left: t.x }}>
                  <span className="ruler-label">{t.label}</span>
                </div>
              ))}
            </div>

            {/* Grid lines overlay that extends through the tracks area */}
            <div className="tl-grid-overlay" style={{ position: 'absolute', top: HEADER_H, left: 0, width: totalWidth, height: `calc(100% - ${HEADER_H}px)`, pointerEvents: 'none', zIndex: 1 }}>
              {rulerTicks().map((t, i) => (
                <div key={i} className="ruler-tick" style={{ left: t.x }} />
              ))}
            </div>

            <div className="tl-tracks-wrap" style={{ height: `calc(100% - ${HEADER_H}px)` }}>
              {tracks.map((tr, tIdx) => (
                <div
                  key={tr.id}
                  className="tl-track"
                  style={{ height: TRACK_H, width: totalWidth }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={e => handleTrackDrop(e, tIdx)}
                >
                  {clips.filter(c => c.track === tIdx).map(clip => {
                    const x = frameToX(clip.startFrame, zoom);
                    const w = Math.max(frameToX(clip.endFrame - clip.startFrame, zoom), 4);
                    const fadeInW = frameToX(clip.fades.in, zoom);
                    const fadeOutW = frameToX(clip.fades.out, zoom);
                    const isSelected = selectedIds.includes(clip.id);

                    return (
                      <div
                        key={clip.id}
                        data-clip-id={clip.id}
                        className={`tl-clip ${clipColor(clip.type)}${isSelected ? ' selected' : ''}`}
                        style={{ left: x, width: w, height: TRACK_H, top: 0 }}
                        onMouseDown={e => startClipDrag(e, clip.id)}
                        onClick={e => { e.stopPropagation(); onSelectClip(clip.id, e.shiftKey); }}
                      >
                        {fadeInW > 0 && <div className="fade-overlay fade-in" style={{ width: fadeInW }} />}
                        {fadeOutW > 0 && <div className="fade-overlay fade-out" style={{ width: fadeOutW }} />}
                        <div className="clip-inner" style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 22px' }}>
                          <span className="clip-label">{clip.name}</span>
                          <div style={{ flex: 1 }}>
                            {clip.type === 'audio' && (() => {
                              const media = mediaItems.get(clip.mediaId);
                              if (media) return <Waveform src={media.src} width={w} height={TRACK_H - 24} color="#d1fae5" />;
                              return null;
                            })()}
                            {clip.type === 'video' && (() => {
                              const media = mediaItems.get(clip.mediaId);
                              if (media) return <ThumbnailRoll src={media.src} totalWidth={w} height={Math.min(48, TRACK_H - 16)} count={Math.min(8, Math.max(3, Math.floor(w / 80)))} />;
                              return null;
                            })()}
                          </div>
                        </div>
                        <div className="fade-handle fade-handle-l" onMouseDown={e => startFadeDrag(e, clip.id, 'in')} />
                        <div className="fade-handle fade-handle-r" onMouseDown={e => startFadeDrag(e, clip.id, 'out')} />
                      </div>
                    );
                  })}

                  {getJoinPairs()
                    .filter(p => clips.find(c => c.id === p.clipA.id)?.track === tIdx)
                    .map(({ clipA, clipB }) => (
                      <button
                        key={`join-${clipA.id}-${clipB.id}`}
                        className="join-btn"
                        style={{ left: frameToX(clipA.endFrame, zoom) - 16, top: TRACK_H / 2 - 10 }}
                        onClick={e => { e.stopPropagation(); onJoin(clipA.id, clipB.id); }}
                        title="Join clips"
                      >
                        J
                      </button>
                    ))
                  }
                </div>
              ))}
            </div>

            <div
              className="tl-playhead"
              style={{ left: playheadX, top: 0, height: '100%' }}
            >
              <button
                className="playhead-btn"
                style={{ top: playheadTopStyle(playheadTop) }}
                onMouseDown={(e) => { e.preventDefault(); playheadDraggingRef.current = true; }}
                onClick={handleNeedleClick}
                title="Click for edit options"
              />
              <div className="playhead-line" />
            </div>
          </div>
        </div>
      </div>

      {torusTarget && torusPos && (
        <TorusMenu
          pos={torusPos}
          target={torusTarget}
          onClose={() => { setTorusTarget(null); setTorusPos(null); }}
          onSplit={() => { if (torusTarget.kind === 'inside') onSplitClip(torusTarget.clipId, torusTarget.frame); setTorusTarget(null); setTorusPos(null); }}
          onTrimLatter={(ripple) => { if (torusTarget.kind === 'inside') onTrimLatter(torusTarget.clipId, torusTarget.frame, ripple); setTorusTarget(null); setTorusPos(null); }}
          onTrimFormer={(ripple) => { if (torusTarget.kind === 'inside') onTrimFormer(torusTarget.clipId, torusTarget.frame, ripple); setTorusTarget(null); setTorusPos(null); }}
          onStep={(dir, ripple) => { onStepEdge(torusTarget.kind === 'edge' ? torusTarget.clipId : null, torusTarget.kind === 'cut' ? [torusTarget.clipAId, torusTarget.clipBId] : null, dir, ripple); setTorusTarget(null); setTorusPos(null); }}
          onRoll={() => { if (torusTarget.kind === 'inside') onRoll(torusTarget.clipId); setTorusTarget(null); setTorusPos(null); }}
        />
      )}
    </div>
  );
}
