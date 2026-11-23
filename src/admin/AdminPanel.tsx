import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  Eye,
  History,
  LayoutGrid,
  LogOut,
  Map,
  Megaphone,
  Palette,
  RotateCcw,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { setupSteps } from '../config/starterConfig';
import { GuestApp } from '../GuestApp';
import { MIGRATION_FILE, useSchemaOutdated } from '../lib/schema';
import { supabase } from '../lib/supabase';
import { hotelKey } from '../lib/tenant';
import { useAdminAccess } from '../state/AdminAccess';
import { useHotel } from '../state/HotelContext';
import { ToastProvider, useToast } from '../state/ToastContext';
import { EventsTab } from './tabs/EventsTab';
import { ExperiencesTab } from './tabs/ExperiencesTab';
import { HomeTab } from './tabs/HomeTab';
import { IdentityTab } from './tabs/IdentityTab';
import { MapEditorTab } from './tabs/MapEditorTab';
import { NoticesTab } from './tabs/NoticesTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ServicesTab } from './tabs/ServicesTab';
import { VersionHistory } from './VersionHistory';

const TABS = [
  { id: 'identity', label: 'Identidade & Configurações', short: 'Identidade', icon: Palette, C: IdentityTab },
  { id: 'home', label: 'Painel Inicial', short: 'Início', icon: LayoutGrid, C: HomeTab },
  { id: 'notices', label: 'Recados & Avisos', short: 'Recados', icon: Megaphone, C: NoticesTab },
  { id: 'events', label: 'Programação & Eventos', short: 'Programação', icon: CalendarDays, C: EventsTab },
  { id: 'services', label: 'Horários & Serviços', short: 'Horários', icon: Clock, C: ServicesTab },
  { id: 'experiences', label: 'Experiências', short: 'Experiências', icon: Sparkles, C: ExperiencesTab },
  { id: 'map', label: 'Editor Visual do Mapa', short: 'Mapa', icon: Map, C: MapEditorTab },
  { id: 'reports', label: 'Relatórios', short: 'Relatórios', icon: BarChart3, C: ReportsTab },
] as const;

export function AdminPanel() {
  return (
    <ToastProvider placement="top">
      <AdminInner />
    </ToastProvider>
  );
}

