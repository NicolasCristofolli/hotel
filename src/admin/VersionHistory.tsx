import { AnimatePresence, motion } from 'framer-motion';
import { History, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HOTEL_ID, supabase } from '../lib/supabase';
import { useHotel } from '../state/HotelContext';
import { useToast } from '../state/ToastContext';

type Version = { id: number; started_at: string; saved_at: string; saved_by_email: string | null; edits: number };

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Hoje, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })}, ${time}`;
};

/**
 * Saved versions of the hotel's content (one per editing session — migrations/0008). Restoring one is
 * saved as a new version, so a restore can itself be undone.
 */
export function VersionHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { restore } = useHotel();
  const toast = useToast();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !supabase) return;
    let alive = true;
    setVersions(null);
    setError('');
    supabase.rpc('hotel_versions', { p_hotel: HOTEL_ID }).then(({ data, error }) => {
      if (!alive) return;
      if (error)
        setError(
          /does not exist|Could not find/i.test(error.message)
            ? 'O histórico ainda não está ativo neste banco (falta rodar a migração 0008).'
            : error.message,
        );
      else setVersions((data as Version[]) ?? []);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onRestore = async (v: Version) => {
    if (!supabase) return;
    if (!confirm(`Voltar o conteúdo do portal para a versão de ${when(v.saved_at)}?\n\nO estado atual continua guardado no histórico.`))
      return;
    setBusy(v.id);
    const { data, error } = await supabase.rpc('hotel_version_config', { p_id: v.id });
    setBusy(null);
    if (error) return setError(error.message);
    try {
      restore(data);
      toast('Versão restaurada', when(v.saved_at));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="a-modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="a-modal-backdrop" onClick={onClose} />
          <motion.div
            className="a-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vh-title"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <header className="a-modal-head">
              <div>
                <h2 id="vh-title">
                  <History size={18} /> Histórico de versões
                </h2>
                <p>Cada sessão de edição fica guardada. Restaurar não apaga nada: o estado atual também fica no histórico.</p>
              </div>
              <button className="a-btn a-btn-ghost" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            {error && <div className="a-alert">{error}</div>}
            {!versions && !error && <p className="a-empty">Carregando…</p>}
            {versions && versions.length === 0 && <p className="a-empty">Nenhuma versão salva ainda.</p>}
            {versions && versions.length > 0 && (
              <ol className="a-versions">
                {versions.map((v, i) => (
                  <li key={v.id}>
                    <div>
                      <strong>
                        {when(v.saved_at)}
                        {i === 0 && <span className="a-tag">Atual</span>}
                      </strong>
                      <small>
                        {v.saved_by_email ?? (v.edits === 0 ? 'Versão inicial' : 'Sistema')}
                        {v.edits > 1 &&
                          ` • ${v.edits} alterações desde ${new Date(v.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </small>
                    </div>
                    {i > 0 && (
                      <button className="a-btn a-btn-outline" disabled={busy !== null} onClick={() => onRestore(v)}>
                        <RotateCcw size={15} /> {busy === v.id ? 'Restaurando…' : 'Restaurar'}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
