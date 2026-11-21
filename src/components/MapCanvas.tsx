import { motion } from 'framer-motion';
import type { MouseEvent, ReactNode } from 'react';
import type { MapPin } from '../types';
import { IllustratedMap } from './IllustratedMap';

type Props = {
  pins: MapPin[];
  image: string;
  selectedId?: string | null;
  /** zoom & center on this pin */
  focusId?: string | null;
  onPinClick?: (pin: MapPin) => void;
  onCanvasClick?: (pos: { x: number; y: number }) => void;
  children?: ReactNode;
  className?: string;
  editable?: boolean;
};

const ZOOM = 1.9;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function MapCanvas({ pins, image, selectedId, focusId, onPinClick, onCanvasClick, children, className = '', editable }: Props) {
  const focus = focusId ? pins.find((p) => p.id === focusId) : undefined;

  // Translate (in % of the canvas) so the focused pin sits at the center, clamped to edges.
  const max = ((ZOOM - 1) / 2) * 100;
  const tx = focus ? clamp((50 - focus.x) * ZOOM, -max, max) : 0;
  const ty = focus ? clamp((50 - focus.y) * ZOOM, -max, max) : 0;

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onCanvasClick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    onCanvasClick({ x: clamp(x, 2, 98), y: clamp(y, 2, 98) });
  };

  return (
    <div className={`map-canvas ${editable ? 'is-editable' : ''} ${className}`}>
      <motion.div
        className="map-layer"
        animate={{ scale: focus ? ZOOM : 1, x: `${tx}%`, y: `${ty}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        onClick={handleClick}
      >
        {image ? <img className="map-img" src={image} alt="Mapa do hotel" draggable={false} /> : <IllustratedMap />}
        {pins.map((p) => {
          const active = p.id === selectedId;
          return (
            <motion.button
              key={p.id}
              type="button"
              className={`map-pin ${active ? 'is-active' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              layout={editable}
              animate={{ scale: focus ? 1 / ZOOM : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onClick={(e) => {
                e.stopPropagation();
                onPinClick?.(p);
              }}
              aria-label={`${p.number}. ${p.name}`}
            >
              <span className="map-pin-pulse" />
              <span className="map-pin-dot">{p.number}</span>
              {active && <span className="map-pin-label">{p.name}</span>}
            </motion.button>
          );
        })}
      </motion.div>
      {children}
    </div>
  );
}
