import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { storeImage } from '../../lib/assets';
import { useToast } from '../../state/ToastContext';
import { PALETTE_PRESETS } from '../../config/defaultHotelConfig';
import { useHotel } from '../../state/HotelContext';
import type { Identity, ThemeColors } from '../../types';
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
          <LogoField value={id.logo} onChange={(v) => set('logo', v)} />
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

      <Card title="Imagens" desc="Cole URLs de imagens em alta resolução (ex.: Unsplash).">
        <div className="a-form">
          <Field label="Imagem do banner principal" wide>
            <Input {...text('heroImage')} />
          </Field>
          <div className="a-img-preview is-wide" style={{ backgroundImage: `url(${id.heroImage})` }} />
          <Field label="Imagem do rodapé" wide>
            <Input {...text('footerImage')} />
          </Field>
          <div className="a-img-preview is-wide short" style={{ backgroundImage: `url(${id.footerImage})` }} />
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

/** Downscale uploads so they fit comfortably in storage (keeps PNG transparency). */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === 'image/svg+xml') return resolve(src);
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function LogoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const isUrl = value && !value.startsWith('data:');

  const upload = async (f: File) => {
    setUploading(true);
    try {
      onChange(await storeImage(await readLogo(f), 'logo'));
      toast('Logo atualizada');
    } catch (e) {
      toast('Falha ao enviar a logo', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    // A <div>, not <Field>'s <label>: clicking the caption must not open the file picker.
    <div className="a-field is-wide">
      <span className="a-label">Logo do hotel</span>
      <div className="a-logo">
        {value && (
          <div className="a-logo-preview">
            <img src={value} alt="Logo" />
          </div>
        )}
        <div className="a-logo-actions">
          <button type="button" className="a-btn a-btn-outline" onClick={() => input.current?.click()} disabled={uploading}>
            <ImagePlus size={16} /> {uploading ? 'Enviando…' : 'Enviar imagem'}
          </button>
          {value && (
            <button type="button" className="a-btn a-btn-danger" onClick={() => onChange('')}>
              <Trash2 size={16} /> Remover
            </button>
          )}
          <Input placeholder="…ou cole a URL da logo" value={isUrl ? value : ''} onChange={(e) => onChange(e.target.value.trim())} />
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) upload(f);
          }}
        />
      </div>
      <span className="a-hint">PNG transparente ou SVG. Quando definida, substitui o monograma em todo o portal.</span>
    </div>
  );
}
