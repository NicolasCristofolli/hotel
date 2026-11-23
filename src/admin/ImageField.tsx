import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { ACCEPTED_TYPES, formatBytes, IMAGE_PRESETS, uploadImage, type ImagePreset } from '../lib/assets';
import { useToast } from '../state/ToastContext';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  preset: ImagePreset;
  /** File name prefix in storage (e.g. "hero", "service-spa"). */
  name: string;
  hint?: string;
  /** Text shown when there's no image (e.g. what the portal uses instead). */
  emptyText?: string;
  /** Preview height variant. */
  size?: 'tall' | 'short';
};

/**
 * Upload-only image picker: no URL field — every image goes through compression,
 * so nothing heavy reaches the guest portal.
 */
export function ImageField({ label, value, onChange, preset, name, hint, emptyText = 'Nenhuma imagem', size = 'tall' }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isLogo = preset === 'logo';
  const spec = IMAGE_PRESETS[preset];

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const { url, size } = await uploadImage(file, preset, name);
      onChange(url);
      toast('Imagem atualizada', `${formatBytes(file.size)} → ${formatBytes(size)}`);
    } catch (e) {
      toast('Falha ao enviar a imagem', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const accept = (isLogo ? [...ACCEPTED_TYPES, 'image/svg+xml'] : ACCEPTED_TYPES).join(',');
  const autoHint = `${isLogo ? 'PNG transparente, SVG, JPG ou WebP' : 'JPG, PNG ou WebP'} • redimensionada para até ${spec.maxSide}px e ~${formatBytes(spec.maxBytes)}`;

  return (
    // A <div>, not <Field>'s <label>: clicking the caption must not open the file picker.
    <div className="a-field is-wide">
      <span className="a-label">{label}</span>
      <div className={`a-image ${isLogo ? 'is-logo' : ''}`}>
        <button
          type="button"
          className={`a-image-preview ${size === 'short' ? 'short' : ''} ${value ? '' : 'is-empty'}`}
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={value ? `Trocar ${label}` : `Enviar ${label}`}
        >
          {value ? <img src={value} alt="" /> : <span>{emptyText}</span>}
          {busy && (
            <span className="a-image-busy">
              <Loader2 size={20} className="spin" /> Otimizando…
            </span>
          )}
        </button>
        <div className="a-image-actions">
          <button type="button" className="a-btn a-btn-outline" onClick={() => input.current?.click()} disabled={busy}>
            <ImagePlus size={16} /> {value ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          {value && (
            <button type="button" className="a-btn a-btn-danger" onClick={() => onChange('')} disabled={busy}>
              <Trash2 size={16} /> Remover
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) upload(f);
          }}
        />
      </div>
      <span className="a-hint">{hint ? `${hint} • ${autoHint}` : autoHint}</span>
    </div>
  );
}
