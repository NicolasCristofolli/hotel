import { CalendarPlus, Download, Info, MessageCircle, MousePointerClick, Sparkles, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { store, type AnalyticsType } from '../../lib/analytics';
import { generateDemoData } from '../../lib/analyticsDemo';
import { addDays, dayKeyUTC, loadReport, parseDay, RAW_RETENTION_DAYS, type Report, type ReportTarget } from '../../lib/reports';
import { useAdminAccess } from '../../state/AdminAccess';
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

/** Days covered by each period, counted back from today (in the hotel's time zone); null = everything. */
const PERIOD_DAYS: Record<Period, number | null> = { today: 1, '7d': 7, '30d': 30, all: null };

const REQUEST_TYPES: AnalyticsType[] = ['request', 'booking', 'whatsapp'];

type Row = { id: string; label: string; n: number; note?: string };

/** Ranking by item, from the report's per-item totals. Bookings are kept apart from service views. */
function rank(targets: ReportTarget[], types: AnalyticsType[], labelFor?: (t: ReportTarget) => string): Row[] {
  const m = new Map<string, Row>();
  for (const t of targets) {
    if (!types.includes(t.type as AnalyticsType)) continue;
    const id = `${t.type === 'booking' ? 'b:' : ''}${t.target}`;
    const cur = m.get(id) ?? { id, label: '', n: 0 };
    m.set(id, { id, label: labelFor ? labelFor(t) : t.label, n: cur.n + t.n });
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

export function ReportsTab() {
  const { config } = useHotel();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('7d');
  const [report, setReport] = useState<Report | null>(null);
  const [tick, setTick] = useState(0);
  const [loadError, setLoadError] = useState('');
  const { canEdit } = useAdminAccess();

  const days = PERIOD_DAYS[period];

  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let alive = true;
    loadReport(days)
      .then((r) => alive && (setReport(r), setLoadError('')))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [tick, days]);

  const totals = report?.totals ?? {};
  const sum = (t: Record<string, number> | null | undefined, types: AnalyticsType[]) =>
    t ? types.reduce((n, k) => n + Number(t[k] ?? 0), 0) : null;
  const kpis = [
    { label: 'Acessos ao portal', icon: Users, types: ['session'] as AnalyticsType[] },
    { label: 'Cliques em atalhos', icon: MousePointerClick, types: ['shortcut'] as AnalyticsType[] },
    { label: 'Pedidos à recepção', icon: MessageCircle, types: REQUEST_TYPES },
    { label: 'Eventos na agenda', icon: CalendarPlus, types: ['calendar'] as AnalyticsType[] },
  ].map((k) => ({ ...k, value: sum(totals, k.types)!, before: sum(report?.prevTotals, k.types) }));
  const hasData = Object.keys(totals).length > 0;

  const targets = report?.targets ?? [];
  const shortcuts = rank(targets, ['shortcut']);
  const requests = rank(targets, REQUEST_TYPES, (t) =>
    t.type === 'booking' ? `Reserva • ${t.label}` : t.type === 'whatsapp' ? 'Conversa livre no WhatsApp' : t.label,
  );
  const services = rank(targets, ['service', 'booking']);
  const pins = rank(targets, ['pin']);
  const pages = rank(targets, ['page']);

  // Events: interest = added to calendar + "ver no mapa"
  const eventInterest = useMemo(() => {
    const m = new Map<string, { label: string; cal: number; map: number }>();
    for (const t of targets) {
      if (t.type !== 'calendar' && t.type !== 'event_map') continue;
      const cur = m.get(t.target) ?? { label: t.label, cal: 0, map: 0 };
      if (t.type === 'calendar') cur.cal += t.n;
      else cur.map += t.n;
      m.set(t.target, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, label: v.label, n: v.cal + v.map, note: `${v.cal} na agenda • ${v.map} no mapa` }))
      .sort((a, b) => b.n - a.n);
  }, [targets]);

  const byHour = (report?.byHour ?? Array.from({ length: 24 }, () => 0)).map((n, i) => ({
    key: String(i),
    label: `${String(i).padStart(2, '0')}h`,
    n,
    tip: `${n} interações entre ${i}h e ${i + 1}h`,
  }));

  const byDay = useMemo(() => {
    if (!report || days === 1) return [];
    // Calendar days in the hotel's time zone (as returned by the report); "Tudo" shows up to the last 365.
    const end = parseDay(report.today).getTime();
    const span = days ?? Math.min(365, report.first ? Math.round((end - parseDay(report.first).getTime()) / DAY) + 1 : 1);
    const counts = new Map(report.byDay.map((d) => [d.day, d.n]));
    return Array.from({ length: span }, (_, i) => {
      const ms = addDays(report.today, i - span + 1);
      const n = counts.get(dayKeyUTC(ms)) ?? 0;
      const d = new Date(ms);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
      const wd = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
      return { key: String(i), label, n, tip: `${wd} ${label} • ${n} acessos` };
    });
  }, [report, days]);

  // Detail export: individual clicks (kept for RAW_RETENTION_DAYS in the database).
  const exportCsv = async () => {
    try {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const from = days === null ? 0 : midnight - (days - 1) * DAY;
      const since = store.local ? from : Math.max(from, midnight - RAW_RETENTION_DAYS * DAY);
      const events = await store.query(since);
      if (!events.length) return toast('Nada para exportar', 'Sem cliques individuais neste período');
      const rows = [
        ['data_hora', 'tipo', 'id', 'nome', 'visita'],
        ...events.map((e) => [new Date(e.ts).toISOString(), e.type, e.target, e.label, e.sid]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      toast('Não foi possível exportar', (e as Error).message);
    }
  };

  const onDemo = () => {
    generateDemoData(config);
    toast('Dados de exemplo gerados', '30 dias de uso simulado');
  };
  const onClear = async () => {
    const msg = store.local
      ? 'Apagar todos os dados de uso registrados neste navegador?'
      : 'Apagar PERMANENTEMENTE todo o histórico de uso de todos os hóspedes? Exporte o CSV antes se quiser guardar.';
    if (!confirm(msg)) return;
    try {
      await store.clear();
      setTick((t) => t + 1);
      toast('Dados apagados');
    } catch (e) {
      toast('Não foi possível apagar', (e as Error).message);
    }
  };

  return (
    <div className="r-wrap">
      <div className="r-toolbar">
        <Segmented value={period} options={PERIODS} onChange={setPeriod} />
        <span className="grow" />
        {store.local && (
          <button className="a-btn a-btn-outline" onClick={onDemo}>
            <Sparkles size={16} /> Gerar dados de exemplo
          </button>
        )}
        <button
          className="a-btn a-btn-outline"
          onClick={exportCsv}
          disabled={!hasData}
          title={store.local ? undefined : `Cliques individuais dos últimos ${RAW_RETENTION_DAYS} dias`}
        >
          <Download size={16} /> Exportar CSV
        </button>
        {canEdit && (
          <button className="a-btn a-btn-ghost r-clear" onClick={onClear} disabled={!report || report.first === null}>
            <Trash2 size={16} /> Limpar
          </button>
        )}
      </div>

      {loadError && (
        <div className="a-alert" role="alert">
          Não foi possível carregar os relatórios: {loadError}
        </div>
      )}

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
