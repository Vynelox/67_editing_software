import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value: string; // hex color like #rrggbb
  onChange: (hex: string) => void;
}

function clamp(n: number, a = 0, b = 255) { return Math.min(b, Math.max(a, Math.round(n))); }

function hexToRgb(hex: string) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const h = hex.replace('#','');
  if (h.length === 3) {
    return {
      r: parseInt(h[0]+h[0], 16),
      g: parseInt(h[1]+h[1], 16),
      b: parseInt(h[2]+h[2], 16),
    };
  }
  return {
    r: parseInt(h.substring(0,2), 16),
    g: parseInt(h.substring(2,4), 16),
    b: parseInt(h.substring(4,6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// HSL helpers
function hslToRgb(h: number, s: number, l: number) {
  // h in [0,360], s,l in [0,1]
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hh >= 0 && hh < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hh >= 1 && hh < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hh >= 2 && hh < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hh >= 3 && hh < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hh >= 4 && hh < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = l - c/2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export default function ColorPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value || '#000000');
  // use H, S(0-1), L(0-1)
  const initHsl = hexToHsl(value || '#000000');
  const [hue, setHue] = useState(initHsl.h || 0);
  const [sat, setSat] = useState(initHsl.s || 0);
  const [light, setLight] = useState((initHsl.l || 0) * 100);
  const ref = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    setHex(value || '#000000');
    const hsl = hexToHsl(value || '#000000');
    setHue(hsl.h || 0);
    setSat(hsl.s || 0);
    setLight((hsl.l || 0) * 100);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function applyRgb(r: number, g: number, b: number) {
    const h = rgbToHex(r,g,b);
    setHex(h);
    onChange(h);
  }

  function onHexChange(raw: string) {
    const v = raw.trim();
    if (/^#?[0-9a-fA-F]{3}$/.test(v)) {
      const h = (v.startsWith('#')?v:'#'+v);
      const full = h.length===4?('#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3]):h;
      setHex(full);
      const hs = hexToHsl(full);
      setHue(hs.h || 0); setSat(hs.s || 0); setLight((hs.l||0)*100);
    } else if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
      const h = (v.startsWith('#')?v:'#'+v);
      setHex(h);
      const hs = hexToHsl(h);
      setHue(hs.h || 0); setSat(hs.s || 0); setLight((hs.l||0)*100);
      onChange(h);
    } else {
      setHex(v);
    }
  }

  // draw canvas-based hue/sat wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 220;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const cx = w/2;
    const cy = h/2;
    const radius = Math.min(cx, cy);
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx*dx + dy*dy);
        const idx = (y * w + x) * 4;
        if (r > radius) {
          img.data[idx+0] = 0; img.data[idx+1] = 0; img.data[idx+2] = 0; img.data[idx+3] = 0;
          continue;
        }
        let angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
        if (angle < 0) angle += 360;
        const hHue = angle;
        const s = Math.min(1, r / radius);
        const l = light / 100; // use current lightness to render
        const { r: rr, g: gg, b: bb } = hslToRgb(hHue, s, l);
        img.data[idx+0] = rr;
        img.data[idx+1] = gg;
        img.data[idx+2] = bb;
        img.data[idx+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [light, hue, sat]);

  // pointer handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onPointer = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      const cx = canvas.width/2;
      const cy = canvas.height/2;
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx*dx + dy*dy);
      const radius = Math.min(cx, cy);
      if (r > radius) return;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      const s = Math.min(1, r / radius);
      setHue(angle);
      setSat(s);
      // update preview hex
      const previewHex = hslToHex(angle, s, light/100);
      setHex(previewHex);
    };
    const onPointerUp = () => { draggingRef.current = false; canvas.releasePointerCapture && canvas.releasePointerCapture((canvas as any).pointerId); };
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      draggingRef.current = true;
      (e.target as Element).setPointerCapture && (e.target as Element).setPointerCapture((e as any).pointerId);
      onPointer(e);
    });
    window.addEventListener('pointermove', (e) => { if (draggingRef.current) onPointer(e as PointerEvent); });
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', (e) => { if (draggingRef.current) onPointer(e as PointerEvent); });
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [light]);

  // compute preview hex when hue/sat/light change
  useEffect(() => {
    const h = hslToHex(hue, sat, light/100);
    setHex(h);
  }, [hue, sat, light]);

  return (
    <div className="color-picker" ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="color-preview"
        style={{ background: hex }}
        onClick={() => setOpen(o => !o)}
        aria-label={`Open color picker (${hex})`}
      />

      {open && (
        <div className="color-popover" role="dialog" aria-label="Color picker">
          <div className="color-popover-inner">
            <div className="color-preview-large" style={{ background: hex }} />

            <div className="color-hex-row">
              <label className="color-hex-label">Hex</label>
              <input
                className="color-hex-input"
                value={hex}
                onChange={e => onHexChange(e.target.value)}
                onBlur={() => {
                  const normalized = /^#?[0-9a-fA-F]{3}$/.test(hex)
                    ? ('#' + hex.replace('#','').split('').map(c=>c+c).join(''))
                    : (hex.startsWith('#') ? hex : ('#' + hex));
                  if (/^#([0-9a-fA-F]{6})$/.test(normalized)) {
                    setHex(normalized);
                    const hs = hexToHsl(normalized);
                    setHue(hs.h || 0); setSat(hs.s || 0); setLight((hs.l||0)*100);
                    onChange(normalized);
                  } else {
                    setHex(value);
                  }
                }}
              />
            </div>

            <div style={{ position: 'relative', width: 220, height: 220 }}>
              <canvas ref={canvasRef} style={{ borderRadius: 8, display: 'block' }} />
              {/* selection indicator */}
              <div
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${Math.cos(hue * Math.PI/180) * sat * 50}% - 6px)`,
                  top: `calc(50% + ${Math.sin(hue * Math.PI/180) * sat * 50}% - 6px)`,
                  width: 12,
                  height: 12,
                  borderRadius: 9999,
                  border: '2px solid white',
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.5)'
                }}
              />
            </div>

            <div className="color-slider-row" style={{ marginTop: 8 }}>
              <label>Light</label>
              <input type="range" min={0} max={100} value={light} onChange={e => setLight(Number(e.target.value))} />
              <div className="color-val">{Math.round(light)}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-primary" onClick={() => { onChange(hex); setOpen(false); }}>Apply</button>
              <button type="button" className="btn-secondary" onClick={() => { setHex(value); const hs = hexToHsl(value); setHue(hs.h||0); setSat(hs.s||0); setLight((hs.l||0)*100); setOpen(false); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
