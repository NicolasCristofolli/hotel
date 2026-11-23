import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Img } from '../../components/Img';
import { Icon, ICON_NAMES } from '../../lib/icons';
import { uid } from '../../lib/status';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import type { Experience, ExperienceItem, HotelConfig } from '../../types';
import { ImageField } from '../ImageField';
import { Card, Empty, Field, Input, Select, Textarea } from '../ui';

/** "Piscina & SPA" → "piscina-spa" (the experience's link: #/experience/<id>). */
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const route = (id: string) => `experience/${id}`;

/** Shortcuts and map points that link to an experience. */
function references(config: HotelConfig, id: string) {
  return {
    actions: config.quickActions.filter((a) => a.kind === 'route' && a.target === route(id)),
    pins: config.pins.filter((p) => p.detailRoute === route(id)),
  };
}

const move = <T,>(list: T[], i: number, d: -1 | 1) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function ExperiencesTab() {
  const { config, setConfig } = useHotel();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);

  const save = (fn: (list: Experience[]) => Experience[]) => setConfig((p) => ({ ...p, experiences: fn(p.experiences) }));
  const update = (id: string, patch: Partial<Experience>) => save((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const uniqueId = (base: string, except?: string) => {
    const taken = new Set(config.experiences.filter((e) => e.id !== except).map((e) => e.id));
    let id = base || 'experiencia';
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  };

  const add = () => {
    const id = uniqueId('nova-experiencia');
    save((l) => [
      ...l,
      {
        id,
        eyebrow: 'Experiência',
        title: 'Nova experiência',
        intro: 'Conte ao hóspede o que torna este espaço especial.',
        image: '',
        items: [{ id: uid(), name: 'Primeiro item', hours: '09h às 18h', icon: 'Star', rules: [] }],
      },
    ]);
    setEditing(id);
    toast('Experiência criada', 'Crie um atalho no Painel Inicial ou um pino no mapa para os hóspedes chegarem até ela');
  };

  const remove = (e: Experience) => {
    const refs = references(config, e.id);
    const linked = [...refs.actions.map((a) => `atalho "${a.label}"`), ...refs.pins.map((p) => `pino "${p.name}"`)];
    const msg = linked.length
      ? `Excluir "${e.title}"?\n\nEstes itens apontam para ela e serão ajustados:\n• ${linked.join('\n• ')}\n\n(Os atalhos ficam desativados e os pinos perdem o "Ver Detalhes".)`
      : `Excluir "${e.title}"?`;
    if (!confirm(msg)) return;
    setConfig((p) => ({
      ...p,
      experiences: p.experiences.filter((x) => x.id !== e.id),
      quickActions: p.quickActions.map((a) => (a.kind === 'route' && a.target === route(e.id) ? { ...a, active: false } : a)),
      pins: p.pins.map((pin) => (pin.detailRoute === route(e.id) ? { ...pin, detailRoute: undefined } : pin)),
    }));
    toast('Experiência excluída');
  };

  /** Changing the link also rewrites every shortcut and map point that pointed to the old one. */
  const rename = (e: Experience, wanted: string) => {
    const id = uniqueId(slugify(wanted), e.id);
    if (id === e.id) return;
    setConfig((p) => ({
      ...p,
      experiences: p.experiences.map((x) => (x.id === e.id ? { ...x, id } : x)),
      quickActions: p.quickActions.map((a) => (a.kind === 'route' && a.target === route(e.id) ? { ...a, target: route(id) } : a)),
      pins: p.pins.map((pin) => (pin.detailRoute === route(e.id) ? { ...pin, detailRoute: route(id) } : pin)),
    }));
    setEditing(id);
    toast('Link atualizado', 'Atalhos e pinos que usavam o link antigo foram ajustados');
  };

  return (
    <Card
      title="Experiências"
      desc="Páginas especiais do portal (ex.: Piscina & SPA, Concierge). Cada uma tem foto de capa, introdução e uma lista de itens com horários e regras."
      actions={
        <button className="a-btn a-btn-primary" onClick={add}>
          <Plus size={16} /> Nova experiência
        </button>
      }
    >
      {config.experiences.length === 0 && <Empty>Nenhuma experiência cadastrada.</Empty>}

      <ul className="a-list">
        {config.experiences.map((e) => {
          const open = editing === e.id;
          const refs = references(config, e.id);
          const linkCount = refs.actions.length + refs.pins.length;
          return (
            <motion.li layout key={e.id} className={`a-row ${open ? 'is-open' : ''}`}>
              <button className="a-row-head" onClick={() => setEditing(open ? null : e.id)} aria-expanded={open}>
                <span className="a-exp-thumb">
                  {e.image ? <Img src={e.image} alt="" /> : <Icon name={e.items[0]?.icon ?? 'Sparkles'} size={18} />}
                </span>
                <span className="a-row-main">
                  <strong>{e.title}</strong>
                  <small>
                    {e.eyebrow} • {e.items.length} {e.items.length === 1 ? 'item' : 'itens'} •{' '}
                    {linkCount ? `${linkCount} link(s) apontam para ela` : 'nenhum atalho ou pino aponta para ela'}
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
                    <ExperienceForm experience={e} update={(patch) => update(e.id, patch)} onRename={(v) => rename(e, v)} />
                    <div className="a-row-foot">
                      <button className="a-btn a-btn-danger" onClick={() => remove(e)}>
                        <Trash2 size={16} /> Excluir
                      </button>
                      <span className="grow" />
                      <a className="a-btn a-btn-outline" href={`#/${route(e.id)}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} /> Ver no portal
                      </a>
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

function ExperienceForm({
  experience: e,
  update,
  onRename,
}: {
  experience: Experience;
  update: (patch: Partial<Experience>) => void;
  onRename: (slug: string) => void;
}) {
  const { config } = useHotel();
  // The link is committed on blur, so typing doesn't rewrite shortcuts on every keystroke.
  const [slug, setSlug] = useState(e.id);
  useEffect(() => setSlug(e.id), [e.id]);

  const setItems = (fn: (items: ExperienceItem[]) => ExperienceItem[]) => update({ items: fn(e.items) });
  const updateItem = (id: string, patch: Partial<ExperienceItem>) =>
    setItems((l) => l.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  return (
    <div className="a-form">
      <ImageField
        label="Foto de capa"
        preset="hero"
        name={`experience-${e.id}`}
        value={e.image}
        onChange={(v) => update({ image: v })}
        emptyText="Sem foto — o portal mostra um fundo na cor do tema"
      />
      <Field label="Título" wide>
        <Input value={e.title} onChange={(ev) => update({ title: ev.target.value })} />
      </Field>
      <Field label="Chamada (acima do título)" hint="Ex.: Bem-Estar, Serviços, Gastronomia">
        <Input value={e.eyebrow} onChange={(ev) => update({ eyebrow: ev.target.value })} />
      </Field>
      <Field label='Pino do "Ver no Mapa"'>
        <Select value={e.pinId ?? ''} onChange={(ev) => update({ pinId: ev.target.value || undefined })}>
          <option value="">— Sem botão de mapa —</option>
          {[...config.pins]
            .sort((a, b) => a.number - b.number)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.number}. {p.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Introdução" wide>
        <Textarea value={e.intro} onChange={(ev) => update({ intro: ev.target.value })} />
      </Field>
      <Field
        label="Link da página"
        wide
        hint={`experience/${slugify(slug) || '…'} — usado em atalhos e pinos; ao mudar, eles são atualizados juntos`}
      >
        <Input
          value={slug}
          onChange={(ev) => setSlug(ev.target.value)}
          onBlur={() => {
            const next = slugify(slug);
            if (next && next !== e.id) onRename(next);
            setSlug(e.id);
          }}
        />
      </Field>

      <div className="a-field is-wide">
        <span className="a-label">Itens ({e.items.length})</span>
        <ul className="a-subitems">
          {e.items.map((it, i) => (
            <li key={it.id} className="a-subitem">
              <div className="a-subitem-head">
                <span className="a-row-icon">
                  <Icon name={it.icon} size={16} strokeWidth={1.75} />
                </span>
                <strong>{it.name || 'Sem nome'}</strong>
                <span className="grow" />
                <button
                  className="a-icon-btn"
                  onClick={() => setItems((l) => move(l, i, -1))}
                  disabled={i === 0}
                  aria-label="Mover para cima"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="a-icon-btn"
                  onClick={() => setItems((l) => move(l, i, 1))}
                  disabled={i === e.items.length - 1}
                  aria-label="Mover para baixo"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="a-icon-btn danger"
                  onClick={() => confirm(`Remover "${it.name}"?`) && setItems((l) => l.filter((x) => x.id !== it.id))}
                  aria-label="Remover item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="a-form">
                <Field label="Nome">
                  <Input value={it.name} onChange={(ev) => updateItem(it.id, { name: ev.target.value })} />
                </Field>
                <Field label="Horário" hint="Texto livre — ex.: 10h às 20h • Mediante agendamento">
                  <Input value={it.hours} onChange={(ev) => updateItem(it.id, { hours: ev.target.value })} />
                </Field>
                <Field label="Ícone">
                  <Select value={it.icon} onChange={(ev) => updateItem(it.id, { icon: ev.target.value })}>
                    {ICON_NAMES.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Regras e detalhes" hint="Um por linha — ex.: preços, idade mínima, lotação" wide>
                  <Textarea
                    value={it.rules.join('\n')}
                    onChange={(ev) => updateItem(it.id, { rules: ev.target.value.split('\n') })}
                    onBlur={(ev) =>
                      updateItem(it.id, {
                        rules: ev.target.value
                          .split('\n')
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="a-btn a-btn-outline a-subitems-add"
          onClick={() => setItems((l) => [...l, { id: uid(), name: 'Novo item', hours: '', icon: 'Star', rules: [] }])}
        >
          <Plus size={16} /> Adicionar item
        </button>
      </div>
    </div>
  );
}
