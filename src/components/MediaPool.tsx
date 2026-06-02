import { useCallback, useRef } from 'react';
import { Film, Music, Image as ImageIcon, Trash2 } from 'lucide-react';
import type { MediaItem } from '../types';

interface Props {
  items: MediaItem[];
  selectedMediaId: string | null;
  onSelect: (id: string) => void;
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
}

export default function MediaPool({ items, selectedMediaId, onSelect, onAdd, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files);
  }, [onAdd]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onAdd(e.target.files);
      e.target.value = '';
    }
  };

  const TypeIcon = ({ type }: { type: MediaItem['type'] }) => {
    if (type === 'video') return <Film size={14} className="text-blue-400" />;
    if (type === 'audio') return <Music size={14} className="text-green-400" />;
    return <ImageIcon size={14} className="text-amber-400" />;
  };

  const formatDur = (frames: number) => `${(frames / 30).toFixed(1)}s`;

  return (
    <div className="media-pool" onDrop={handleDrop} onDragOver={handleDragOver}>
      <input
        type="file"
        ref={fileInputRef}
        accept=".mp4,.mp3,.png,.jpg,.jpeg,.mkv,.mov,.avif,.webm,.ogg"
        multiple
        hidden
        onChange={handleFileChange}
      />
      <div className="media-list">
        {items.length === 0 && (
          <div 
            className="empty-drop" 
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <Film size={28} className="text-gray-600" />
            <p>Drop media here or click me</p>
          </div>
        )}
        {items.map(item => (
          <div
            key={item.id}
            className={`media-item${selectedMediaId === item.id ? ' selected' : ''}`}
            onClick={() => onSelect(item.id)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', item.id);
            }}
          >
            <div className="media-thumb">
              {item.thumbnail
                ? <img src={item.thumbnail} alt={item.name} />
                : item.type === 'audio'
                  ? <Music size={22} className="text-green-400" />
                  : <Film size={22} className="text-blue-400" />
              }
            </div>
            <div className="media-info">
              <div className="media-name" title={item.name}>{item.name}</div>
              <div className="media-meta">
                <TypeIcon type={item.type} />
                <span>{formatDur(item.duration)}</span>
              </div>
            </div>
            <button
              className="media-remove"
              onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
              title="Remove"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
