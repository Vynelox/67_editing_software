import { useState, useCallback, useEffect, useRef } from 'react';
import MediaPool from './components/MediaPool';
import Viewer from './components/Viewer';
import Timeline from './components/Timeline';
import RollDialog from './components/RollDialog';
import { OpenSettings } from './components/Settings';
import Splitter from './components/Splitter';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  type MediaItem, type TimelineClip, type Track,
  FPS, generateId, secondsToFrames
} from './types';
import { HistoryProvider, useHistory } from './state/history';

const DEFAULT_IMAGE_DURATION = 5 * FPS;

const TRACKS: Track[] = [
  { id: 'v1', type: 'video', label: 'V1' },
  { id: 'a1', type: 'audio', label: 'A1' },
];

function loadMediaDuration(file: File, type: MediaItem['type']): Promise<number> {
  return new Promise(resolve => {
    if (type === 'image') { resolve(DEFAULT_IMAGE_DURATION); return; }
    const el = type === 'video'
      ? document.createElement('video')
      : document.createElement('audio');
    el.preload = 'metadata';
    el.src = URL.createObjectURL(file);
    el.onloadedmetadata = () => resolve(secondsToFrames(el.duration));
    el.onerror = () => resolve(5 * FPS);
  });
}

function generateThumbnail(file: File, type: MediaItem['type']): Promise<string | undefined> {
  return new Promise(resolve => {
    if (type === 'audio') { resolve(undefined); return; }
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => { video.currentTime = 0.5; };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 68;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0, 120, 68);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    video.onerror = () => resolve(undefined);
  });
}

