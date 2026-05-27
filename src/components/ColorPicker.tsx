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

export default function ColorPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value || '#000000');
  const [rgb, setRgb] = useState(() => hexToRgb(value || '#000000'));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHex(value || '#000000');
    setRgb(hexToRgb(value || '#000000'));
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
    setRgb({ r, g, b });
    onChange(h);
  }

  function onHexChange(raw: string) {
    const v = raw.trim();
    if (/^#?[0-9a-fA-F]{3}$/.test(v)) {
      const h = (v.startsWith('#')?v:'#'+v);
      setHex(h.length===4?('#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3]):h);
      setRgb(hexToRgb(h));
    } else if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
      const h = (v.startsWith('#')?v:'#'+v);
      setHex(h);
      setRgb(hexToRgb(h));
      onChange(h);
    } else {
      setHex(v);
    }
  }

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
                  // normalize and apply
                  const normalized = /^#?[0-9a-fA-F]{3}$/.test(hex)
                    ? ('#' + hex.replace('#','').split('').map(c=>c+c).join(''))
                    : (hex.startsWith('#') ? hex : ('#' + hex));
                  if (/^#([0-9a-fA-F]{6})$/.test(normalized)) {
                    setHex(normalized);
                    setRgb(hexToRgb(normalized));
                    onChange(normalized);
                  } else {
                    setHex(value);
                  }
                }}
              />
            </div>

            <div className="color-slider-row">
              <label>R</label>
              <input type="range" min={0} max={255} value={rgb.r} onChange={e => applyRgb(Number(e.target.value), rgb.g, rgb.b)} />
+            <div className="color-val">{rgb.r}</div>
            </div>
            <div className="color-slider-row">
              <label>G</label>
              <input type="range" min={0} max={255} value={rgb.g} onChange={e => applyRgb(rgb.r, Number(e.target.value), rgb.b)} />
+            <div className="color-val">{rgb.g}</div>
            </div>
            <div className="color-slider-row">
              <label>B</label>
              <input type="range" min={0} max={255} value={rgb.b} onChange={e => applyRgb(rgb.r, rgb.g, Number(e.target.value))} />
+            <div className="color-val">{rgb.b}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-primary" onClick={() => { onChange(hex); setOpen(false); }}>Apply</button>
              <button type="button" className="btn-secondary" onClick={() => { setHex(value); setRgb(hexToRgb(value)); setOpen(false); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
