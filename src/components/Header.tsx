import { ChevronLeft, Menu } from 'lucide-react';
import { useHotel } from '../state/HotelContext';
import { useGuest } from '../state/GuestContext';
import { useWeather } from '../lib/useWeather';
import { WeatherGlyph } from './WeatherGlyph';
import { BrandMark } from './BrandMark';

export function Header({ title, solid }: { title?: string; solid: boolean }) {
  const { config } = useHotel();
  const { route, back, setDrawerOpen, navigate } = useGuest();
  const id = config.identity;
  const weather = useWeather(id.latitude, id.longitude, config.weatherFallback);
  const isHome = route.view === '';

  return (
    <header className={`g-header ${solid ? 'is-solid' : ''} ${isHome ? 'is-home' : ''}`}>
      {isHome ? (
        <button className="monogram" onClick={() => navigate('')} aria-label={id.name}>
          <BrandMark identity={id} />
          <span className="monogram-text">
            <strong>{id.shortName}</strong>
            <small>{id.subtitle}</small>
          </span>
        </button>
      ) : (
        <button className="icon-btn" onClick={back} aria-label="Voltar">
          <ChevronLeft size={22} strokeWidth={1.5} />
        </button>
      )}

      {!isHome && title && <span className="g-header-title">{title}</span>}

      <div className="g-header-right">
        {isHome && id.city && (
          <span className="weather" title={`${id.city} agora`}>
            <WeatherGlyph condition={weather.condition} />
            {weather.temperature}°C <i>•</i> <span className="weather-cond">{weather.condition}</span>
          </span>
        )}
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu">
          <Menu size={22} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
