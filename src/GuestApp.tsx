import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ContactSheet } from './components/ContactSheet';
import { Drawer } from './components/Drawer';
import { Header } from './components/Header';
import { WifiSheet } from './components/WifiSheet';
import { trackSessionStart, useTrack } from './lib/analytics';
import { GuestProvider, useGuest } from './state/GuestContext';
import { useHotel } from './state/HotelContext';
import { ToastProvider } from './state/ToastContext';
import { EventsView } from './views/EventsView';
import { ExperienceView } from './views/ExperienceView';
import { HomeView } from './views/HomeView';
import { MapView } from './views/MapView';
import { ServicesView } from './views/ServicesView';

/** The guest-facing portal. Self-contained so it can render full-screen, in the desktop shell, or as an admin preview. */
export function GuestApp({ mode = 'hash' }: { mode?: 'hash' | 'memory' }) {
  return (
    <GuestProvider mode={mode}>
      <div className="guest">
        <ToastProvider>
          <GuestInner />
        </ToastProvider>
      </div>
    </GuestProvider>
  );
}

function GuestInner() {
  const { route, embedded } = useGuest();
  const { config } = useHotel();
  const track = useTrack();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const view = ['servicos', 'programacao', 'mapa', 'experience'].includes(route.view) ? route.view : '';
  const viewKey = view === 'experience' ? `experience/${route.param}` : view;

  useEffect(() => {
    if (!embedded) trackSessionStart();
  }, [embedded]);

  // Analytics: sections, opened services and map points (all reachable by URL / deep link)
  useEffect(() => {
    if (route.view === 'admin') return; // #/admin is the staff panel, not a guest visit
    if (view === 'servicos' && route.param) {
      const s = config.services.find((x) => x.id === route.param);
      if (s) track('service', s.id, s.name);
      return;
    }
    if (view === 'mapa' && route.param) {
      const p = config.pins.find((x) => x.id === route.param);
      if (p) track('pin', p.id, p.name);
    }
    const PAGE_LABELS: Record<string, string> = { '': 'Início', servicos: 'Horários & Serviços', programacao: 'Programação', mapa: 'Mapa' };
    const label =
      view === 'experience' ? (config.experiences.find((e) => e.id === route.param)?.title ?? 'Experiência') : PAGE_LABELS[view];
    track('page', viewKey || 'inicio', label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.path]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [viewKey]);

  const title =
    view === 'servicos'
      ? 'Horários & Serviços'
      : view === 'programacao'
        ? 'Programação'
        : view === 'mapa'
          ? 'Mapa do Hotel'
          : view === 'experience'
            ? config.experiences.find((e) => e.id === route.param)?.title
            : undefined;

  return (
    <>
      <div className="guest-scroll" ref={scrollRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)}>
        <Header title={title} solid={view !== '' || scrolled} />
        <motion.main
          key={viewKey}
          className="guest-main"
          initial={{ opacity: 0, x: view ? 28 : -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        >
          {view === '' && <HomeView />}
          {view === 'servicos' && <ServicesView />}
          {view === 'programacao' && <EventsView />}
          {view === 'mapa' && <MapView />}
          {view === 'experience' && <ExperienceView />}
        </motion.main>
      </div>
      <Drawer />
      <ContactSheet />
      <WifiSheet />
    </>
  );
}
