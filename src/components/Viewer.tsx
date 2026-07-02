import { useEffect, useRef, useCallback } from 'react';
import type { MediaItem, TimelineClip } from '../types';
import { FPS } from '../types';

interface Props {
  clips: TimelineClip[];
  mediaItems: Map<string, MediaItem>;
  playhead: number;
  playing: boolean;
  totalFrames: number;
  onExport: () => void;
}

export default function Viewer({
  clips, mediaItems, playhead, playing, totalFrames,
  onExport
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const videoClips = clips
      .filter(c => (c.type === 'video' || c.type === 'image') && c.track === 0)
      .filter(c => playhead >= c.startFrame && playhead < c.endFrame)
      .sort((a, b) => a.startFrame - b.startFrame);

    if (videoClips.length === 0) {
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

  return (
    <div className="viewer">
      <div className="viewer-header">
        <span className="panel-title">Viewer</span>
        <div style={{ marginLeft: 'auto' }} />
        <button className="icon-btn" onClick={onExport} title="Export project">
          <svg viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em">
            <path fill="currentColor" d="M348 536L877 536L877 619C877 632.505 878.115 646.557 876.83 660C874.527 684.103 862.746 706.163 844 721.536C833.131 730.448 819.83 736.932 806 739.54C791.972 742.186 777.838 739.246 767.184 751.015C753.565 766.062 759.591 794.954 781 799.61C795.35 802.73 813.127 799.235 827 795.424C869.163 783.839 904.379 754.993 922.691 715C939.604 678.062 936 637.568 936 598L936 493C936 471.132 937.416 448.721 934.714 427C930.192 390.659 910.252 356.239 882 333.261C860.363 315.662 833.653 304.693 806 301.286C784.276 298.61 761.868 300 740 300L492 300C465.582 300 438.139 297.862 412 302.145C375.852 308.068 342.215 328.208 319.668 357C280.272 407.307 289 472.195 289 532L289 617C289 631.491 287.797 646.575 289.17 661C290.423 674.166 292.152 687.393 296.355 700C309.726 740.107 340.12 772.688 379 789.124C397.983 797.149 421.255 802.55 442 799.812C452.667 798.404 463.827 787.869 464.895 777C465.299 772.887 465.386 768.076 464.671 764C464.116 760.834 462.767 757.696 461.031 755C449.576 737.214 430.034 743.8 413 738.329C392.81 731.845 375.08 719.667 363.029 702C347.403 679.095 348 653.479 348 627L348 536z"/>
            <path fill="none" d="M479 359C484.145 370.032 497.434 379.434 506 388L565 447L585 467C588.212 470.212 591.615 474.78 596 476.397C599.577 477.715 604.249 477 608 477L633 477L717 477C711.002 466.526 698.547 457.547 690 449L632 391L610 369C606.788 365.788 603.385 361.22 599 359.603C595.423 358.285 590.751 359 587 359L562 359L479 359M685 359C690.145 370.032 703.434 379.434 712 388L770 446L791 467C793.995 469.996 797.292 474.727 801.286 476.397C807.334 478.925 817.495 477 824 477L877 477C877 459.036 878.67 440.419 873.576 423C865.017 393.735 841.579 370.241 812 362.289C795.551 357.867 777.869 359 761 359L685 359M348 477L511 477C506.413 467.666 495.706 460.757 488.656 453.255C469.067 432.411 447.829 413.118 427.989 392.525C421.788 386.089 415.518 379.687 409.131 373.438C406.696 371.056 403.705 367.148 399.91 367.408C396.695 367.628 393.628 370.027 391 371.681C385.18 375.345 379.903 379.152 375 384.004C359.304 399.537 350.296 419.029 348.17 441C347.027 452.806 348 465.139 348 477z"/>
            <path fill="currentColor" d="M583 667L583 757C583 772.125 581.66 787.952 583.171 803C584.659 817.833 596.92 829.649 612 829.946C626.815 830.237 640.212 818.852 641.826 804C643.457 789.004 642 773.086 642 758L642 667C649.062 671.974 654.901 678.901 661 685L693 717C701.041 725.041 709.57 736.939 721 740.072C743.94 746.36 764.983 726.214 758.436 703C756.617 696.552 751.581 691.59 747 687L728 668L651 591C639.51 579.51 628.821 564.709 611 565.019C594.491 565.307 582.599 582.401 572 593L497 668L478.001 687C473.551 691.473 468.36 696.832 466.553 703.089C459.867 726.242 481.278 746.3 504 740.072C515.069 737.038 523.215 725.785 531 718L564 685C570.099 678.901 575.938 671.974 583 667M972 945L253 945C250.582 923.29 216.385 929.498"/>
          </svg>
        </button>
      </div>
      <div className="viewer-canvas-wrap">
        <canvas ref={canvasRef} width={854} height={480} className="viewer-canvas" />
      </div>
    </div>
  );
}