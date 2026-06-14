import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface DraggableModalProps {
  /** The title text shown in the header */
  title: ReactNode;
  /** The body content (hidden when minimized) */
  body: ReactNode;
  /** Called when the close (X) button is clicked */
  onClose: () => void;
  /** Additional CSS classes for the modal-box element */
  className?: string;
  /** Whether to show the minimize button (default: true) */
  minimizable?: boolean;
  /** Extra buttons/elements to render in the header (left side) */
  headerLeft?: ReactNode;
  /** Inline styles for the modal-box element */
  style?: React.CSSProperties;
}

/**
 * A reusable draggable, minimizable modal wrapper.
 * 
 * Usage:
 * <DraggableModal
 *   title="Settings"
 *   body={<div>Content here</div>}
 *   onClose={onClose}
 *   className="settings-modal"
 * />
 */
export default function DraggableModal({ title, body, onClose, className = '', minimizable = true, headerLeft, style }: DraggableModalProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const getGuiScale = () => {
    try { const v = window.localStorage.getItem('juicecut.settings.guiScale'); return v ? Number(v) / 100 : 1; } catch { return 1; }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't start drag if clicking close or minimize buttons
    if (target.closest('.modal-minimize-btn') || target.closest('[aria-label="Close"]')) return;
    setIsDragging(true);
    const scale = getGuiScale();
    dragOffset.current = {
      x: (e.clientX - position.x) / scale,
      y: (e.clientY - position.y) / scale,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const scale = getGuiScale();
      setPosition({
        x: e.clientX / scale - dragOffset.current.x,
        y: e.clientY / scale - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div
        className={`modal-box ${className}`}
        style={{
          position: 'fixed',
          left: `calc(50% + ${position.x}px)`,
          top: `calc(50% + ${position.y}px)`,
          transform: 'translate(-50%, -50%)',
          ...(isMinimized ? { height: 'auto', minHeight: 0, maxHeight: 'none', overflow: 'hidden' } : {}),
          ...style,
        }}
      >
        <div
          className="modal-header modal-header--centered"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          {headerLeft}
          <span className="panel-title settings-title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginLeft: 'auto', paddingRight: 8, height: '100%' }}>
            {minimizable && (
              <button
                className="icon-btn modal-minimize-btn"
                onClick={() => setIsMinimized(m => !m)}
                aria-label={isMinimized ? 'Restore' : 'Minimize'}
                title={isMinimized ? 'Restore' : 'Minimize'}
                style={{ width: 32, height: 32 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        {!isMinimized && body}
      </div>
    </div>
  );
}