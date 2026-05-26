import { useEffect, useRef, useCallback } from 'react';
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
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoClips = clips
      .filter(c => (c.type === 'video' || c.type === 'image') && c.track === 0)
      .filter(c => playhead >= c.startFrame && playhead < c.endFrame)
      .sort((a, b) => a.startFrame - b.startFrame);

    if (videoClips.length === 0) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#444';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No video at playhead', canvas.width / 2, canvas.height / 2);
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
      ctx.fillStyle = '#0a0a0a';
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

  const progress = totalFrames > 0 ? (playhead / totalFrames) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.round(ratio * totalFrames));
  };

  return (
    <div className="viewer">
      <div className="viewer-header">
        <span className="panel-title">Viewer</span>
        <span className="timecode">{formatTimecode(playhead)}</span>
        <button className="export-btn" onClick={onExport}>Export MP4</button>
      </div>
      <div className="viewer-canvas-wrap">
        <canvas ref={canvasRef} width={854} height={480} className="viewer-canvas" />
      </div>
      <div className="viewer-controls">
        <button className="ctrl-btn" onClick={() => onSeek(0)} title="Go to start">
          <SkipBack size={16} />
        </button>
        <button className="ctrl-btn play-btn" onClick={onPlayPause} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="ctrl-btn" onClick={() => onSeek(totalFrames)} title="Go to end">
          <SkipForward size={16} />
        </button>
        <div className="scrub-bar" onClick={handleScrub}>
          <div className="scrub-progress" style={{ width: `${progress}%` }} />
          <div className="scrub-thumb" style={{ left: `${progress}%` }} />
        </div>
        <Volume2 size={14} className="text-gray-500" />
      </div>
    </div>
  );
}
