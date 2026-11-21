import { CalendarPlus, Download, Info, MessageCircle, MousePointerClick, Sparkles, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { store, type AnalyticsEvent, type AnalyticsType } from '../../lib/analytics';
import { generateDemoData } from '../../lib/analyticsDemo';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import { Card, Empty, Segmented } from '../ui';

type Period = 'today' | '7d' | '30d' | 'all';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];
const DAY = 86_400_000;

function periodStart(p: Period, now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (p === 'today') return midnight;
  if (p === '7d') return midnight - 6 * DAY;
  if (p === '30d') return midnight - 29 * DAY;
  return 0;
}

const REQUEST_TYPES: AnalyticsType[] = ['request', 'booking', 'whatsapp'];

/** Count by target (keeping the most recent label), sorted desc. */
function rank(events: AnalyticsEvent[], types: AnalyticsType[], labelFor?: (e: AnalyticsEvent) => string) {
  const m = new Map<string, { label: string; n: number }>();
  for (const e of events) {
    if (!types.includes(e.type)) continue;
    const k = `${e.type === 'booking' ? 'b:' : ''}${e.target}`;
    const cur = m.get(k) ?? { label: '', n: 0 };
    m.set(k, { label: labelFor ? labelFor(e) : e.label, n: cur.n + 1 });
  }
  return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n);
}

