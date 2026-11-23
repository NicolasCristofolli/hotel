import type { HotelConfig } from '../types';
import { defaultHotelConfig, IMAGES } from './defaultHotelConfig';

/**
 * Content for a hotel that was just created on the platform (never saved): a neutral, generic portal
 * under the hotel's own name — never the demo hotel's restaurants, events or photos. The admin panel's
 * "Primeiros passos" checklist points at what still has to be filled in.
 */
export function starterConfig(name: string): HotelConfig {
  const words = name
    .replace(/^(hotel|pousada|resort|hostel|chalés?)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const shortName = words.join(' ') || name;
  const monogram = (words.map((w) => w[0]).join('') || name).slice(0, 2).toUpperCase();

  return {
    ...defaultHotelConfig,
    identity: {
      ...defaultHotelConfig.identity,
      name,
      shortName,
      monogram,
      logo: '',
      subtitle: 'Guia do Hóspede',
      heroTitle: 'Portal do Hóspede',
      heroSubtitle: 'Horários, serviços e contatos do hotel, na palma da mão.',
      tagline: 'Bem-vindo! Aproveite a sua estadia',
      city: '',
      region: '',
      whatsapp: '',
      extension: '9',
      receptionHours: '24 horas',
      wifiNetwork: '',
      wifiPassword: '',
      heroImage: IMAGES.lobby,
      footerImage: IMAGES.room,
      checkIn: '14h',
      checkOut: '12h',
    },
    notices: [
      {
        id: 'boas-vindas',
        title: 'Bem-vindo!',
        message: `Seja bem-vindo ao ${name}. Aqui você encontra horários, serviços e o contato direto com a recepção.`,
        priority: 'aviso',
        active: true,
      },
    ],
    services: [
      {
        id: 'cafe',
        name: 'Café da Manhã',
        category: 'gastronomia',
        icon: 'Coffee',
        open: '07:00',
        close: '10:00',
        description: 'Servido no restaurante do hotel.',
        highlights: [],
        image: IMAGES.breakfast,
        override: 'auto',
        bookable: false,
      },
      {
        id: 'recepcao',
        name: 'Recepção',
        category: 'servicos',
        icon: 'ConciergeBell',
        open: '00:00',
        close: '00:00',
        description: 'Equipe disponível para ajudar com o que você precisar.',
        highlights: [],
        image: IMAGES.lobby,
        override: 'auto',
        bookable: false,
      },
    ],
    events: [],
    mapImage: '',
    pins: [],
    experiences: [
      {
        id: 'concierge',
        eyebrow: 'Atendimento',
        title: 'Recepção',
        intro: 'Nossa equipe está à disposição para tornar a sua estadia ainda melhor.',
        image: IMAGES.lobby,
        items: [
          {
            id: 'c1',
            name: 'Recepção',
            hours: '24 horas',
            icon: 'ConciergeBell',
            rules: ['Check-in a partir das 14h', 'Check-out até 12h'],
          },
        ],
      },
    ],
    quickActions: [
      {
        id: 'concierge',
        label: 'Recepção',
        hint: 'Fale com a equipe',
        icon: 'ConciergeBell',
        kind: 'route',
        target: 'experience/concierge',
        active: true,
      },
      {
        id: 'horarios',
        label: 'Horários & Serviços',
        hint: 'Status em tempo real',
        icon: 'Clock3',
        kind: 'route',
        target: 'servicos',
        active: true,
      },
      {
        id: 'programacao',
        label: 'Programação',
        hint: 'Agenda do hotel',
        icon: 'CalendarDays',
        kind: 'route',
        target: 'programacao',
        active: false,
      },
      { id: 'mapa', label: 'Mapa', hint: 'Conheça o hotel', icon: 'Map', kind: 'route', target: 'mapa', active: false },
      { id: 'wifi', label: 'Wi-Fi & Regras', hint: 'Toque para copiar a senha', icon: 'Wifi', kind: 'wifi', target: '', active: true },
    ],
    quickRequests: [
      { id: 'q1', label: 'Solicitar Toalhas', icon: 'Bath' },
      { id: 'q2', label: 'Limpeza de Quarto', icon: 'SprayCan' },
      { id: 'q3', label: 'Chamar Mensageiro', icon: 'Luggage' },
      { id: 'q4', label: 'Despertador', icon: 'AlarmClock' },
    ],
    houseRules: [
      'Silêncio entre 22h e 08h nas áreas comuns',
      'Proibido fumar nas acomodações',
      'Visitantes devem ser registrados na recepção',
    ],
  };
}

/** What a new hotel still has to fill in before showing the portal to guests. */
export type SetupStep = { id: string; label: string; tab: string; done: boolean };

export function setupSteps(c: HotelConfig): SetupStep[] {
  const id = c.identity;
  return [
    { id: 'whatsapp', label: 'WhatsApp da recepção', tab: 'identity', done: id.whatsapp.replace(/\D/g, '').length >= 10 },
    { id: 'wifi', label: 'Rede e senha do Wi-Fi', tab: 'identity', done: !!id.wifiNetwork.trim() },
    { id: 'city', label: 'Cidade e coordenadas (previsão do tempo)', tab: 'identity', done: !!id.city.trim() },
    {
      id: 'photo',
      label: 'Foto de capa do hotel',
      tab: 'identity',
      done: id.heroImage !== IMAGES.lobby && id.heroImage !== IMAGES.hero,
    },
    {
      id: 'services',
      label: 'Horários e serviços',
      tab: 'services',
      done: c.services.length > 2 || c.services.some((s) => s.highlights.length),
    },
  ];
}
