import React from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  playheadTop: number;
  onChangePlayheadTop: (v: number) => void;
  includeResizeInUndo: boolean;
  onToggleIncludeResizeInUndo: (v: boolean) => void;
}

export default function Settings({ open, onClose, playheadTop, onChangePlayheadTop, includeResizeInUndo, onToggleIncludeResizeInUndo }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box">
        <div className="modal-header">
          <div>Settings</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="settings-field">
            Playneedle vertical offset (%)
            <input
              type="number"
              className="settings-number-input"
              min={0}
              max={100}
              step={1}
              value={playheadTop}
              onChange={e => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) onChangePlayheadTop(Math.min(100, Math.max(0, v)));
              }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={includeResizeInUndo} onChange={e => onToggleIncludeResizeInUndo(e.target.checked)} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Include splitter resize actions in Ctrl+Z/Ctrl+Y</span>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
