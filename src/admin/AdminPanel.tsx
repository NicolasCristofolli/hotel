import { motion } from 'framer-motion';
import { BarChart3, CalendarDays, Clock, Eye, LayoutGrid, LogOut, Map, Megaphone, Palette, RotateCcw, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { GuestApp } from '../GuestApp';
import { useAdminAccess } from '../state/AdminAccess';
import { useHotel } from '../state/HotelContext';
import { ToastProvider, useToast } from '../state/ToastContext';
import { EventsTab } from './tabs/EventsTab';
import { HomeTab } from './tabs/HomeTab';
import { IdentityTab } from './tabs/IdentityTab';
import { MapEditorTab } from './tabs/MapEditorTab';
import { NoticesTab } from './tabs/NoticesTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ServicesTab } from './tabs/ServicesTab';

const TABS = [
  { id: 'identity', label: 'Identidade & Configurações', short: 'Identidade', icon: Palette, C: IdentityTab },
  { id: 'home', label: 'Painel Inicial', short: 'Início', icon: LayoutGrid, C: HomeTab },
  { id: 'notices', label: 'Recados & Avisos', short: 'Recados', icon: Megaphone, C: NoticesTab },
  { id: 'events', label: 'Programação & Eventos', short: 'Programação', icon: CalendarDays, C: EventsTab },
  { id: 'services', label: 'Horários & Serviços', short: 'Horários', icon: Clock, C: ServicesTab },
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
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  const onReset = () => {
    if (confirm('Restaurar todos os dados para o padrão de fábrica? As alterações serão perdidas.')) {
      reset();
      toast('Dados restaurados', 'Configuração padrão aplicada');
    }
  };

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
            <button className="a-btn a-btn-ghost" onClick={onReset}>
              <RotateCcw size={16} /> Restaurar Padrão
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
              <button className="a-btn a-btn-outline a-mobile-only" onClick={onReset} aria-label="Restaurar Padrão">
                <RotateCcw size={16} /> Restaurar
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
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  staff: 'Equipe (relatórios)',
  demo: 'Demonstração',
};

function SyncBadge() {
  const { sync } = useHotel();
  const map = {
    local: { cls: 'warn', text: 'Modo local • só neste navegador' },
    loading: { cls: 'busy', text: 'Carregando…' },
    saving: { cls: 'busy', text: 'Salvando…' },
    synced: { cls: '', text: 'Salvo • publicado ao vivo' },
    error: { cls: 'err', text: 'Não salvo' },
  } as const;
  const m = map[sync.status];
  return (
    <span className={`a-sync ${m.cls}`} title={sync.status === 'error' ? sync.message : undefined}>
      <i /> {m.text}
    </span>
  );
}
