/** Domain model for the white-label Guest Portal. All hotel content lives in HotelConfig. */

export type ThemeColors = {
  primary: string;
  bg: string;
  surface: string;
  accent: string;
  textMain: string;
  textMuted: string;
};

export type Identity = {
  name: string;
  shortName: string;
  monogram: string;
  logo: string; // URL or data URL — when set, replaces the monogram
  subtitle: string;
  heroTitle: string;
  heroSubtitle: string;
  tagline: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  whatsapp: string; // digits only, with country code
  extension: string;
  receptionHours: string;
  wifiNetwork: string;
  wifiPassword: string;
  heroImage: string;
  footerImage: string;
  checkIn: string;
  checkOut: string;
};

export type NoticePriority = 'aviso' | 'evento' | 'manutencao';

export type Notice = {
  id: string;
  title: string;
  message: string;
  priority: NoticePriority;
  active: boolean;
};

export type ServiceCategory = 'gastronomia' | 'drinks' | 'lazer' | 'bem-estar' | 'servicos';

export type StatusOverride = 'auto' | 'open' | 'closed' | 'maintenance' | 'appointment';

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  icon: string;
  open: string; // "HH:MM"
  close: string; // "HH:MM" — may be past midnight (e.g. "01:00")
  description: string;
  highlights: string[];
  dressCode?: string;
  image: string;
  override: StatusOverride;
  bookable: boolean;
  pinId?: string;
};

export type HotelEvent = {
  id: string;
  title: string;
  time: string; // "HH:MM"
  days: number[]; // 0 = domingo ... 6 = sábado
  location: string;
  pinId?: string;
  description: string;
  icon: string;
  draft?: boolean; // saved but hidden from guests
};

export type MapPin = {
  id: string;
  number: number;
  name: string;
  category: string;
  x: number; // %
  y: number; // %
  description: string;
  hours: string;
  image: string;
  detailRoute?: string; // where "Ver Detalhes" leads
};

export type ExperienceItem = {
  id: string;
  name: string;
  hours: string;
  rules: string[];
  icon: string;
};

export type Experience = {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  image: string;
  pinId?: string;
  items: ExperienceItem[];
};

/** A shortcut card on the guest home ("Sua estadia, em um toque") and in the side menu. */
export type QuickActionKind = 'route' | 'wifi' | 'contact' | 'url';
export type QuickAction = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  kind: QuickActionKind;
  target: string; // route path (e.g. "mapa") or external URL
  active: boolean;
};

export type QuickRequest = { id: string; label: string; icon: string };

export type HotelConfig = {
  version: number;
  theme: ThemeColors;
  identity: Identity;
  weatherFallback: { temperature: number; condition: string };
  notices: Notice[];
  services: Service[];
  events: HotelEvent[];
  mapImage: string; // empty → built-in illustrated map
  pins: MapPin[];
  experiences: Experience[];
  quickActions: QuickAction[];
  quickRequests: QuickRequest[];
  houseRules: string[];
};
