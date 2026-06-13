import { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import type { MediaItem, TimelineClip } from '../types';
import { formatTimecode, FPS } from '../types';

interface Props {
  clips: TimelineClip[];
  mediaItems: Map<string, MediaItem>;
  playhead: number;
  playing: boolean;
  totalFrames: number;
  onPlayPause: () => void;
  onSeek: (frame: number) => void;
  onExport: () => void;
}

export default function Viewer({
  clips, mediaItems, playhead, playing, totalFrames,
  onPlayPause, onSeek, onExport
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--video-bg').trim() || '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoClips = clips
      .filter(c => (c.type === 'video' || c.type === 'image') && c.track === 0)
      .filter(c => playhead >= c.startFrame && playhead < c.endFrame)
      .sort((a, b) => a.startFrame - b.startFrame);

    if (videoClips.length === 0) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--video-bg').trim() || '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const clip = videoClips[0];
    const media = mediaItems.get(clip.mediaId);
    if (!media) return;

    if (media.type === 'image') {
      const img = new window.Image();
      img.src = media.src;
      if (img.complete) {
        const ar = img.naturalWidth / img.naturalHeight;
        const cAr = canvas.width / canvas.height;
        let w = canvas.width, h = canvas.height, x = 0, y = 0;
        if (ar > cAr) { h = canvas.width / ar; y = (canvas.height - h) / 2; }
        else { w = canvas.height * ar; x = (canvas.width - w) / 2; }
        ctx.drawImage(img, x, y, w, h);
      }
    }
  }, [clips, mediaItems, playhead]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const videoClip = clips
      .filter(c => c.type === 'video' && c.track === 0 && playhead >= c.startFrame && playhead < c.endFrame)[0];

    if (!videoClip) { drawFrame(); return; }

    const media = mediaItems.get(videoClip.mediaId);
    if (!media) return;

    const videoEl = document.getElementById(`vid-${media.id}`) as HTMLVideoElement | null;
    if (!videoEl) return;

    const relativeFrame = playhead - videoClip.startFrame + videoClip.srcIn;
    const targetTime = relativeFrame / FPS;
    if (Math.abs(videoEl.currentTime - targetTime) > 0.05) {
      videoEl.currentTime = targetTime;
    }

    let alpha = 1;
    const clipLen = videoClip.endFrame - videoClip.startFrame;
    const relPos = playhead - videoClip.startFrame;
    if (relPos < videoClip.fades.in) alpha = relPos / videoClip.fades.in;
    if (relPos > clipLen - videoClip.fades.out) alpha = (clipLen - relPos) / videoClip.fades.out;
    alpha = Math.max(0, Math.min(1, alpha));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--video-bg').trim() || '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = alpha;
      const ar = videoEl.videoWidth / videoEl.videoHeight || 16 / 9;
      const cAr = canvas.width / canvas.height;
      let w = canvas.width, h = canvas.height, x = 0, y = 0;
      if (ar > cAr) { h = canvas.width / ar; y = (canvas.height - h) / 2; }
      else { w = canvas.height * ar; x = (canvas.width - w) / 2; }
      ctx.drawImage(videoEl, x, y, w, h);
      ctx.globalAlpha = 1;
    };

    if (videoEl.readyState >= 2) draw();
    else videoEl.addEventListener('loadeddata', draw, { once: true });
  }, [playhead, clips, mediaItems, drawFrame]);

  // Redraw when --video-bg CSS variable changes (e.g. from color picker)
  useEffect(() => {
    const observer = new MutationObserver(() => drawFrame());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [drawFrame]);

  const progress = totalFrames > 0 ? (playhead / totalFrames) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.round(ratio * totalFrames));
  };

  const [controlsType, setControlsType] = useState<string>(() => {
    try { return window.localStorage.getItem('juicecut.settings.viewerControlsType') || 'compact'; } catch { return 'compact'; }
  });
  const [timecodePanel, setTimecodePanel] = useState<string>(() => {
    try { return window.localStorage.getItem('juicecut.settings.timecodePanel') || 'both'; } catch { return 'both'; }
  });

  useEffect(() => {
    const handler = () => {
      try { setControlsType(window.localStorage.getItem('juicecut.settings.viewerControlsType') || 'compact'); } catch {}
    };
    window.addEventListener('juicecut-settings-changed', handler);
    return () => window.removeEventListener('juicecut-settings-changed', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      try { setTimecodePanel(window.localStorage.getItem('juicecut.settings.timecodePanel') || 'both'); } catch {}
    };
    window.addEventListener('juicecut-settings-changed', handler);
    return () => window.removeEventListener('juicecut-settings-changed', handler);
  }, []);

  const scrubBar = (height: number) => (
    <div onClick={handleScrub} style={{ flex:1, position:'relative', height, borderRadius:2, background:'var(--border-mid)', cursor:'pointer' }}>
      <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${progress}%`, background:'var(--input-field)', borderRadius:2 }} />
      <div style={{ position:'absolute', top:'50%', left:`${progress}%`, transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%', background:'var(--text-primary)', boxShadow:'0 0 0 2px var(--bg-panel)', pointerEvents:'none' }} />
    </div>
  );

  const skipBtn = (onClick: () => void, title: string, icon: React.ReactNode, size: number) => (
    <button onClick={onClick} title={title}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:size, height:size, borderRadius:4, background:'transparent', border:'none', color:'var(--text-secondary)', cursor:'pointer', flexShrink:0 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color='var(--text-primary)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--text-secondary)'; }}
    >{icon}</button>
  );

  return (
    <div className="viewer">
      <div className="viewer-header">
        <span className="panel-title">Viewer</span>
        <div style={{ marginLeft: 'auto' }} />
        <button className="icon-btn" onClick={onExport} title="Export project" style={{ width: 30, height: 30 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
      <div className="viewer-canvas-wrap">
        <canvas ref={canvasRef} width={854} height={480} className="viewer-canvas" />
      </div>

      {controlsType === 'compact' ? (
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 10px', height:32, background:'var(--bg-panel)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          {skipBtn(() => onSeek(0), 'Go to start', <SkipBack size={12} />, 22)}
          <button onClick={onPlayPause} title={playing ? 'Pause' : 'Play'}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:6, background:'var(--input-field)', border:'1px solid var(--border-mid)', color:'var(--text-primary)', cursor:'pointer', flexShrink:0, transition:'filter 0.12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter='brightness(1.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter='none'; }}
          >{playing ? <Pause size={13} /> : <Play size={13} />}</button>
          {skipBtn(() => onSeek(totalFrames), 'Go to end', <SkipForward size={12} />, 22)}
          {scrubBar(3)}
          {timecodePanel === 'viewer' || timecodePanel === 'both' ? (
            <span style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-muted)', letterSpacing:1, flexShrink:0 }}>{formatTimecode(playhead)}</span>
          ) : null}
          <Volume2 size={12} style={{ color:'var(--text-muted)', flexShrink:0 }} />
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'8px 14px 10px', background:'var(--bg-panel)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          {scrubBar(4)}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {timecodePanel === 'viewer' || timecodePanel === 'both' ? (
              <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-muted)', letterSpacing:1, minWidth:64 }}>{formatTimecode(playhead)}</span>
            ) : (
              <span style={{ minWidth:64 }} />
            )}
            <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', gap:2 }}>
              {skipBtn(() => onSeek(0), 'Go to start', <SkipBack size={14} />, 28)}
              <button onClick={onPlayPause} title={playing ? 'Pause' : 'Play'}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:10, background:'var(--input-field)', border:'1px solid var(--border-mid)', color:'var(--text-primary)', cursor:'pointer', transition:'filter 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter='brightness(1.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter='none'; }}
              >{playing ? <Pause size={16} /> : <Play size={16} />}</button>
              {skipBtn(() => onSeek(totalFrames), 'Go to end', <SkipForward size={14} />, 28)}
            </div>
            <div style={{ minWidth:64, display:'flex', justifyContent:'flex-end' }}>
              <Volume2 size={14} style={{ color:'var(--text-muted)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