export function ReportsTab() {
  const { config } = useHotel();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('7d');
  const [all, setAll] = useState<AnalyticsEvent[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let alive = true;
    store.query(0).then((d) => alive && setAll(d));
    return () => {
      alive = false;
    };
  }, [tick]);

  const from = periodStart(period);
  const events = useMemo(() => all.filter((e) => e.ts >= from), [all, from]);

  // Previous equal-length window → trend on the KPI tiles
  const prev = useMemo(() => {
    if (period === 'all') return null;
    const len = period === 'today' ? DAY : (period === '7d' ? 7 : 30) * DAY;
    return all.filter((e) => e.ts >= from - len && e.ts < from);
  }, [all, from, period]);

  const count = (list: AnalyticsEvent[] | null, types: AnalyticsType[]) =>
    list ? list.filter((e) => types.includes(e.type)).length : null;
  const kpis = [
    { label: 'Acessos ao portal', icon: Users, types: ['session'] as AnalyticsType[] },
    { label: 'Cliques em atalhos', icon: MousePointerClick, types: ['shortcut'] as AnalyticsType[] },
    { label: 'Pedidos à recepção', icon: MessageCircle, types: REQUEST_TYPES },
    { label: 'Eventos na agenda', icon: CalendarPlus, types: ['calendar'] as AnalyticsType[] },
  ].map((k) => ({ ...k, value: count(events, k.types)!, before: count(prev, k.types) }));

  const shortcuts = rank(events, ['shortcut']);
  const requests = rank(events, REQUEST_TYPES, (e) =>
    e.type === 'booking' ? `Reserva • ${e.label}` : e.type === 'whatsapp' ? 'Conversa livre no WhatsApp' : e.label,
  );
  const services = rank(events, ['service', 'booking'], (e) => e.label);
  const pins = rank(events, ['pin']);
  const pages = rank(events, ['page']);

  // Events: interest = added to calendar + "ver no mapa"
  const eventInterest = useMemo(() => {
    const m = new Map<string, { label: string; cal: number; map: number }>();
    for (const e of events) {
      if (e.type !== 'calendar' && e.type !== 'event_map') continue;
      const cur = m.get(e.target) ?? { label: e.label, cal: 0, map: 0 };
      if (e.type === 'calendar') cur.cal++;
      else cur.map++;
      cur.label = e.label;
      m.set(e.target, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, label: v.label, n: v.cal + v.map, note: `${v.cal} na agenda • ${v.map} no mapa` }))
      .sort((a, b) => b.n - a.n);
  }, [events]);

  const byHour = useMemo(() => {
    const h = Array.from({ length: 24 }, () => 0);
    for (const e of events) if (e.type !== 'page') h[new Date(e.ts).getHours()]++;
    return h.map((n, i) => ({
      key: String(i),
      label: `${String(i).padStart(2, '0')}h`,
      n,
      tip: `${n} interações entre ${i}h e ${i + 1}h`,
    }));
  }, [events]);

  const byDay = useMemo(() => {
    if (period === 'today') return [];
    const start = period === 'all' ? (events.length ? Math.min(...events.map((e) => e.ts)) : Date.now()) : from;
    const first = new Date(start);
    first.setHours(0, 0, 0, 0);
    const days = Math.min(90, Math.floor((Date.now() - first.getTime()) / DAY) + 1);
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(first.getTime() + i * DAY);
      return { d, n: 0 };
    });
    for (const e of events) {
      if (e.type !== 'session') continue;
      const i = Math.floor((e.ts - first.getTime()) / DAY);
      if (buckets[i]) buckets[i].n++;
    }
    return buckets.map((b, i) => {
      const label = b.d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const wd = b.d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return { key: String(i), label, n: b.n, tip: `${wd} ${label} • ${b.n} acessos` };
    });
  }, [events, period, from]);

  const exportCsv = () => {
    const rows = [
      ['data_hora', 'tipo', 'id', 'nome', 'visita'],
      ...events.map((e) => [new Date(e.ts).toISOString(), e.type, e.target, e.label, e.sid]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onDemo = () => {
    generateDemoData(config);
    toast('Dados de exemplo gerados', '30 dias de uso simulado');
  };
  const onClear = async () => {
    if (!confirm('Apagar todos os dados de uso registrados?')) return;
    await store.clear();
    toast('Dados apagados');
  };

  return (
    <div className="r-wrap">
      <div className="r-toolbar">
        <Segmented value={period} options={PERIODS} onChange={setPeriod} />
        <span className="grow" />
        {all.length === 0 && (
          <button className="a-btn a-btn-outline" onClick={onDemo}>
            <Sparkles size={16} /> Gerar dados de exemplo
          </button>
        )}
        <button className="a-btn a-btn-outline" onClick={exportCsv} disabled={!events.length}>
          <Download size={16} /> Exportar CSV
        </button>
        <button className="a-btn a-btn-ghost r-clear" onClick={onClear} disabled={!all.length}>
          <Trash2 size={16} /> Limpar
        </button>
      </div>

      {store.local && (
        <p className="r-note">
          <Info size={16} />
          <span>
            <strong>Modo local:</strong> por enquanto só aparecem os dados deste navegador. Com o banco online (Supabase), o painel passa a
            somar todos os hóspedes. Dados anônimos: sem nome, telefone ou quarto.
          </span>
        </p>
      )}

      <div className="r-kpis">
        {kpis.map((k) => (
          <div className="r-kpi" key={k.label}>
            <span className="r-kpi-label">
              <k.icon size={15} /> {k.label}
            </span>
            <strong>{k.value.toLocaleString('pt-BR')}</strong>
            <Trend now={k.value} before={k.before} period={period} />
          </div>
        ))}
      </div>

      <div className="r-grid">
        <Card title="Atalhos mais clicados" desc="Painel inicial e menu lateral">
          <Ranking rows={shortcuts} unit="cliques" />
        </Card>
        <Card title="Eventos com mais interesse" desc="Adicionados à agenda + “Ver no mapa”">
          <Ranking rows={eventInterest} unit="interações" />
        </Card>
        <Card title="O que os hóspedes mais pedem" desc="Pedidos rápidos, reservas e conversas pelo WhatsApp">
          <Ranking rows={requests} unit="pedidos" />
        </Card>
        <Card title="Serviços mais procurados" desc="Detalhes abertos + reservas">
          <Ranking rows={services} unit="visualizações" />
        </Card>
        <Card title="Pontos do mapa mais vistos">
          <Ranking rows={pins} unit="visualizações" />
        </Card>
        <Card title="Seções mais acessadas">
          <Ranking rows={pages} unit="visitas" />
        </Card>
        <Card title="Uso por horário" desc="Quando os hóspedes mais interagem com o portal" className="r-span">
          <Columns data={byHour} unit="interações" everyNth={3} />
        </Card>
        {byDay.length > 1 && (
          <Card title="Acessos por dia" className="r-span">
            <Columns data={byDay} unit="acessos" everyNth={byDay.length > 14 ? 5 : 1} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Trend({ now, before, period }: { now: number; before: number | null; period: Period }) {
  if (before === null) return <small className="r-trend">—</small>;
  const ref = period === 'today' ? 'ontem' : 'período anterior';
  if (before === 0)
    return <small className="r-trend">{now ? `novo • sem dados ${period === 'today' ? 'ontem' : 'antes'}` : `igual ao ${ref}`}</small>;
  const pct = Math.round(((now - before) / before) * 100);
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  return (
    <small className={`r-trend ${cls}`}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct)}% vs. {ref}
    </small>
  );
}

function Ranking({
  rows,
  unit,
  limit = 8,
}: {
  rows: { id: string; label: string; n: number; note?: string }[];
  unit: string;
  limit?: number;
}) {
  const [more, setMore] = useState(false);
  if (!rows.length) return <Empty>Sem dados no período.</Empty>;
  const max = rows[0].n;
  const total = rows.reduce((s, r) => s + r.n, 0);
  const shown = more ? rows : rows.slice(0, limit);
  return (
    <>
      <ol className="r-rank">
        {shown.map((r, i) => (
          <li key={r.id} title={`${r.label}: ${r.n} ${unit} (${Math.round((r.n / total) * 100)}%)${r.note ? ` • ${r.note}` : ''}`}>
            <span className="r-rank-pos">{i + 1}</span>
            <div className="r-rank-main">
              <div className="r-rank-text">
                <span className="r-rank-label">{r.label}</span>
                <span className="r-rank-val">
                  {r.n.toLocaleString('pt-BR')}
                  <small>{Math.round((r.n / total) * 100)}%</small>
                </span>
              </div>
              <div className="r-bar">
                <i style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
              {r.note && <small className="r-rank-note">{r.note}</small>}
            </div>
          </li>
        ))}
      </ol>
      {rows.length > limit && (
        <button className="a-btn a-btn-ghost r-more" onClick={() => setMore(!more)}>
          {more ? 'Mostrar menos' : `Ver todos (${rows.length})`}
        </button>
      )}
    </>
  );
}

function Columns({
  data,
  unit,
  everyNth = 1,
}: {
  data: { key: string; label: string; n: number; tip: string }[];
  unit: string;
  everyNth?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.n));
  const peak = data.reduce((best, d, i) => (d.n > data[best].n ? i : best), 0);
  if (!data.some((d) => d.n)) return <Empty>Sem dados no período.</Empty>;
  const h = hover ?? null;
  return (
    <div className="r-cols-wrap">
      <div className="r-cols-head">
        {h !== null ? (
          <span>{data[h].tip}</span>
        ) : (
          <span>
            Pico: <strong>{data[peak].label}</strong> • {data[peak].n} {unit}
          </span>
        )}
      </div>
      <div
        className="r-cols"
        role="img"
        aria-label={`Gráfico de ${unit}. Pico em ${data[peak].label} com ${data[peak].n}.`}
        onMouseLeave={() => setHover(null)}
      >
        <div className="r-cols-grid">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        {data.map((d, i) => (
          <div key={d.key} className={`r-col ${h === i ? 'on' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <i style={{ height: `${(d.n / max) * 100}%` }} />
            <small>{i % everyNth === 0 ? d.label : ''}</small>
          </div>
        ))}
      </div>
      <details className="r-table">
        <summary>Ver como tabela</summary>
        <table>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td>{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