function AdminInner() {
  const { config, reset, sync, retry } = useHotel();
  const { exitAdmin, lock, canEdit, email, role } = useAdminAccess();
  const toast = useToast();
  // Staff accounts only see the reports.
  const tabs = canEdit ? TABS : TABS.filter((t) => t.id === 'reports');
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>(canEdit ? 'identity' : 'reports');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const outdated = useSchemaOutdated();

  // Online: every editing session is kept in the history, which replaces "reset to factory" (that would
  // overwrite a real hotel with the demo hotel). The demo mode keeps the reset.
  const onHistory = () => {
    if (supabase) return setHistoryOpen(true);
    if (confirm('Restaurar os dados de demonstração? As alterações deste navegador serão perdidas.')) {
      reset();
      toast('Dados restaurados', 'Configuração de demonstração aplicada');
    }
  };
  const HistoryIcon = supabase ? History : RotateCcw;
  const historyLabel = supabase ? 'Histórico de versões' : 'Restaurar demonstração';

  return (
    <div className="admin">
      <aside className="a-side">
        <div className="a-brand">
          {config.identity.logo ? (
            <img className="a-brand-logo" src={config.identity.logo} alt="" />
          ) : (
            <span className="a-brand-mark">{config.identity.monogram}</span>
          )}
          <div>
            <strong>{config.identity.shortName}</strong>
            <small>Painel Administrativo</small>
          </div>
        </div>
        <nav className="a-tabs" aria-label="Seções">
          {tabs.map((t) => (
            <button key={t.id} className={`a-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {tab === t.id && (
                <motion.span layoutId="a-tab-bg" className="a-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
              )}
              <t.icon size={18} />
              <span className="a-tab-label">
                <span className="long">{t.label}</span>
                <span className="short">{t.short}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="a-side-foot">
          {canEdit && (
            <button className="a-btn a-btn-ghost" onClick={onHistory}>
              <HistoryIcon size={16} /> {historyLabel}
            </button>
          )}
          {email && (
            <p className="a-user" title={email}>
              {email}
              <small>{ROLE_LABEL[role ?? 'admin']}</small>
            </p>
          )}
          <button className="a-btn a-btn-ghost" onClick={lock}>
            <LogOut size={16} /> Sair do painel
          </button>
        </div>
      </aside>

      <main className="a-main">
        <header className="a-topbar">
          <div>
            <p className="a-crumb">Painel Administrativo</p>
            <h1>{current.label}</h1>
          </div>
          <div className="a-topbar-actions">
            <SyncBadge />
            {canEdit && (
              <button className="a-btn a-btn-outline a-mobile-only" onClick={onHistory} aria-label={historyLabel}>
                <HistoryIcon size={16} /> {supabase ? 'Histórico' : 'Restaurar'}
              </button>
            )}
            <button className="a-btn a-btn-outline a-mobile-only" onClick={lock} aria-label="Sair do painel">
              <LogOut size={16} />
            </button>
            <button className="a-btn a-btn-outline a-preview-toggle" onClick={() => setPreviewOpen(true)}>
              <Smartphone size={16} /> Pré-visualizar
            </button>
            <button className="a-btn a-btn-primary" onClick={exitAdmin}>
              <Eye size={16} /> Ver Portal
            </button>
          </div>
        </header>

        {outdated && (
          <div className="a-alert" role="alert">
            <span>
              {role === 'platform' ? (
                <>
                  <strong>Banco desatualizado:</strong> rode <code>{MIGRATION_FILE}</code> no SQL Editor do Supabase.
                </>
              ) : (
                'O sistema está em atualização. Se algo não salvar, avise o suporte da plataforma.'
              )}
            </span>
          </div>
        )}

        {canEdit && <SetupChecklist onGo={(t) => setTab(t as typeof tab)} />}

        {sync.status === 'error' && (
          <div className="a-alert" role="alert">
            <span>{sync.message}</span>
            <button className="a-btn a-btn-outline" onClick={retry}>
              Tentar de novo
            </button>
          </div>
        )}

        <motion.div
          key={tab}
          className="a-content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <current.C />
        </motion.div>
      </main>

      {/* Live preview — docked on wide screens, modal on smaller ones */}
      <aside className={`a-preview ${previewOpen ? 'is-open' : ''}`}>
        <div className="a-preview-head">
          <span>
            <i className="a-live" /> Pré-visualização ao vivo
          </span>
          <button className="a-btn a-btn-ghost a-preview-close" onClick={() => setPreviewOpen(false)}>
            Fechar
          </button>
        </div>
        <div className="a-phone">
          <GuestApp mode="memory" />
        </div>
      </aside>

      <VersionHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  staff: 'Equipe (relatórios)',
  platform: 'Suporte da plataforma',
  demo: 'Demonstração',
};

function SyncBadge() {
  const { sync } = useHotel();
  const map = {
    local: { cls: 'warn', text: 'Modo local • só neste navegador' },
    loading: { cls: 'busy', text: 'Carregando…' },
    saving: { cls: 'busy', text: 'Salvando…' },
    synced: { cls: '', text: 'Salvo • publicado ao vivo' },
    merged: { cls: '', text: 'Salvo • junto com as alterações de outro admin' },
    error: { cls: 'err', text: 'Não salvo' },
  } as const;
  const m = map[sync.status];
  return (
    <span className={`a-sync ${m.cls}`} title={sync.status === 'error' ? sync.message : undefined}>
      <i /> {m.text}
    </span>
  );
}

/** "Primeiros passos" for a new hotel: what's still missing before the portal goes to guests. Dismissable. */
function SetupChecklist({ onGo }: { onGo: (tab: string) => void }) {
  const { config } = useHotel();
  const key = hotelKey('guia-hospede:setup-dismissed');
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const steps = setupSteps(config);
  const left = steps.filter((s) => !s.done).length;
  if (hidden || left === 0) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };
  return (
    <section className="a-setup" aria-label="Primeiros passos">
      <header>
        <div>
          <strong>Primeiros passos</strong>
          <small>{left === 1 ? 'Falta 1 item' : `Faltam ${left} itens`} antes de divulgar o portal aos hóspedes.</small>
        </div>
        <button className="a-btn a-btn-ghost" onClick={dismiss} aria-label="Ocultar primeiros passos">
          <X size={16} />
        </button>
      </header>
      <ul>
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'done' : ''}>
            <button onClick={() => onGo(s.tab)} disabled={s.done}>
              {s.done ? <CheckCircle2 size={16} /> : <Circle size={16} />} {s.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
