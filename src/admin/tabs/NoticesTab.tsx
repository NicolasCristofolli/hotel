import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { uid } from '../../lib/status';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import type { Notice, NoticePriority } from '../../types';
import { Card, Empty, Field, Input, Segmented, Textarea, Toggle } from '../ui';

const PRIORITIES: { value: NoticePriority; label: string }[] = [
  { value: 'aviso', label: 'Aviso' },
  { value: 'evento', label: 'Evento' },
  { value: 'manutencao', label: 'Manutenção' },
];

export function NoticesTab() {
  const { config, setConfig } = useHotel();
  const toast = useToast();
  const notices = config.notices;

  const save = (next: Notice[]) => setConfig((p) => ({ ...p, notices: next }));
  const update = (id: string, patch: Partial<Notice>) => save(notices.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= notices.length) return;
    const next = [...notices];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const add = () => {
    save([
      { id: uid(), title: 'Novo recado', message: 'Escreva aqui a mensagem para os hóspedes.', priority: 'aviso', active: true },
      ...notices,
    ]);
    toast('Recado criado', 'Já está visível no portal');
  };
  const remove = (n: Notice) => {
    if (!confirm(`Excluir o recado "${n.title}"?`)) return;
    save(notices.filter((x) => x.id !== n.id));
    toast('Recado excluído');
  };

  const activeCount = notices.filter((n) => n.active).length;

  return (
    <Card
      title="Recados ao vivo"
      desc={`${activeCount} de ${notices.length} ativos • exibidos no topo do Início, na ordem abaixo.`}
      actions={
        <button className="a-btn a-btn-primary" onClick={add}>
          <Plus size={16} /> Novo recado
        </button>
      }
    >
      {notices.length === 0 && <Empty>Nenhum recado cadastrado.</Empty>}
      <ul className="a-list">
        <AnimatePresence initial={false}>
          {notices.map((n, i) => (
            <motion.li
              key={n.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`a-item notice-${n.priority} ${n.active ? '' : 'is-off'}`}
            >
              <div className="a-item-side">
                <button className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima">
                  <ArrowUp size={16} />
                </button>
                <span className="a-order">{i + 1}</span>
                <button className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === notices.length - 1} aria-label="Mover para baixo">
                  <ArrowDown size={16} />
                </button>
              </div>
              <div className="a-item-body a-form">
                <Field label="Título">
                  <Input value={n.title} onChange={(e) => update(n.id, { title: e.target.value })} />
                </Field>
                <Field label="Prioridade" group>
                  <Segmented value={n.priority} options={PRIORITIES} onChange={(v) => update(n.id, { priority: v })} />
                </Field>
                <Field label="Mensagem" wide>
                  <Textarea value={n.message} rows={2} onChange={(e) => update(n.id, { message: e.target.value })} />
                </Field>
              </div>
              <div className="a-item-actions">
                <div className="a-toggle-row">
                  <Toggle checked={n.active} onChange={(v) => update(n.id, { active: v })} label="Ativo" />
                  <small>{n.active ? 'Ativo' : 'Inativo'}</small>
                </div>
                <button className="a-icon-btn danger" onClick={() => remove(n)} aria-label="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