function AppContent() {
  const history = useHistory();
  const [mediaItems, setMediaItems] = useState<Map<string, MediaItem>>(new Map());
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rollClipId, setRollClipId] = useState<string | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // settings (persisted)
  const [playheadTop, setPlayheadTop] = useState<number>(() => {
    try {
      const v = window.localStorage.getItem('juicecut.settings.playheadTopPercent');
      if (v) {
        const n = Number(v);
        if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
      }
      const legacy = window.localStorage.getItem('juicecut.settings.playheadTop');
      if (legacy) {
        const n = Number(legacy);
        if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
      }
    } catch { /* ignore */ }
    return 15;
  });
  const [includeResizeInUndo, setIncludeResizeInUndo] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.includeResizeInUndo'); return v === null ? true : v === 'true'; } catch { return true; }
  });

  // layout (persisted) - moved above snapshot to avoid use-before-declare
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.layout.leftWidth'); return v ? Number(v) : 260; } catch { return 260; }
  });
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem('juicecut.layout.leftCollapsed'); return v === 'true'; } catch { return false; }
  });
  useEffect(() => { try { window.localStorage.setItem('juicecut.layout.leftCollapsed', leftCollapsed ? 'true' : 'false'); } catch {} }, [leftCollapsed]);
  const [savedTimelineHeight, setSavedTimelineHeight] = useState<number | null>(null);
  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.layout.timelineHeight'); return v ? Number(v) : 220; } catch { return 220; }
  });
  const [showStyle, setShowStyle] = useState(false);
  const [stylePage, setStylePage] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportVideo, setExportVideo] = useState(true);
  const [exportAudio, setExportAudio] = useState(true);
  const [exportPath, setExportPath] = useState('');
  useEffect(() => { try { window.localStorage.setItem('juicecut.layout.leftWidth', String(leftWidth)); } catch {} }, [leftWidth]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.layout.timelineHeight', String(timelineHeight)); } catch {} }, [timelineHeight]);

  const totalFrames = clips.reduce((max, c) => Math.max(max, c.endFrame), 0);

  const snapshot = useCallback(() => ({
    clips: JSON.parse(JSON.stringify(clips)),
    mediaItems: Array.from(mediaItems.entries()),
    selectedIds: [...selectedIds],
    playhead,
    settings: { playheadTop, includeResizeInUndo },
    layout: { leftWidth, timelineHeight }
  }), [clips, mediaItems, selectedIds, playhead, playheadTop, includeResizeInUndo, leftWidth, timelineHeight]);

  const restore = useCallback((snap: any) => {
    try {
      setClips(Array.isArray(snap?.clips) ? snap.clips : []);
      setMediaItems(new Map(Array.isArray(snap?.mediaItems) ? snap.mediaItems : []));
      setSelectedIds(Array.isArray(snap?.selectedIds) ? snap.selectedIds : []);
      setPlayhead(typeof snap?.playhead === 'number' ? snap.playhead : 0);
      if (snap?.settings) {
        if (typeof snap.settings.playheadTop === 'number') {
          const v = snap.settings.playheadTop;
          setPlayheadTop(v >= 0 && v <= 100 ? v : 15);
        }
        setIncludeResizeInUndo(typeof snap.settings.includeResizeInUndo === 'boolean' ? snap.settings.includeResizeInUndo : includeResizeInUndo);
      }
      if (snap?.layout) {
        setLeftWidth(typeof snap.layout.leftWidth === 'number' ? snap.layout.leftWidth : leftWidth);
        setTimelineHeight(typeof snap.layout.timelineHeight === 'number' ? snap.layout.timelineHeight : timelineHeight);
      }
    } catch (err) {
      console.warn('Failed to restore snapshot', err);
    }
  }, [setClips, setMediaItems, setSelectedIds, setPlayhead, playheadTop, includeResizeInUndo, leftWidth, timelineHeight]);

  // settings are opened via OpenSettings()

  // layout (persisted)
  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.playheadTopPercent', String(playheadTop)); } catch {}
  }, [playheadTop]);

  // Listen for settings changes from the Settings modal
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === 'playheadTopPercent' && typeof detail.value === 'number') {
        setPlayheadTop(detail.value);
      }
    };
    window.addEventListener('juicecut-settings-changed', handler);
    return () => window.removeEventListener('juicecut-settings-changed', handler);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.includeResizeInUndo', includeResizeInUndo ? 'true' : 'false'); } catch {}
  }, [includeResizeInUndo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // Prevent Ctrl+A from selecting text (except in input fields, handled above)
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        return;
      }
      // Undo: Ctrl+Z (no modifiers)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        history.undo(snapshot(), restore);
      }
      // Redo: Ctrl+Shift+Z, Ctrl+Alt+Z, Ctrl+Y
      if (e.ctrlKey && ((e.shiftKey && e.key.toLowerCase() === 'z') || (e.altKey && e.key.toLowerCase() === 'z') || (e.key.toLowerCase() === 'y' && !e.altKey && !e.shiftKey))) {
        e.preventDefault();
        history.redo(snapshot(), restore);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history, snapshot, restore]);

  useEffect(() => {
    if (playing) {
      playIntervalRef.current = setInterval(() => {
        setPlayhead(p => {
          if (p >= totalFrames) { setPlaying(false); return p; }
          return p + 1;
        });
      }, 1000 / FPS);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [playing, totalFrames]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'd') { e.preventDefault(); setSelectedIds([]); }
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleAddMedia = useCallback(async (files: FileList) => {
    history.push(snapshot());
    const newItems = new Map(mediaItems);
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const isVideo = ['mp4', 'mkv', 'mov', 'webm'].includes(ext);
      const isAudio = ['mp3', 'ogg', 'wav', 'aac'].includes(ext);
      const isImage = ['png', 'jpg', 'jpeg', 'avif', 'gif', 'webp'].includes(ext);
      if (!isVideo && !isAudio && !isImage) continue;
      const type: MediaItem['type'] = isVideo ? 'video' : isAudio ? 'audio' : 'image';
      const src = URL.createObjectURL(file);
      const duration = await loadMediaDuration(file, type);
      const thumbnail = await generateThumbnail(file, type);
      const item: MediaItem = { id: generateId(), name: file.name, type, file, src, duration, thumbnail };
      newItems.set(item.id, item);
    }
    setMediaItems(newItems);
  }, [mediaItems]);

  const handleDropMediaPool = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleAddMedia(e.dataTransfer.files);
  }, [handleAddMedia]);

  const handleDragOverMediaPool = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleRemoveMedia = useCallback((id: string) => {
    history.push(snapshot());
    const newItems = new Map(mediaItems);
    const item = newItems.get(id);
    if (item) URL.revokeObjectURL(item.src);
    newItems.delete(id);
    setMediaItems(newItems);
    setClips(prev => prev.filter(c => c.mediaId !== id));
  }, [mediaItems, history, snapshot]);

  const handleDropMedia = useCallback((mediaId: string, track: number, startFrame: number) => {
    history.push(snapshot());
    const media = mediaItems.get(mediaId);
    if (!media) return;
    const trackObj = TRACKS[track];
    if (!trackObj) return;
    if (trackObj.type === 'video' && media.type === 'audio') return;
    if (trackObj.type === 'audio' && (media.type === 'video' || media.type === 'image')) return;
    const endFrame = startFrame + media.duration;
    const newClip: TimelineClip = {
      id: generateId(), mediaId, track, startFrame, endFrame,
      srcIn: 0, srcOut: media.duration,
      fades: { in: 0, out: 0 },
      name: media.name, type: media.type,
    };
    setClips(prev => [...prev, newClip]);
  }, [mediaItems]);

  const handleSelectClip = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      if (multi) return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      return prev.includes(id) && prev.length === 1 ? prev : [id];
    });
  }, []);

  const handleNudge = useCallback((ids: string[], delta: number) => {
    history.push(snapshot());
    setClips(prev => {
      const movers = new Set(ids);
      return prev.map(clip => {
        if (!movers.has(clip.id)) return clip;
        const newStart = Math.max(0, clip.startFrame + delta);
        const len = clip.endFrame - clip.startFrame;
        const wouldOverlap = prev.some(other =>
          !movers.has(other.id) &&
          other.track === clip.track &&
          newStart < other.endFrame &&
          newStart + len > other.startFrame
        );
        if (wouldOverlap) return clip;
        return { ...clip, startFrame: newStart, endFrame: newStart + len };
      });
    });
  }, [history, snapshot]);

  const handleSplitClip = useCallback((clipId: string, frame: number) => {
    history.push(snapshot());
    setClips(prev => {
      const clip = prev.find(c => c.id === clipId);
      if (!clip || frame <= clip.startFrame || frame >= clip.endFrame) return prev;
      const relFrame = frame - clip.startFrame;
      const part1: TimelineClip = {
        ...clip, endFrame: frame, srcOut: clip.srcIn + relFrame,
        fades: { ...clip.fades, out: 0 },
      };
      const part2: TimelineClip = {
        ...clip, id: generateId(), startFrame: frame,
        srcIn: clip.srcIn + relFrame, fades: { ...clip.fades, in: 0 },
      };
      return prev.map(c => c.id === clipId ? part1 : c).concat(part2);
    });
  }, [history, snapshot]);

  const handleTrimLatter = useCallback((clipId: string, frame: number, ripple: boolean) => {
    history.push(snapshot());
    setClips(prev => {
      const clip = prev.find(c => c.id === clipId);
      if (!clip || frame <= clip.startFrame) return prev;
      const newEnd = frame;
      const gap = clip.endFrame - newEnd;
      return prev.map(c => {
        if (c.id === clipId) return { ...c, endFrame: newEnd, srcOut: c.srcIn + (newEnd - c.startFrame) };
        if (ripple && c.track === clip.track && c.startFrame >= clip.endFrame) {
          return { ...c, startFrame: c.startFrame - gap, endFrame: c.endFrame - gap };
        }
        return c;
      });
    });
  }, [history, snapshot]);

  const handleTrimFormer = useCallback((clipId: string, frame: number, ripple: boolean) => {
    history.push(snapshot());
    setClips(prev => {
      const clip = prev.find(c => c.id === clipId);
      if (!clip || frame >= clip.endFrame) return prev;
      const gap = frame - clip.startFrame;
      return prev.map(c => {
        if (c.id === clipId) return { ...c, startFrame: frame, srcIn: c.srcIn + gap };
        if (ripple && c.track === clip.track && c.startFrame < clip.startFrame) {
          return { ...c, startFrame: Math.max(0, c.startFrame - gap), endFrame: Math.max(0, c.endFrame - gap) };
        }
        return c;
      });
    });
  }, [history, snapshot]);

  const handleJoin = useCallback((clipAId: string, clipBId: string) => {
    history.push(snapshot());
    setClips(prev => {
      const a = prev.find(c => c.id === clipAId);
      const b = prev.find(c => c.id === clipBId);
      if (!a || !b || a.mediaId !== b.mediaId) return prev;
      const merged: TimelineClip = {
        ...a, endFrame: b.endFrame, srcOut: b.srcOut,
        fades: { in: a.fades.in, out: b.fades.out },
      };
      return prev.filter(c => c.id !== clipAId && c.id !== clipBId).concat(merged);
    });
  }, [history, snapshot]);

  const handleFadeChange = useCallback((clipId: string, side: 'in' | 'out', frames: number) => {
    history.push(snapshot());
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const maxFade = Math.floor((c.endFrame - c.startFrame) / 2);
      const clamped = Math.min(Math.max(0, frames), maxFade);
      return { ...c, fades: { ...c.fades, [side]: clamped } };
    }));
  }, [history, snapshot]);

  const handleStepEdge = useCallback((
    clipId: string | null, cutBetween: [string, string] | null,
    direction: number, ripple: boolean
  ) => {
    history.push(snapshot());
    setClips(prev => {
      if (cutBetween) {
        const [aId, bId] = cutBetween;
        return prev.map(c => {
          if (c.id === aId) return { ...c, endFrame: c.endFrame + direction, srcOut: c.srcOut + direction };
          if (!ripple && c.id === bId) return { ...c, startFrame: c.startFrame + direction, srcIn: c.srcIn + direction };
          if (ripple && c.id !== aId) {
            const bClip = prev.find(x => x.id === bId);
            if (bClip && c.track === bClip.track && c.startFrame >= bClip.startFrame) {
              return { ...c, startFrame: c.startFrame + direction, endFrame: c.endFrame + direction };
            }
          }
          return c;
        });
      }
      if (clipId) {
        return prev.map(c => {
          if (c.id !== clipId) return c;
          return { ...c, endFrame: c.endFrame + direction, srcOut: c.srcOut + direction };
        });
      }
      return prev;
    });
  }, [history, snapshot]);

  const handleRollApply = useCallback((clipId: string, newSrcIn: number, newSrcOut: number) => {
    history.push(snapshot());
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, srcIn: newSrcIn, srcOut: newSrcOut } : c));
  }, [history, snapshot]);

  const handleExport = useCallback(async () => {
    const videoClips = clips.filter(c => c.type === 'video' && c.track === 0)
      .sort((a, b) => a.startFrame - b.startFrame);
    if (videoClips.length === 0) { alert('No video clips on track V1 to export.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = 854; canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    const stream = canvas.captureStream(FPS);
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' }); }
    catch { recorder = new MediaRecorder(stream); }
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'export.webm'; a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start();
    let frame = 0;
    const renderFrame = () => {
      if (frame > totalFrames) { recorder.stop(); return; }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 854, 480);
      const videoClip = videoClips.find(c => frame >= c.startFrame && frame < c.endFrame);
      if (videoClip) {
        const media = mediaItems.get(videoClip.mediaId);
        if (media) {
          const videoEl = document.getElementById(`vid-${media.id}`) as HTMLVideoElement | null;
          if (videoEl && videoEl.readyState >= 2) {
            videoEl.currentTime = (frame - videoClip.startFrame + videoClip.srcIn) / FPS;
            let alpha = 1;
            const len = videoClip.endFrame - videoClip.startFrame;
            const rel = frame - videoClip.startFrame;
            if (rel < videoClip.fades.in) alpha = rel / videoClip.fades.in;
            if (rel > len - videoClip.fades.out) alpha = (len - rel) / videoClip.fades.out;
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            const ar = videoEl.videoWidth / videoEl.videoHeight || 16 / 9;
            const cAr = 854 / 480;
            let w = 854, h = 480, x = 0, y = 0;
            if (ar > cAr) { h = 854 / ar; y = (480 - h) / 2; }
            else { w = 480 * ar; x = (854 - w) / 2; }
            ctx.drawImage(videoEl, x, y, w, h); ctx.globalAlpha = 1;
          }
        }
      }
      frame++;
      setTimeout(renderFrame, 1000 / FPS);
    };
    renderFrame();
  }, [clips, mediaItems, totalFrames]);

  const rollClip = rollClipId ? clips.find(c => c.id === rollClipId) ?? null : null;
  const rollMedia = rollClip ? mediaItems.get(rollClip.mediaId) ?? null : null;

  return (
    <div className="app-shell">
      {Array.from(mediaItems.values()).map(item =>
        item.type === 'video' ? (
          <video key={item.id} id={`vid-${item.id}`} src={item.src} style={{ display: 'none' }} preload="auto" muted />
        ) : item.type === 'audio' ? (
          <audio key={item.id} id={`aud-${item.id}`} src={item.src} style={{ display: 'none' }} preload="auto" />
        ) : null
      )}
      <header className="app-header">
        <div className="app-logo">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="1.5" fill="#38bdf8"/>
            <rect x="12" y="2" width="8" height="8" rx="1.5" fill="#34d399"/>
            <rect x="2" y="12" width="8" height="8" rx="1.5" fill="#fb923c"/>
            <rect x="12" y="12" width="8" height="8" rx="1.5" fill="#f472b6"/>
          </svg>
          <span>Juice Cut</span>
        </div>
        <div style={{ marginLeft: 'auto' }} />
        <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setShowStyle(true)} title="Style">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C12 2 5 10 5 15c0 3.866 3.134 7 7 7s7-3.134 7-7c0-5-7-13-7-13z"/>
          </svg>
        </button>
        <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => { try { OpenSettings({ tab: 'misc' }, null); } catch (e) {} }} title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </header>
      <div
        className="workspace"
        style={{
          '--timeline-height': `${timelineHeight}px`,
          '--left-width': `${leftCollapsed ? 36 : leftWidth}px`,
          '--vsplit-width': leftCollapsed ? '0px' : '8px',
        } as React.CSSProperties}
      >
        <div 
          className="workspace-panel-mediapool"
          onDrop={handleDropMediaPool}
          onDragOver={handleDragOverMediaPool}
        >
          <div className="viewer-header">
            <span className="panel-title">Media Pool</span>
          </div>
          {!leftCollapsed && (
            <MediaPool
              items={Array.from(mediaItems.values())}
              selectedMediaId={selectedMediaId}
              onSelect={setSelectedMediaId}
              onAdd={handleAddMedia}
              onRemove={handleRemoveMedia}
            />
          )}
        </div>

        {!leftCollapsed && (
          <div className="workspace-vsplit">
            <Splitter orientation="vertical" onChange={(dx) => {
              setLeftWidth(w => Math.max(120, Math.min(800, w + dx)));
            }} onDragEnd={() => { history.push({ ...snapshot(), __meta: { type: 'resize' } }); }} />
          </div>
        )}

        <div className="workspace-panel-viewer">
          <Viewer
            clips={clips}
            mediaItems={mediaItems}
            playhead={playhead}
            playing={playing}
            totalFrames={totalFrames}
            onPlayPause={() => setPlaying(p => !p)}
            onSeek={setPlayhead}
            onExport={() => setShowExport(true)}
          />
        </div>

        <div className="workspace-hsplit">
          <Splitter orientation="horizontal" thickness={8} onChange={(dy) => {
            setTimelineHeight(h => Math.max(120, Math.min(900, h - dy)));
          }} onDragEnd={() => { history.push({ ...snapshot(), __meta: { type: 'resize' } }); }} />
        </div>

        <Timeline
          clips={clips}
          tracks={TRACKS}
          mediaItems={mediaItems}
          playhead={playhead}
          playheadTop={playheadTop}
          selectedIds={selectedIds}
          onSeek={setPlayhead}
          onDropMedia={handleDropMedia}
          onSelectClip={handleSelectClip}
          onSplitClip={handleSplitClip}
          onTrimLatter={handleTrimLatter}
          onTrimFormer={handleTrimFormer}
          onNudge={handleNudge}
          onJoin={handleJoin}
          onFadeChange={handleFadeChange}
          onRoll={setRollClipId}
          onStepEdge={handleStepEdge}
          totalFrames={totalFrames}
        />
      </div>
      {showExport && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ width: 400 }}>
            <div className="modal-header modal-header--centered">
              <span className="panel-title" style={{ fontSize: 12 }}>Export</span>
              <button className="icon-btn modal-close-btn" onClick={() => setShowExport(false)} aria-label="Close export">✕</button>
            </div>
            <div className="settings-panel-content">
              <label className="settings-checkbox-field" style={{ cursor: 'pointer' }}>
                <span>Export video</span>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={exportVideo}
                  onChange={e => setExportVideo(e.target.checked)}
                />
              </label>
              <label className="settings-checkbox-field" style={{ cursor: 'pointer' }}>
                <span>Export audio</span>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={exportAudio}
                  onChange={e => setExportAudio(e.target.checked)}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  className="settings-number-input"
                  style={{ flex: 1, marginLeft: 0 }}
                  placeholder="Export path..."
                  value={exportPath}
                  onChange={e => setExportPath(e.target.value)}
                />
                <button className="btn-secondary" style={{ whiteSpace: 'nowrap', padding: '4px 12px' }}>Browse</button>
              </div>
              <button className="btn-primary" style={{ alignSelf: 'center', padding: '8px 32px', background: 'var(--input-field)' }}>Export</button>
            </div>
          </div>
        </div>
      )}
      {showStyle && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box settings-modal" style={{ width: 480, height: '72vh', minHeight: '72vh', maxHeight: '72vh', overflow: 'hidden' }}>
            <div className="modal-header modal-header--centered">
              <span className="panel-title" style={{ fontSize: 12 }}>{stylePage ? `Style / ${stylePage}` : 'Style'}</span>
              <button className="icon-btn modal-close-btn" onClick={() => { setShowStyle(false); setStylePage(null); }} aria-label="Close style">✕</button>
            </div>
            {!stylePage && (
              <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
                <button
                  onClick={() => setStylePage('og-dark')}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
                    borderRadius: 'var(--radius-md)', padding: '16px 20px',
                    cursor: 'pointer', color: 'var(--text-primary)',
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-mid)'; }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20z"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>og dark</span>
                </button>
              </div>
            )}
            {stylePage && (
              <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Empty page</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Settings are mounted programmatically via OpenSettings(pageData, scroll) */}
      {rollClip && rollMedia && (
        <RollDialog clip={rollClip} media={rollMedia} onClose={() => setRollClipId(null)} onApply={handleRollApply} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <HistoryProvider>
      <AppContent />
    </HistoryProvider>
  );
}
