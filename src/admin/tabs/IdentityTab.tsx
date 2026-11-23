import { Check } from 'lucide-react';
import { PALETTE_PRESETS } from '../../config/defaultHotelConfig';
import { useHotel } from '../../state/HotelContext';
import type { Identity, ThemeColors } from '../../types';
import { ImageField } from '../ImageField';
import { Card, Field, Input, Textarea } from '../ui';

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; css: string }[] = [
  { key: 'primary', label: 'Primária', css: '--color-primary' },
  { key: 'bg', label: 'Fundo', css: '--color-bg' },
  { key: 'surface', label: 'Superfície', css: '--color-surface' },
  { key: 'accent', label: 'Destaque', css: '--color-accent' },
  { key: 'textMain', label: 'Texto', css: '--color-text-main' },
  { key: 'textMuted', label: 'Texto suave', css: '--color-text-muted' },
];

export function IdentityTab() {
  const { config, setConfig } = useHotel();
  const id = config.identity;

  const set = <K extends keyof Identity>(k: K, v: Identity[K]) => setConfig((p) => ({ ...p, identity: { ...p.identity, [k]: v } }));
  const setColor = (k: keyof ThemeColors, v: string) => setConfig((p) => ({ ...p, theme: { ...p.theme, [k]: v } }));
  const text = (k: keyof Identity) => ({
    value: String(id[k]),
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  const activePreset = PALETTE_PRESETS.find((p) => JSON.stringify(p.colors) === JSON.stringify(config.theme))?.id;

  return (
    <div className="a-grid">
      <Card title="Marca" desc="Nome, assinatura e textos principais do portal.">
        <div className="a-form">
          <Field label="Nome do hotel">
            <Input {...text('name')} />
          </Field>
          <Field label="Nome curto (cabeçalho)">
            <Input {...text('shortName')} />
          </Field>
          <Field label="Monograma" hint={id.logo ? 'Usado quando não há logo' : '2–3 letras'}>
            <Input {...text('monogram')} maxLength={3} />
          </Field>
          <ImageField
            label="Logo do hotel"
            preset="logo"
            name="logo"
            value={id.logo}
            onChange={(v) => set('logo', v)}
            emptyText="Sem logo"
            hint="Quando definida, substitui o monograma em todo o portal"
          />
          <Field label="Subtítulo / Região">
            <Input {...text('subtitle')} />
          </Field>
          <Field label="Título do banner" wide>
            <Input {...text('heroTitle')} />
          </Field>
          <Field label="Texto de boas-vindas" wide>
            <Textarea {...text('heroSubtitle')} />
          </Field>
          <Field label="Tagline (rodapé)" wide>
            <Input {...text('tagline')} />
          </Field>
        </div>
      </Card>

      <Card title="Contato & Operação" desc="Usado no atendimento rápido e no Wi-Fi.">
        <div className="a-form">
          <Field label="WhatsApp da recepção" hint="Somente números, com DDI e DDD">
            <Input {...text('whatsapp')} inputMode="numeric" onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Ramal interno">
            <Input {...text('extension')} />
          </Field>
          <Field label="Rede Wi-Fi">
            <Input {...text('wifiNetwork')} />
          </Field>
          <Field label="Senha Wi-Fi">
            <Input {...text('wifiPassword')} />
          </Field>
          <Field label="Check-in">
            <Input {...text('checkIn')} />
          </Field>
          <Field label="Check-out">
            <Input {...text('checkOut')} />
          </Field>
          <Field label="Cidade">
            <Input {...text('city')} />
          </Field>
          <Field label="Estado / Região">
            <Input {...text('region')} />
          </Field>
          <Field label="Latitude" hint="Para o clima ao vivo">
            <Input type="number" step="0.0001" value={id.latitude} onChange={(e) => set('latitude', Number(e.target.value))} />
          </Field>
          <Field label="Longitude">
            <Input type="number" step="0.0001" value={id.longitude} onChange={(e) => set('longitude', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Imagens" desc="Envie as fotos do seu computador ou celular — elas são otimizadas automaticamente.">
        <div className="a-form">
          <ImageField
            label="Imagem do banner principal"
            preset="hero"
            name="hero"
            value={id.heroImage}
            onChange={(v) => set('heroImage', v)}
          />
          <ImageField
            label="Imagem do rodapé"
            preset="photo"
            name="footer"
            size="short"
            value={id.footerImage}
            onChange={(v) => set('footerImage', v)}
          />
        </div>
      </Card>

      <Card title="Paleta de cores" desc="Presets de 1 clique ou cores personalizadas.">
        <div className="a-presets">
          {PALETTE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`a-preset ${activePreset === p.id ? 'on' : ''}`}
              onClick={() => setConfig((c) => ({ ...c, theme: p.colors }))}
            >
              <span className="a-preset-sw">
                <i style={{ background: p.colors.primary }} />
                <i style={{ background: p.colors.accent }} />
                <i style={{ background: p.colors.bg }} />
              </span>
              <span>{p.label}</span>
              {activePreset === p.id && <Check size={16} className="a-preset-check" />}
            </button>
          ))}
        </div>
        <div className="a-colors">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="a-color">
              <input type="color" value={config.theme[f.key]} onChange={(e) => setColor(f.key, e.target.value)} />
              <span>
                <strong>{f.label}</strong>
                <code>{config.theme[f.key].toUpperCase()}</code>
              </span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
