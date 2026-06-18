import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import DraggableModal from './DraggableModal';
import TorusMenu from './TorusMenu';
import { Slider, Multiselect } from './Adjustables';

const ANIMATION_TYPES = ['none', 'pop', 'clock'] as const;
type AnimationType = typeof ANIMATION_TYPES[number];

function getSavedAnimType(): AnimationType {
  try {
    const v = window.localStorage.getItem('juicecut.settings.torusAnimType');
    if (v === 'none' || v === 'pop' || v === 'clock') return v;
  } catch {}
  return 'pop';
}

function getSavedBounce(): number {
  try {
    const v = window.localStorage.getItem('juicecut.settings.torusBounce');
    if (v !== null) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 0 && n <= 100) return n;
    }
  } catch {}
  return 60;
}

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

export default function TorusMenuEditorModal({ onClose }: { onClose: () => void }) {
  const [torusOpen, setTorusOpen] = useState(false);
  const [animType, setAnimType] = useState<AnimationType>(getSavedAnimType);
  const [bounce, setBounce] = useState(getSavedBounce);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.torusAnimType', animType); } catch {}
  }, [animType]);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.settings.torusBounce', String(bounce)); } catch {}
  }, [bounce]);

  const handleCloseTorus = useCallback(() => {
    setTorusOpen(false);
  }, []);

  const noop = useCallback(() => {}, []);
  const noopBool = useCallback((_ripple: boolean) => {}, []);
  const noopNumBool = useCallback((_dir: number, _ripple: boolean) => {}, []);
  const dummyTarget = { kind: 'inside' as const, clipId: '__preview__', frame: 0 };

  return (
    <DraggableModal
      title="Torus Menu Editor"
      onClose={onClose}
      style={{ width: 360, minHeight: 0 }}
      body={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 12px 0' }}>
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
                    pos={{ x: 0, y: 0 }}
                    target={dummyTarget}
                    onClose={handleCloseTorus}
                    onSplit={noop}
                    onTrimLatter={noopBool}
                    onTrimFormer={noopBool}
                    onStep={noopNumBool}
                    onRoll={noop}
                    showCloseButton
                    bounce={bounce}
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
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            Torus Menu Editor
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, width: 200 }}>
            <Multiselect
              label="Animation type"
              options={ANIMATION_TYPES}
              value={animType}
              onChange={setAnimType}
            />
            <Slider
              label="Bounce"
              value={bounce}
              min={0}
              max={100}
              step={1}
              onChange={setBounce}
              onReset={() => setBounce(60)}
              formatValue={v => `${v}%`}
            />
          </div>
        </div>
      }
    />
  );
}