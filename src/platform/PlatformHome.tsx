import { ArrowRight, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { hotelUrl, RESERVED } from '../lib/tenant';

export const PLATFORM_NAME = 'Hotel Guia';

/** Frame shared by the platform home and the status screens (loading, not found, offline). */
function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="platform">
      <div className="platform-card">
        <p className="platform-brand">
          <span className="platform-mark">HG</span> {PLATFORM_NAME}
        </p>
        {children}
      </div>
      <p className="platform-foot">hotelguia.com.br</p>
    </main>
  );
}

/** Lets a guest type the hotel code printed on the room card when the QR code isn't at hand. */
function HotelCodeForm() {
  const [code, setCode] = useState('');
  const slug = code
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const valid = slug.length >= 2 && !RESERVED.has(slug);

  const go = (e: FormEvent) => {
    e.preventDefault();
    if (valid) window.location.assign(hotelUrl(slug));
  };

  return (
    <form className="platform-form" onSubmit={go}>
      <label htmlFor="hotel-code">Código do hotel</label>
      <div className="platform-input">
        <input
          id="hotel-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ex.: vale-sereno"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="submit" disabled={!valid} aria-label="Abrir guia do hotel">
          <ArrowRight size={18} />
        </button>
      </div>
      <small>Está no cartão do quarto, junto ao QR Code.</small>
    </form>
  );
}

/** hotelguia.com.br — platform root. Placeholder until the partner-hotel showcase (phase 4). */
export function PlatformHome() {
  // A path that isn't a valid hotel id (e.g. /Hotel%20X!) lands here too.
  const notFound = window.location.pathname.replace(/\/+$/, '') !== '';
  if (notFound) return <HotelNotFound />;
  return (
    <Screen>
      <h1>O guia digital do seu hotel.</h1>
      <p>Horários, programação, mapa e contato com a recepção — tudo no celular, sem baixar aplicativo.</p>
      <HotelCodeForm />
    </Screen>
  );
}

export function HotelNotFound() {
  return (
    <Screen>
      <h1>Hotel não encontrado.</h1>
      <p>Confira o endereço ou digite o código do hotel. Se você escaneou um QR Code, avise a recepção.</p>
      <HotelCodeForm />
    </Screen>
  );
}

export function HotelLoading() {
  return (
    <main className="platform is-loading" aria-busy="true">
      <Loader2 size={28} className="spin" aria-label="Carregando" />
    </main>
  );
}

export function HotelOffline() {
  return (
    <Screen>
      <h1>
        <WifiOff size={26} /> Sem conexão.
      </h1>
      <p>Não foi possível carregar o guia do hotel. Verifique a internet ou o Wi-Fi e tente novamente.</p>
      <button className="platform-btn" onClick={() => window.location.reload()}>
        <RefreshCw size={16} /> Tentar novamente
      </button>
    </Screen>
  );
}
