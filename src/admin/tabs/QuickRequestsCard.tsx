import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { requestMessage } from '../../lib/actions';
import { Icon, ICON_NAMES } from '../../lib/icons';
import { uid } from '../../lib/status';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import type { QuickRequest } from '../../types';
import { Card, Empty, Field, Input, Select, Toggle } from '../ui';

const MAX_LABEL = 40;

/** Editor for "Pedidos rápidos" in "Falar com a Recepção" — each one opens WhatsApp with a ready message. */
export function QuickRequestsCard() {
  const { config, setConfig } = useHotel();
  const toast = useToast();
  const list = config.quickRequests;

  const save = (fn: (l: QuickRequest[]) => QuickRequest[]) => setConfig((p) => ({ ...p, quickRequests: fn(p.quickRequests) }));
  const update = (id: string, patch: Partial<QuickRequest>) => save((l) => l.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const move = (i: number, dir: -1 | 1) =>
    save((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = () => {
    save((l) => [...l, { id: uid(), label: 'Novo pedido', icon: 'Star', active: true }]);
    toast('Pedido criado', 'Adicionado ao final da lista');
  };
  const remove = (q: QuickRequest) => {
    if (!confirm(`Excluir o pedido "${q.label}"?`)) return;
    save((l) => l.filter((x) => x.id !== q.id));
    toast('Pedido excluído');
  };

  const visible = list.filter((q) => q.active !== false).length;
  const hotelName = config.identity.shortName;

  return (
    <Card
      title="Pedidos rápidos (WhatsApp)"
      desc={`${visible} de ${list.length} visíveis • aparecem em “Falar com a Recepção”. Ao tocar, o hóspede abre o WhatsApp da recepção com a mensagem pronta.`}
      actions={
        <button className="a-btn a-btn-primary" onClick={add}>
          <Plus size={16} /> Novo pedido
        </button>
      }
    >
      {list.length === 0 && <Empty>Nenhum pedido cadastrado — a seção fica oculta no portal.</Empty>}
      <ul className="a-list">
        <AnimatePresence initial={false}>
          {list.map((q, i) => {
            const active = q.active !== false;
            return (
              <motion.li
                key={q.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`a-item a-shortcut ${active ? '' : 'is-off'}`}
              >
                <div className="a-item-side">
                  <button className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima">
                    <ArrowUp size={16} />
                  </button>
                  <span className="a-order">{i + 1}</span>
                  <button className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Mover para baixo">
                    <ArrowDown size={16} />
                  </button>
                </div>
                <div className="a-item-body a-form">
                  <Field label="Pedido" hint={`${q.label.length}/${MAX_LABEL}`}>
                    <Input value={q.label} maxLength={MAX_LABEL} onChange={(e) => update(q.id, { label: e.target.value })} />
                  </Field>
                  <Field label="Ícone">
                    <div className="a-icon-select">
                      <span className="a-row-icon">
                        <Icon name={q.icon} size={18} strokeWidth={1.75} />
                      </span>
                      <Select value={q.icon} onChange={(e) => update(q.id, { icon: e.target.value })}>
                        {ICON_NAMES.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </Select>
                    </div>
                  </Field>
                  <p className="a-hint is-wide a-wa-preview">
                    <MessageCircle size={14} /> {requestMessage(hotelName, q.label.trim() || '…', '101')}
                  </p>
                </div>
                <div className="a-item-actions">
                  <div className="a-toggle-row">
                    <Toggle checked={active} onChange={(v) => update(q.id, { active: v })} label="Visível" />
                    <small>{active ? 'Visível' : 'Oculto'}</small>
                  </div>
                  <button className="a-icon-btn danger" onClick={() => remove(q)} aria-label="Excluir">
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
