import { safeExternalUrl } from '../../lib/safeUrl';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Icon, ICON_NAMES } from '../../lib/icons';
import { ROUTE_OPTIONS } from '../../lib/quickActions';
import { uid } from '../../lib/status';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import type { QuickAction, QuickActionKind } from '../../types';
import { Card, Empty, Field, Input, Select, Toggle } from '../ui';
import { QuickRequestsCard } from './QuickRequestsCard';

const KINDS: { value: QuickActionKind; label: string }[] = [
  { value: 'route', label: 'Abrir página do portal' },
  { value: 'wifi', label: 'Mostrar Wi-Fi & Regras' },
  { value: 'contact', label: 'Falar com a Recepção' },
  { value: 'url', label: 'Abrir link externo' },
];

export function HomeTab() {
  return (
    <div className="a-stack">
      <ShortcutsCard />
      <QuickRequestsCard />
    </div>
  );
}

/** Editor for the shortcut grid on the guest home ("Sua estadia, em um toque") — also used by the side menu. */
function ShortcutsCard() {
  const { config, setConfig } = useHotel();
  const toast = useToast();
  const actions = config.quickActions;

  const save = (fn: (l: QuickAction[]) => QuickAction[]) => setConfig((p) => ({ ...p, quickActions: fn(p.quickActions) }));
  const update = (id: string, patch: Partial<QuickAction>) => save((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const move = (i: number, dir: -1 | 1) =>
    save((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = () => {
    save((l) => [
      ...l,
      { id: uid(), label: 'Novo atalho', hint: 'Descrição curta', icon: 'Star', kind: 'route', target: 'servicos', active: true },
    ]);
    toast('Atalho criado', 'Adicionado ao final do painel');
  };
  const remove = (a: QuickAction) => {
    if (!confirm(`Excluir o atalho "${a.label}"?`)) return;
    save((l) => l.filter((x) => x.id !== a.id));
    toast('Atalho excluído');
  };

  // Every page a shortcut can point to: fixed sections + experiences + individual services + map pins.
  const routeOptions = [
    ...ROUTE_OPTIONS,
    ...config.experiences.map((e) => ({ value: `experience/${e.id}`, label: `Experiência • ${e.title}` })),
    ...config.services.map((s) => ({ value: `servicos/${s.id}`, label: `Serviço • ${s.name}` })),
    ...[...config.pins].sort((a, b) => a.number - b.number).map((p) => ({ value: `mapa/${p.id}`, label: `Mapa • ${p.number}. ${p.name}` })),
  ];

  const activeCount = actions.filter((a) => a.active).length;

  return (
    <Card
      title="Atalhos do painel inicial"
      desc={`${activeCount} de ${actions.length} visíveis • exibidos em “Sua estadia, em um toque” e no menu lateral, na ordem abaixo.`}
      actions={
        <button className="a-btn a-btn-primary" onClick={add}>
          <Plus size={16} /> Novo atalho
        </button>
      }
    >
      {actions.length === 0 && <Empty>Nenhum atalho cadastrado.</Empty>}
      <ul className="a-list">
        <AnimatePresence initial={false}>
          {actions.map((a, i) => {
            const custom = a.kind === 'route' && !routeOptions.some((o) => o.value === a.target);
            return (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`a-item a-shortcut ${a.active ? '' : 'is-off'}`}
              >
                <div className="a-item-side">
                  <button className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima">
                    <ArrowUp size={16} />
                  </button>
                  <span className="a-order">{i + 1}</span>
                  <button
                    className="a-icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === actions.length - 1}
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
                <div className="a-item-body a-form">
                  <Field label="Título">
                    <Input value={a.label} onChange={(e) => update(a.id, { label: e.target.value })} />
                  </Field>
                  <Field label="Subtítulo">
                    <Input value={a.hint} onChange={(e) => update(a.id, { hint: e.target.value })} />
                  </Field>
                  <Field label="Ícone">
                    <div className="a-icon-select">
                      <span className="a-row-icon">
                        <Icon name={a.icon} size={18} strokeWidth={1.75} />
                      </span>
                      <Select value={a.icon} onChange={(e) => update(a.id, { icon: e.target.value })}>
                        {ICON_NAMES.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </Select>
                    </div>
                  </Field>
                  <Field label="Ao tocar">
                    <Select
                      value={a.kind}
                      onChange={(e) => {
                        const kind = e.target.value as QuickActionKind;
                        update(a.id, { kind, target: kind === 'route' ? 'servicos' : kind === 'url' ? 'https://' : '' });
                      }}
                    >
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {a.kind === 'route' && (
                    <Field label="Página de destino" wide>
                      <Select value={custom ? '' : a.target} onChange={(e) => update(a.id, { target: e.target.value })}>
                        {custom && <option value="">Personalizado: {a.target}</option>}
                        {routeOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {a.kind === 'url' && (
                    <Field
                      label="Link (URL)"
                      wide
                      hint={
                        a.target && a.target !== 'https://' && !safeExternalUrl(a.target)
                          ? '⚠ Link inválido: use um endereço começando com https:// — ele não vai abrir para os hóspedes.'
                          : 'Abre em nova aba — ex.: cardápio em PDF, site de reservas, Instagram'
                      }
                    >
                      <Input type="url" value={a.target} onChange={(e) => update(a.id, { target: e.target.value.trim() })} />
                    </Field>
                  )}
                </div>
                <div className="a-item-actions">
                  <div className="a-toggle-row">
                    <Toggle checked={a.active} onChange={(v) => update(a.id, { active: v })} label="Visível" />
                    <small>{a.active ? 'Visível' : 'Oculto'}</small>
                  </div>
                  <button className="a-icon-btn danger" onClick={() => remove(a)} aria-label="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
