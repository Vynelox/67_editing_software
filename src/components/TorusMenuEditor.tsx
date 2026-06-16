import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import DraggableModal from './DraggableModal';
import TorusMenuPreview, { insideMenuItems } from './TorusMenuPreview';

export function OpenTorusMenuEditor(onCloseCallback?: () => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const cleanup = () => {
    try { root.unmount(); } catch (e) {}
    if (container.parentNode) container.parentNode.removeChild(container);
    (window as any).__popClose?.();
    if (onCloseCallback) onCloseCallback();
  };
  (window as any).__pushClose?.(cleanup);
  root.render(<TorusMenuEditorModal onClose={cleanup} />);
  return cleanup;
}

const ANIMATION_TYPES = ['none', 'pop', 'clock'] as const;
type AnimationType = typeof ANIMATION_TYPES[number];

function getSavedAnimType(): AnimationType {
  try {
    const v = window.localStorage.getItem('juicecut.settings.torusAnimType');
    if (v === 'none' || v === 'pop' || v === 'clock') return v;
  } catch {}
  return 'pop';
}

export default function TorusMenuEditorModal({ onClose }: { onClose: () => void }) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [animType, setAnimType] = useState<AnimationType>(getSavedAnimType);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.torusAnimType', animType); } catch {}
  }, [animType]);

  return (
    <DraggableModal
      title="Torus Menu Editor"
      onClose={onClose}
      style={{ width: 360, minHeight: 0 }}
      body={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 12px 0' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 200,
            height: 200,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <TorusMenuPreview
              items={insideMenuItems}
              cx={100}
              cy={100}
              innerR={52}
              outerR={100}
              rotationOffset={-Math.PI / 6}
              animType={animType}
              onSectorClick={(label) => setSelectedSector(label)}
            />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            {selectedSector ? `Selected: ${selectedSector}` : '6 sectors • Inside mode'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, width: 200 }}>
            <span style={{ lineHeight: 1.2, fontSize: 13, color: 'var(--text-secondary)' }}>Animation type</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {ANIMATION_TYPES.map(opt => {
                const active = animType === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnimType(opt)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: active ? '1px solid var(--accent-blue)' : '1px solid var(--border-mid)',
                      background: active ? 'rgba(56,189,248,0.15)' : 'var(--bg-elevated)',
                      color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      }
    />
  );
}