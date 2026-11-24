import { useCallback } from 'react';
import { useWifiAction } from '../components/WifiSheet';
import { useTrack } from './analytics';
import { useGuest } from '../state/GuestContext';
import type { QuickAction } from '../types';
import { safeExternalUrl } from './safeUrl';

/** Destinations offered in the admin when a shortcut points to a portal page. */
export const ROUTE_OPTIONS: { value: string; label: string }[] = [
  { value: 'servicos', label: 'Horários & Serviços' },
  { value: 'servicos?c=gastronomia', label: 'Serviços • Gastronomia' },
  { value: 'servicos?c=drinks', label: 'Serviços • Drinks & Bar' },
  { value: 'servicos?c=lazer', label: 'Serviços • Lazer' },
  { value: 'servicos?c=bem-estar', label: 'Serviços • Bem-estar' },
  { value: 'programacao', label: 'Programação' },
  { value: 'mapa', label: 'Mapa Interativo' },
];

/** Returns a function that performs a home/menu shortcut. */
export function useRunQuickAction() {
  const { navigate, setContactOpen, setDrawerOpen } = useGuest();
  const wifi = useWifiAction();
  const track = useTrack();
  return useCallback(
    (a: QuickAction) => {
      track('shortcut', a.id, a.label);
      switch (a.kind) {
        case 'wifi':
          setDrawerOpen(false);
          return wifi();
        case 'contact':
          setDrawerOpen(false);
          return setContactOpen(true);
        case 'url': {
          const url = safeExternalUrl(a.target);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        default:
          return navigate(a.target);
      }
    },
    [navigate, setContactOpen, setDrawerOpen, wifi, track],
  );
}
