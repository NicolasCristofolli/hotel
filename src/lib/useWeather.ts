import { useEffect, useState } from 'react';

const CODES: [number[], string][] = [
  [[0], 'Céu Limpo'],
  [[1], 'Poucas Nuvens'],
  [[2], 'Parcialmente Nublado'],
  [[3], 'Nublado'],
  [[45, 48], 'Neblina'],
  [[51, 53, 55, 56, 57], 'Garoa'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Chuva'],
  [[71, 73, 75, 77, 85, 86], 'Neve'],
  [[95, 96, 99], 'Tempestade'],
];

const describe = (code: number) => CODES.find(([c]) => c.includes(code))?.[1] ?? 'Tempo Estável';

/** Live temperature from Open-Meteo (no API key). Falls back to config values offline. */
export function useWeather(lat: number, lon: number, fallback: { temperature: number; condition: string }) {
  const [weather, setWeather] = useState(fallback);

  useEffect(() => {
    setWeather(fallback);
    const ctrl = new AbortController();
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const t = d?.current?.temperature_2m;
        const c = d?.current?.weather_code;
        if (typeof t === 'number') setWeather({ temperature: Math.round(t), condition: describe(c) });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  return weather;
}
