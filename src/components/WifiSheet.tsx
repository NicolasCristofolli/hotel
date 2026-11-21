import { Copy, ScrollText, Wifi } from 'lucide-react';
import { useCallback } from 'react';
import { copyText } from '../lib/actions';
import { useTrack } from '../lib/analytics';
import { useGuest } from '../state/GuestContext';
import { useHotel } from '../state/HotelContext';
import { useToast } from '../state/ToastContext';
import { BottomSheet } from './BottomSheet';

/** Copies the Wi-Fi password, confirms with a toast and opens the Wi-Fi & rules sheet. */
export function useWifiAction() {
  const { config } = useHotel();
  const toast = useToast();
  const { setWifiOpen } = useGuest();
  const track = useTrack();
  return useCallback(async () => {
    track('wifi', 'senha', 'Senha do Wi-Fi copiada');
    const ok = await copyText(config.identity.wifiPassword);
    toast(ok ? 'Senha do Wi-Fi copiada' : 'Senha do Wi-Fi', `Rede: ${config.identity.wifiNetwork}`);
    setWifiOpen(true);
  }, [config.identity.wifiPassword, config.identity.wifiNetwork, toast, setWifiOpen, track]);
}

export function WifiSheet() {
  const { config } = useHotel();
  const { wifiOpen, setWifiOpen } = useGuest();
  const toast = useToast();
  const id = config.identity;

  return (
    <BottomSheet open={wifiOpen} onClose={() => setWifiOpen(false)} label="Wi-Fi e regras">
      <p className="eyebrow">Conectividade</p>
      <h2 className="sheet-title">Wi-Fi & Regras da Casa</h2>

      <div className="wifi-card">
        <div className="wifi-icon">
          <Wifi size={22} strokeWidth={1.5} />
        </div>
        <dl>
          <div>
            <dt>Rede</dt>
            <dd>{id.wifiNetwork}</dd>
          </div>
          <div>
            <dt>Senha</dt>
            <dd className="mono">{id.wifiPassword}</dd>
          </div>
        </dl>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await copyText(id.wifiPassword);
            toast('Senha copiada', 'Cole nas configurações de Wi-Fi');
          }}
        >
          <Copy size={16} strokeWidth={1.5} /> Copiar
        </button>
      </div>

      <h3 className="sheet-sub">
        <ScrollText size={16} strokeWidth={1.5} /> Regras da casa
      </h3>
      <ul className="rule-list">
        {config.houseRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="muted small">
        Check-in a partir das {id.checkIn} • Check-out até {id.checkOut}
      </p>
    </BottomSheet>
  );
}
