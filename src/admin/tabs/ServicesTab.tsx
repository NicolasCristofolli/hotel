import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { StatusPill } from '../../components/StatusPill';
import { Icon } from '../../lib/icons';
import { fmtRange, getServiceStatus } from '../../lib/status';
import { useHotel, useNow } from '../../state/HotelContext';
import type { Service, StatusOverride } from '../../types';
import { CATEGORIES } from '../../views/ServicesView';
import { Card, Field, Input, Segmented, Textarea, Toggle } from '../ui';

const OVERRIDES: { value: StatusOverride; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'open', label: 'Aberto Agora' },
  { value: 'closed', label: 'Fechado' },
  { value: 'maintenance', label: 'Em Manutenção' },
  { value: 'appointment', label: 'Agendamento' },
];

export function ServicesTab() {
  const { config, setConfig } = useHotel();
  const now = useNow();
  const [editing, setEditing] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Service>) =>
    setConfig((p) => ({ ...p, services: p.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  return (
    <div className="a-stack">
      {CATEGORIES.filter((c) => c.id !== 'todos').map((cat) => {
        const services = config.services.filter((s) => s.category === cat.id);
        if (!services.length) return null;
        return (
          <Card key={cat.id} title={cat.label} desc={`${services.length} espaço(s)`}>
            <ul className="a-list">
              {services.map((s) => {
                const open = editing === s.id;
                return (
                  <li key={s.id} className={`a-row ${open ? 'is-open' : ''}`}>
                    <div className="a-row-head as-div">
                      <span className="a-row-icon">
                        <Icon name={s.icon} size={18} strokeWidth={1.75} />
                      </span>
                      <span className="a-row-main">
                        <strong>{s.name}</strong>
                        <small>{fmtRange(s.open, s.close)}</small>
                      </span>
                      <StatusPill status={getServiceStatus(s, now)} />
                      <button
                        className="a-icon-btn"
                        onClick={() => setEditing(open ? null : s.id)}
                        aria-label="Editar"
                        aria-expanded={open}
                      >
                        <ChevronDown size={18} className={`a-caret ${open ? 'up' : ''}`} />
                      </button>
                    </div>
                    <div className="a-override">
                      <span className="a-label">Status</span>
                      <Segmented value={s.override} options={OVERRIDES} onChange={(v) => update(s.id, { override: v })} />
                    </div>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          className="a-row-body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <div className="a-form">
                            <Field label="Nome" wide>
                              <Input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
                            </Field>
                            <Field label="Abre às">
                              <Input type="time" value={s.open} onChange={(e) => update(s.id, { open: e.target.value })} />
                            </Field>
                            <Field label="Fecha às" hint="Igual à abertura = 24 horas">
                              <Input type="time" value={s.close} onChange={(e) => update(s.id, { close: e.target.value })} />
                            </Field>
                            <Field label="Descrição" wide>
                              <Textarea value={s.description} onChange={(e) => update(s.id, { description: e.target.value })} />
                            </Field>
                            <Field label="Destaques do menu" hint="Um por linha" wide>
                              <Textarea
                                value={s.highlights.join('\n')}
                                onChange={(e) => update(s.id, { highlights: e.target.value.split('\n') })}
                                onBlur={(e) =>
                                  update(s.id, {
                                    highlights: e.target.value
                                      .split('\n')
                                      .map((x) => x.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Dress code">
                              <Input value={s.dressCode ?? ''} onChange={(e) => update(s.id, { dressCode: e.target.value || undefined })} />
                            </Field>
                            <Field label="Aceita reservas">
                              <div className="a-toggle-row">
                                <Toggle checked={s.bookable} onChange={(v) => update(s.id, { bookable: v })} label="Aceita reservas" />
                                <small>{s.bookable ? 'Botão "Reservar" visível' : 'Sem reservas'}</small>
                              </div>
                            </Field>
                            <Field label="Imagem (URL)" wide>
                              <Input value={s.image} onChange={(e) => update(s.id, { image: e.target.value })} />
                            </Field>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
