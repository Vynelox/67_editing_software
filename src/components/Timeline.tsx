import { useRef, useState, useCallback, useEffect } from 'react';
import { Film, Music } from 'lucide-react';
import type { TimelineClip, Track, MediaItem } from '../types';
import { FPS, formatTimecode } from '../types';
import TorusMenu from './TorusMenu';
import Waveform from './Waveform';

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

function frameToX(frame: number, zoom: number) { return frame * PX_PER_FRAME * zoom; }
function xToFrame(x: number, zoom: number) { return Math.round(x / (PX_PER_FRAME * zoom)); }

type TorusTarget =
  | { kind: 'inside'; clipId: string; frame: number }
  | { kind: 'edge'; clipId: string; side: 'start' | 'end'; frame: number }
  | { kind: 'cut'; clipAId: string; clipBId: string; frame: number };

interface PropsWithMedia extends Props {
  mediaItems: Map<string, MediaItem>;
}

export default function Timeline({
  clips, tracks, playhead, selectedIds,
  onSeek, onDropMedia, onSelectClip,
  onSplitClip, onTrimLatter, onTrimFormer,
  onNudge, onJoin, onFadeChange, onRoll, onStepEdge,
  totalFrames
  , mediaItems
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
  const [playheadDragging, setPlayheadDragging] = useState(false);

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
    setTorusPos({ x: e.clientX - rect.left, y: HEADER_H - 2 });
  }, [getPlayheadContext]);

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
    if (playheadDragging && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollEl = containerRef.current.querySelector('.tl-scroll') as HTMLElement;
      const scrollX = scrollEl?.scrollLeft ?? 0;
      const x = e.clientX - rect.left - 60 + scrollX;
      const frame = Math.max(0, xToFrame(x, zoom));
      onSeek(frame);
    }
  }, [dragState, fadeState, playheadDragging, zoom, onFadeChange, onSeek]);

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
    if (playheadDragging) setPlayheadDragging(false);
  }, [dragState, fadeState, playheadDragging, zoom, onNudge]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedIds.length > 0) { e.preventDefault(); onNudge(selectedIds, -1); }
      if (e.key === 'ArrowRight' && selectedIds.length > 0) { e.preventDefault(); onNudge(selectedIds, 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, onNudge]);

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
          <div style={{ height: HEADER_H }} />
          {tracks.map(tr => (
            <div key={tr.id} className="tl-label" style={{ height: TRACK_H }}>
              {tr.type === 'video' ? <Film size={13} /> : <Music size={13} />}
              <span>{tr.label}</span>
            </div>
          ))}
        </div>

        <div className="tl-scroll" style={{ position: 'relative', overflow: 'auto', flex: 1 }}>
          <div style={{ width: totalWidth, position: 'relative' }}>
            <div className="tl-ruler" style={{ height: HEADER_H, width: totalWidth }}>
              {rulerTicks().map((t, i) => (
                <div key={i} className="ruler-tick" style={{ left: t.x }}>
                  <span className="ruler-label">{t.label}</span>
                </div>
              ))}
            </div>

            {tracks.map((tr, tIdx) => (
              <div
                key={tr.id}
                className="tl-track"
                style={{ height: TRACK_H, width: totalWidth }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={e => handleTrackDrop(e, tIdx)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).classList.contains('tl-track')) {
                    const scrollEl = containerRef.current?.querySelector('.tl-scroll') as HTMLElement;
                    const scrollX = scrollEl?.scrollLeft ?? 0;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const x = e.clientX - rect.left + scrollX;
                    onSeek(xToFrame(x, zoom));
                  }
                }}
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
                      style={{ left: x, width: w, height: TRACK_H - 8, top: 4 }}
                      onMouseDown={e => startClipDrag(e, clip.id)}
                      onClick={e => { e.stopPropagation(); onSelectClip(clip.id, e.shiftKey); }}
                    >
                      {fadeInW > 0 && <div className="fade-overlay fade-in" style={{ width: fadeInW }} />}
                      {fadeOutW > 0 && <div className="fade-overlay fade-out" style={{ width: fadeOutW }} />}
                      <span className="clip-label">{clip.name}</span>
                      {clip.type === 'audio' && (() => {
                        const media = mediaItems.get(clip.mediaId);
                        if (media) return <Waveform src={media.src} width={w} height={TRACK_H - 24} color="#d1fae5" />;
                        return null;
                      })()}
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

            <div
              className="tl-playhead"
              style={{ left: playheadX, top: 0, height: HEADER_H + tracks.length * TRACK_H }}
            >
              <button
                className="playhead-btn"
                onMouseDown={() => setPlayheadDragging(true)}
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
