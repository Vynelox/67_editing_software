import { useState } from 'react';
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
    if (onCloseCallback) onCloseCallback();
  };
  root.render(<TorusMenuEditorModal onClose={cleanup} />);
  return cleanup;
}

export default function TorusMenuEditorModal({ onClose }: { onClose: () => void }) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  return (
    <DraggableModal
      title="Torus Menu Editor"
      onClose={onClose}
      style={{ width: 420, minHeight: 400 }}
      body={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
            Interactive preview — click sectors to test
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 280,
            height: 280,
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <TorusMenuPreview
              items={insideMenuItems}
              cx={140}
              cy={140}
              innerR={52}
              outerR={100}
              rotationOffset={-Math.PI / 6}
              onSectorClick={(label) => setSelectedSector(label)}
            />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            {selectedSector ? `Selected: ${selectedSector}` : '6 sectors • Inside mode'}
          </div>
        </div>
      }
    />
  );
}