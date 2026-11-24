import { MapPin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/** A hotel on the public showcase (`public_hotels()` — migrations/0009). */
type ListedHotel = { id: string; name: string; city: string; region: string; image: string; logo: string; monogram: string; color: string };

const CACHE_KEY = 'hotelguia:directory:v1';
const HEX = /^#[0-9a-f]{3,8}$/i;
const SLUG = /^[a-z0-9-]{2,40}$/;
const safeImg = (u: string) => (/^https:\/\//i.test(u) ? u : '');

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function readCache(): ListedHotel[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Partner hotels with photo, plus a search by name or city. Shows the last list instantly, then refreshes. */
export function HotelDirectory() {
  const [hotels, setHotels] = useState<ListedHotel[] | null>(readCache);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!supabase) return setHotels([]);
    let alive = true;
    supabase.rpc('public_hotels').then(({ data, error }) => {
      if (!alive) return;
      if (error) return setFailed(true);
      const list = ((data as ListedHotel[]) ?? []).filter((h) => SLUG.test(h.id));
      setHotels(list);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      } catch {
        /* private mode — ignore */
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!hotels || !q) return hotels;
    return hotels.filter((h) => fold(`${h.name} ${h.city} ${h.region}`).includes(q));
  }, [hotels, query]);

  // Nothing to show (no hotels yet, or offline without a saved list): the page stays just the code form.
  if ((hotels && hotels.length === 0) || (!hotels && failed)) return null;

  return (
    <section className="ph-dir" aria-labelledby="ph-dir-title">
      <header className="ph-dir-head">
        <div>
          <h2 id="ph-dir-title">Hotéis parceiros</h2>
          <p>{hotels ? `${hotels.length} ${hotels.length === 1 ? 'hotel' : 'hotéis'} com guia digital` : 'Carregando…'}</p>
        </div>
        <label className="ph-search">
          <Search size={17} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou cidade"
            aria-label="Buscar hotel por nome ou cidade"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca">
              <X size={16} />
            </button>
          )}
        </label>
      </header>

      {!shown ? (
        <ul className="ph-grid" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="ph-card is-skeleton" />
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <p className="ph-empty">Nenhum hotel encontrado para “{query.trim()}”.</p>
      ) : (
        <ul className="ph-grid">
          {shown.map((h) => {
            const img = safeImg(h.image);
            const logo = safeImg(h.logo);
            const color = HEX.test(h.color) ? h.color : '#142b22';
            const place = [h.city, h.region].filter(Boolean).join(', ');
            return (
              <li key={h.id}>
                <a className="ph-card" href={`/${h.id}`} style={{ '--hc': color } as React.CSSProperties}>
                  <span className="ph-photo">{img && <img src={img} alt="" loading="lazy" decoding="async" />}</span>
                  <span className="ph-info">
                    <span className="ph-badge">
                      {logo ? <img src={logo} alt="" loading="lazy" /> : h.monogram || h.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="ph-text">
                      <strong>{h.name}</strong>
                      {place && (
                        <small>
                          <MapPin size={13} aria-hidden /> {place}
                        </small>
                      )}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
