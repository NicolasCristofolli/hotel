import { motion } from 'framer-motion';
import { ArrowRight, Clock3, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Img } from '../components/Img';
import { MapCanvas } from '../components/MapCanvas';
import { useTrack } from '../lib/analytics';
import { useGuest } from '../state/GuestContext';
import { useHotel } from '../state/HotelContext';

export function MapView() {
  const { config } = useHotel();
  const { route, navigate } = useGuest();
  const track = useTrack();
  const trackPin = (id: string) => track('pin', id, config.pins.find((p) => p.id === id)?.name ?? id);
  const pins = [...config.pins].sort((a, b) => a.number - b.number);

  const [selectedId, setSelectedId] = useState<string | null>(route.param ?? null);
  const [focusId, setFocusId] = useState<string | null>(route.param ?? null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Deep link (#/mapa/p4) → focus pin
  useEffect(() => {
    if (route.param) {
      setSelectedId(route.param);
      setFocusId(route.param);
    }
  }, [route.param]);

  const drawerPin = pins.find((p) => p.id === drawerId);

  // Map → list: highlight list item + open drawer
  const onPinClick = (id: string) => {
    trackPin(id);
    setSelectedId(id);
    setDrawerId(id);
    itemRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // List → map: highlight + zoom to pin
  const onItemClick = (id: string) => {
    trackPin(id);
    setSelectedId(id);
    setFocusId(id);
    mapRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">Orientação</p>
        <h1 className="page-title">
          Mapa <em>Interativo</em>
        </h1>
        <p className="page-lead">Toque em um ponto numerado ou escolha na lista abaixo.</p>
      </div>

      <div className="map-frame" ref={mapRef}>
        <MapCanvas pins={pins} image={config.mapImage} selectedId={selectedId} focusId={focusId} onPinClick={(p) => onPinClick(p.id)}>
          {focusId && (
            <button className="map-reset" onClick={() => setFocusId(null)}>
              <Minimize2 size={14} strokeWidth={1.5} /> Ver mapa inteiro
            </button>
          )}
          {selectedId && focusId && (
            <motion.button
              className="map-callout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={selectedId}
              onClick={() => setDrawerId(selectedId)}
            >
              {pins.find((p) => p.id === selectedId)?.name}
              <ArrowRight size={14} strokeWidth={1.5} />
            </motion.button>
          )}
        </MapCanvas>
      </div>

      <div className="section-head compact">
        <p className="eyebrow">Diretório</p>
      </div>
      <div className="directory">
        {pins.map((p, i) => (
          <motion.button
            key={p.id}
            ref={(el) => {
              itemRefs.current[p.id] = el;
            }}
            className={`dir-item ${selectedId === p.id ? 'is-active' : ''}`}
            onClick={() => onItemClick(p.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.03 }}
          >
            <span className="dir-num">{p.number}</span>
            <span className="dir-text">
              <strong>{p.name}</strong>
              <small>{p.category}</small>
            </span>
          </motion.button>
        ))}
      </div>

      <BottomSheet
        open={!!drawerPin}
        onClose={() => setDrawerId(null)}
        label={drawerPin?.name ?? 'Local'}
        media={drawerPin && <Img src={drawerPin.image} alt={drawerPin.name} className="sheet-img" />}
      >
        {drawerPin && (
          <>
            <div className="sheet-heading">
              <p className="eyebrow">
                <span className="dir-num sm">{drawerPin.number}</span> {drawerPin.category}
              </p>
              <h2 className="sheet-title">{drawerPin.name}</h2>
              <span className="sheet-hours">
                <Clock3 size={15} strokeWidth={1.5} /> {drawerPin.hours}
              </span>
            </div>
            <p className="sheet-text">{drawerPin.description}</p>
            <div className="sheet-actions">
              {drawerPin.detailRoute && (
                <button className="btn btn-primary btn-block" onClick={() => navigate(drawerPin.detailRoute!)}>
                  Ver Detalhes <ArrowRight size={18} strokeWidth={1.5} />
                </button>
              )}
              <button
                className="btn btn-outline btn-block"
                onClick={() => {
                  setDrawerId(null);
                  setFocusId(drawerPin.id);
                  mapRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
              >
                Aproximar no mapa
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
