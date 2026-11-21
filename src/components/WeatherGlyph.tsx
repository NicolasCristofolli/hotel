import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from 'lucide-react';

export function WeatherGlyph({ condition }: { condition: string }) {
  const p = { size: 14, strokeWidth: 1.5 };
  if (/limpo/i.test(condition)) return <Sun {...p} />;
  if (/poucas|parcial/i.test(condition)) return <CloudSun {...p} />;
  if (/neblina/i.test(condition)) return <CloudFog {...p} />;
  if (/chuva|garoa/i.test(condition)) return <CloudRain {...p} />;
  if (/neve/i.test(condition)) return <Snowflake {...p} />;
  if (/tempestade/i.test(condition)) return <CloudLightning {...p} />;
  return <Cloud {...p} />;
}
