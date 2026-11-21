import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, EyeOff, MapPin, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Icon, ICON_NAMES } from '../../lib/icons';
import { WEEKDAYS_SHORT, uid } from '../../lib/status';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import type { HotelEvent } from '../../types';
import { Card, Empty, Field, Input, Segmented, Select, Textarea } from '../ui';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function EventsTab() {
  const { config, setConfig } = useHotel();
  const toast = useToast();
  const [day, setDay] = useState<number | 'all' | 'drafts'>('all');
  const [editing, setEditing] = useState<string | null>(null);

  const save = (fn: (list: HotelEvent[]) => HotelEvent[]) => setConfig((p) => ({ ...p, events: fn(p.events) }));
  const update = (id: string, patch: Partial<HotelEvent>) => save((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const list = config.events
    .filter((e) => (day === 'all' ? true : day === 'drafts' ? e.draft : e.days.includes(day)))
    .sort((a, b) => a.time.localeCompare(b.time));
  const draftCount = config.events.filter((e) => e.draft).length;

  const add = () => {
    const id = uid();
    save((l) => [
      ...l,
      {
        id,
        title: 'Nova atividade',
        time: '10:00',
        days: typeof day === 'number' ? [day] : [new Date().getDay()],
        location: 'Lobby',
        pinId: 'p1',
        description: 'Descreva a atividade.',
        icon: 'Star',
        draft: true,
      },
    ]);
    setEditing(id);
    toast('Rascunho criado', 'Os hóspedes só verão a atividade depois de publicada');
  };

  const remove = (e: HotelEvent) => {
    if (!confirm(`Excluir "${e.title}"?`)) return;
    save((l) => l.filter((x) => x.id !== e.id));
    toast('Atividade excluída');
  };

  const setDraft = (e: HotelEvent, draft: boolean) => {
    update(e.id, { draft });
    toast(
      draft ? 'Movido para rascunho' : 'Atividade publicada',
      draft ? 'Oculto para os hóspedes, mas salvo' : 'Já aparece na Programação',
    );
  };

  const toggleDay = (e: HotelEvent, d: number) => {
    const days = e.days.includes(d) ? e.days.filter((x) => x !== d) : [...e.days, d];
    if (days.length) update(e.id, { days });
  };

  return (
    <Card
      title="Agenda semanal"
      desc="Atividades publicadas aparecem na Programação conforme os dias da semana. Rascunhos ficam salvos, mas ocultos para os hóspedes."
      actions={
        <button className="a-btn a-btn-primary" onClick={add}>
          <Plus size={16} /> Nova atividade
        </button>
      }
    >
      <div className="a-chips">
        <button className={`a-chip ${day === 'all' ? 'on' : ''}`} onClick={() => setDay('all')}>
          Todos os dias
        </button>
        {DAY_ORDER.map((d) => (
          <button key={d} className={`a-chip ${day === d ? 'on' : ''}`} onClick={() => setDay(d)}>
            {WEEKDAYS_SHORT[d]}
            <small>{config.events.filter((e) => e.days.includes(d)).length}</small>
          </button>
        ))}
        <button className={`a-chip a-chip-draft ${day === 'drafts' ? 'on' : ''}`} onClick={() => setDay('drafts')}>
          <EyeOff size={13} /> Rascunhos
          <small>{draftCount}</small>
        </button>
      </div>

      {list.length === 0 && <Empty>{day === 'drafts' ? 'Nenhum rascunho salvo.' : 'Nenhuma atividade neste dia.'}</Empty>}

      <ul className="a-list">
        {list.map((e) => {
          const open = editing === e.id;
          const pin = config.pins.find((p) => p.id === e.pinId);
          return (
            <motion.li layout key={e.id} className={`a-row ${open ? 'is-open' : ''} ${e.draft ? 'is-draft' : ''}`}>
              <button className="a-row-head" onClick={() => setEditing(open ? null : e.id)} aria-expanded={open}>
                <span className="a-time">{e.time}</span>
                <span className="a-row-icon">
                  <Icon name={e.icon} size={18} strokeWidth={1.75} />
                </span>
                <span className="a-row-main">
                  <strong>
                    {e.title}
                    {e.draft && <span className="a-badge-draft">Rascunho</span>}
                  </strong>
                  <small>
                    {pin && (
                      <>
                        <MapPin size={12} /> {pin.number} •{' '}
                      </>
                    )}
                    {e.location} •{' '}
                    {e.days.length === 7
                      ? 'Diariamente'
                      : DAY_ORDER.filter((d) => e.days.includes(d))
                          .map((d) => WEEKDAYS_SHORT[d])
                          .join(', ')}
                  </small>
                </span>
                <ChevronDown size={18} className={`a-caret ${open ? 'up' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    className="a-row-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <div className="a-form">
                      <Field
                        label="Status"
                        wide
                        group
                        hint={e.draft ? 'Salvo, mas oculto para os hóspedes.' : 'Visível na Programação do portal.'}
                      >
                        <Segmented
                          value={e.draft ? 'draft' : 'published'}
                          options={[
                            { value: 'published', label: 'Publicado' },
                            { value: 'draft', label: 'Rascunho' },
                          ]}
                          onChange={(v) => setDraft(e, v === 'draft')}
                        />
                      </Field>
                      <Field label="Título" wide>
                        <Input value={e.title} onChange={(ev) => update(e.id, { title: ev.target.value })} />
                      </Field>
                      <Field label="Horário">
                        <Input type="time" value={e.time} onChange={(ev) => update(e.id, { time: ev.target.value })} />
                      </Field>
                      <Field label="Ícone">
                        <Select value={e.icon} onChange={(ev) => update(e.id, { icon: ev.target.value })}>
                          {ICON_NAMES.map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Dias da semana" wide group>
                        <div className="a-days">
                          {DAY_ORDER.map((d) => (
                            <button type="button" key={d} className={e.days.includes(d) ? 'on' : ''} onClick={() => toggleDay(e, d)}>
                              {WEEKDAYS_SHORT[d]}
                            </button>
                          ))}
                          <button type="button" className="a-days-all" onClick={() => update(e.id, { days: [0, 1, 2, 3, 4, 5, 6] })}>
                            Todos
                          </button>
                        </div>
                      </Field>
                      <Field label="Local (texto)">
                        <Input value={e.location} onChange={(ev) => update(e.id, { location: ev.target.value })} />
                      </Field>
                      <Field label="Pino no mapa">
                        <Select value={e.pinId ?? ''} onChange={(ev) => update(e.id, { pinId: ev.target.value || undefined })}>
                          <option value="">— Sem pino —</option>
                          {[...config.pins]
                            .sort((a, b) => a.number - b.number)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.number}. {p.name}
                              </option>
                            ))}
                        </Select>
                      </Field>
                      <Field label="Descrição" wide>
                        <Textarea value={e.description} onChange={(ev) => update(e.id, { description: ev.target.value })} />
                      </Field>
                    </div>
                    <div className="a-row-foot">
                      <button className="a-btn a-btn-danger" onClick={() => remove(e)}>
                        <Trash2 size={16} /> Excluir
                      </button>
                      <span className="grow" />
                      {e.draft ? (
                        <button className="a-btn a-btn-primary" onClick={() => setDraft(e, false)}>
                          <Send size={16} /> Publicar
                        </button>
                      ) : (
                        <button className="a-btn a-btn-outline" onClick={() => setDraft(e, true)}>
                          <EyeOff size={16} /> Mover para rascunho
                        </button>
                      )}
                      <button className="a-btn a-btn-outline" onClick={() => setEditing(null)}>
                        Concluir
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}
