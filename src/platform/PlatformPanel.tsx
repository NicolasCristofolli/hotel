import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  Hotel,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Card, Empty, Field, Input, Select, Toggle } from '../admin/ui';
import { MIGRATION_FILE, useSchemaOutdated } from '../lib/schema';
import { RESERVED } from '../lib/tenant';
import { useAdminAccess } from '../state/AdminAccess';
import { ToastProvider, useToast } from '../state/ToastContext';
import {
  platformApi,
  ROLE_OPTIONS,
  toSlug,
  type HotelAdmin,
  type HotelAdminRole,
  type InviteResult,
  type PlatformHotel,
} from './platformApi';
import { PLATFORM_NAME } from './PlatformHome';

const nf = new Intl.NumberFormat('pt-BR');
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "há 3 dias", "ontem", "agora" */
function ago(iso: string | null) {
  if (!iso) return '—';
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [86400 * 30, 'day'],
    [86400 * 365, 'month'],
  ];
  if (Math.abs(s) < 60) return 'agora';
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(s) < steps[i][0]) return rtf.format(Math.round(s / steps[i - 1][0]), steps[i][1]);
  }
  return rtf.format(Math.round(s / (86400 * 365)), 'year');
}

const portalUrl = (id: string) => `${window.location.origin}/${id}`;
const adminUrl = (id: string) => `${portalUrl(id)}#/admin`;

export function PlatformPanel() {
  return (
    <ToastProvider placement="top">
      <PlatformInner />
    </ToastProvider>
  );
}

function PlatformInner() {
  const { email, lock } = useAdminAccess();
  const toast = useToast();
  const [hotels, setHotels] = useState<PlatformHotel[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const outdated = useSchemaOutdated();

  const load = useCallback(async () => {
    try {
      setHotels(await platformApi.hotels());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const list = (hotels ?? []).filter((h) => `${h.name} ${h.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const totalSessions = (hotels ?? []).reduce((n, h) => n + Number(h.sessions_30d), 0);
  const pending = (hotels ?? []).reduce((n, h) => n + h.pending_admins, 0);

  return (
    <div className="pf">
      <header className="pf-top">
        <p className="platform-brand">
          <span className="platform-mark">HG</span> {PLATFORM_NAME}
          <small>Plataforma</small>
        </p>
        <span className="grow" />
        {email && <span className="pf-email">{email}</span>}
        <button className="a-btn a-btn-outline" onClick={lock}>
          <LogOut size={16} /> Sair
        </button>
      </header>

      <main className="pf-main">
        {outdated && (
          <div className="a-alert" role="alert">
            <span>
              <strong>Banco desatualizado:</strong> falta rodar <code>{MIGRATION_FILE}</code> no SQL Editor do Supabase.
            </span>
          </div>
        )}
        {error && (
          <div className="a-alert" role="alert">
            <span>{error}</span>
            <button className="a-btn a-btn-outline" onClick={load}>
              Tentar de novo
            </button>
          </div>
        )}

        <section className="pf-stats">
          <Stat label="Hotéis" value={hotels ? nf.format(hotels.length) : '…'} />
          <Stat label="Acessos de hóspedes (30 dias)" value={hotels ? nf.format(totalSessions) : '…'} />
          <Stat
            label="Média por hotel (30 dias)"
            value={hotels ? nf.format(hotels.length ? Math.round(totalSessions / hotels.length) : 0) : '…'}
          />
          <Stat label="Convites pendentes" value={hotels ? nf.format(pending) : '…'} hint="Admins que ainda não entraram" />
        </section>

        <Card
          title="Hotéis parceiros"
          desc="Cada hotel tem o próprio endereço, painel e administradores."
          actions={
            <>
              <button className="a-btn a-btn-outline" onClick={load} aria-label="Atualizar">
                <RefreshCw size={16} />
              </button>
              <button className="a-btn a-btn-primary" onClick={() => setCreating((v) => !v)}>
                <Plus size={16} /> Novo hotel
              </button>
            </>
          }
        >
          <AnimatePresence initial={false}>
            {creating && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <NewHotel
                  taken={(hotels ?? []).map((h) => h.id)}
                  onCancel={() => setCreating(false)}
                  onCreated={async (id) => {
                    setCreating(false);
                    await load();
                    setOpen(id);
                    toast('Hotel criado', 'Agora convide o administrador dele');
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {(hotels?.length ?? 0) > 4 && (
            <label className="pf-search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar hotel" />
            </label>
          )}

          {!hotels && !error && (
            <Empty>
              <Loader2 size={18} className="spin" /> Carregando…
            </Empty>
          )}
          {hotels && list.length === 0 && <Empty>{query ? 'Nenhum hotel encontrado.' : 'Nenhum hotel cadastrado ainda.'}</Empty>}

          <ul className="a-list">
            {list.map((h) => (
              <HotelRow
                key={h.id}
                hotel={h}
                open={open === h.id}
                onToggle={() => setOpen(open === h.id ? null : h.id)}
                onChanged={load}
                onDeleted={() => {
                  setOpen(null);
                  load();
                }}
              />
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="pf-stat" title={hint}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function NewHotel({ taken, onCancel, onCreated }: { taken: string[]; onCancel: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slug = idTouched ? toSlug(id) : toSlug(name);

  const problem =
    slug.length < 2
      ? ''
      : RESERVED.has(slug)
        ? 'Endereço reservado pela plataforma.'
        : taken.includes(slug)
          ? 'Já existe um hotel com este endereço.'
          : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem || slug.length < 2 || name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      await platformApi.createHotel(slug, name.trim());
      onCreated(slug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="pf-new" onSubmit={submit}>
      <div className="a-form">
        <Field label="Nome do hotel">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Pousada Recanto da Serra" autoFocus required />
        </Field>
        <Field label="Endereço" hint={problem || `${window.location.host}/${slug || '…'} — não dá para mudar depois (QR Codes)`}>
          <Input
            value={idTouched ? id : slug}
            onChange={(e) => {
              setIdTouched(true);
              setId(e.target.value);
            }}
            onBlur={() => setId(slug)}
            aria-invalid={!!problem}
          />
        </Field>
      </div>
      <p className="a-hint pf-new-note">
        O portal começa com o conteúdo de exemplo, já com o nome do hotel. O administrador convidado edita tudo pelo painel.
      </p>
      {error && <p className="pf-error">{error}</p>}
      <div className="a-row-foot pf-new-foot">
        <button type="button" className="a-btn a-btn-outline" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="a-btn a-btn-primary" disabled={busy || !!problem || slug.length < 2 || name.trim().length < 2}>
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Criar hotel
        </button>
      </div>
    </form>
  );
}

function HotelRow({
  hotel: h,
  open,
  onToggle,
  onChanged,
  onDeleted,
}: {
  hotel: PlatformHotel;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  return (
    <li className={`a-row ${open ? 'is-open' : ''}`}>
      <button className="a-row-head" onClick={onToggle} aria-expanded={open}>
        <span className="a-row-icon">
          <Hotel size={18} strokeWidth={1.75} />
        </span>
        <span className="a-row-main">
          <strong>
            {h.name}
            {!h.configured && <span className="a-badge-draft">Conteúdo de exemplo</span>}
          </strong>
          <small>
            /{h.id} • {h.admins} admin{h.admins === 1 ? '' : 's'}
            {h.pending_admins > 0 && ` (${h.pending_admins} pendente${h.pending_admins === 1 ? '' : 's'})`} • último acesso de hóspede{' '}
            {ago(h.last_activity)}
          </small>
        </span>
        <span className="pf-metric">
          <strong>{nf.format(Number(h.sessions_30d))}</strong>
          <small>acessos 30d</small>
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
            <HotelDetail hotel={h} onChanged={onChanged} onDeleted={onDeleted} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function HotelDetail({ hotel: h, onChanged, onDeleted }: { hotel: PlatformHotel; onChanged: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(h.name);
  const [admins, setAdmins] = useState<HotelAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [resetLink, setResetLink] = useState<InviteResult | null>(null);
  const [resetBusy, setResetBusy] = useState('');

  const passwordLink = async (email: string) => {
    setResetBusy(email);
    setResetLink(null);
    try {
      setResetLink(await platformApi.passwordLink(h.id, email));
    } catch (e) {
      toast('Não foi possível gerar o link', (e as Error).message);
    } finally {
      setResetBusy('');
    }
  };

  const loadAdmins = useCallback(async () => {
    try {
      setAdmins(await platformApi.admins(h.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [h.id]);
  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const act = async (fn: () => Promise<unknown>, ok: string, desc?: string) => {
    try {
      await fn();
      toast(ok, desc);
      await loadAdmins();
      onChanged();
    } catch (e) {
      toast('Não foi possível concluir', (e as Error).message);
    }
  };

  const rename = () => {
    if (name.trim() === h.name || name.trim().length < 2) return setName(h.name);
    act(() => platformApi.renameHotel(h.id, name.trim()), 'Nome atualizado');
  };

  const remove = () => {
    const typed = prompt(
      `Excluir "${h.name}" apaga o hotel, os acessos dos administradores dele e os relatórios. Não dá para desfazer.\n\nDigite o endereço do hotel (${h.id}) para confirmar:`,
    );
    if (typed === null) return;
    if (typed.trim() !== h.id) return toast('Exclusão cancelada', 'O endereço digitado não confere');
    platformApi
      .deleteHotel(h.id)
      .then(() => {
        toast('Hotel excluído');
        onDeleted();
      })
      .catch((e: Error) => toast('Não foi possível excluir', e.message));
  };

  return (
    <div className="pf-detail">
      <div className="a-form">
        <Field label="Nome do hotel">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </Field>
        <Field label="Links" group>
          <div className="pf-links">
            <a className="a-btn a-btn-outline" href={portalUrl(h.id)} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Portal
            </a>
            <a className="a-btn a-btn-outline" href={adminUrl(h.id)} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Painel do hotel
            </a>
            <CopyButton text={portalUrl(h.id)} label="Copiar link do portal" />
          </div>
        </Field>
        <Field
          label="Vitrine em hotelguia.com.br"
          group
          hint={
            !h.configured
              ? 'Aparece na vitrine depois que o hotel salvar o conteúdo pela primeira vez.'
              : h.listed
                ? 'Aparece na página inicial, com foto e busca.'
                : 'Oculto da página inicial (o portal continua funcionando pelo link e QR Code).'
          }
        >
          <div className="a-toggle-row">
            <Toggle
              checked={h.listed}
              onChange={(v) => act(() => platformApi.setListed(h.id, v), v ? 'Hotel na vitrine' : 'Hotel oculto da vitrine')}
              label="Mostrar na vitrine"
            />
            <small>{h.listed ? 'Visível' : 'Oculto'}</small>
          </div>
        </Field>
      </div>

      <h4 className="pf-subtitle">Administradores</h4>
      {error && <p className="pf-error">{error}</p>}
      {!admins && !error && (
        <Empty>
          <Loader2 size={18} className="spin" /> Carregando…
        </Empty>
      )}
      {admins?.length === 0 && <Empty>Nenhum administrador. Convide o primeiro abaixo.</Empty>}
      {!!admins?.length && (
        <ul className="pf-admins">
          {admins.map((a) => (
            <li key={a.user_id}>
              <div className="pf-admin-main">
                <strong>{a.email}</strong>
                <small>
                  {a.last_sign_in_at ? `Último login ${ago(a.last_sign_in_at)}` : 'Convite pendente — ainda não entrou'}
                  {' • '}
                  {a.has_2fa ? (
                    <span className="pf-ok">
                      <ShieldCheck size={12} /> 2FA ativa
                    </span>
                  ) : (
                    <span className="pf-warn">
                      <ShieldAlert size={12} /> sem 2FA
                    </span>
                  )}
                </small>
              </div>
              <Select
                value={a.role}
                onChange={(e) => act(() => platformApi.setRole(h.id, a.user_id, e.target.value as HotelAdminRole), 'Papel atualizado')}
                aria-label={`Papel de ${a.email}`}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.hint}
                  </option>
                ))}
              </Select>
              <div className="pf-admin-actions">
                {a.last_sign_in_at && (
                  <button
                    className="a-btn a-btn-outline"
                    disabled={!!resetBusy}
                    onClick={() => passwordLink(a.email)}
                    title="Para quem esqueceu a senha: link de uso único para criar uma nova"
                  >
                    {resetBusy === a.email ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />} Nova senha
                  </button>
                )}
                {a.has_2fa && (
                  <button
                    className="a-btn a-btn-outline"
                    onClick={() =>
                      confirm(
                        `Redefinir a verificação em 2 etapas de ${a.email}?\n\nUse quando a pessoa perdeu ou trocou de celular. Ela será desconectada e, no próximo login, cadastra o app autenticador de novo.`,
                      ) && act(() => platformApi.reset2fa(a.user_id), '2FA redefinida', 'No próximo login a pessoa cadastra o app de novo')
                    }
                  >
                    <RefreshCw size={14} /> Redefinir 2FA
                  </button>
                )}
                <button
                  className="a-icon-btn danger"
                  aria-label={`Remover ${a.email}`}
                  onClick={() =>
                    confirm(`Remover o acesso de ${a.email} a ${h.name}?`) &&
                    act(() => platformApi.removeAdmin(h.id, a.user_id), 'Acesso removido')
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resetLink && <LinkResult hotel={h} result={resetLink} />}

      <Invite
        hotel={h}
        pendingEmails={(admins ?? []).filter((a) => !a.last_sign_in_at).map((a) => a.email)}
        onDone={() => (loadAdmins(), onChanged())}
      />

      <div className="pf-danger">
        <div>
          <strong>Excluir hotel</strong>
          <small>Apaga o hotel, os acessos e os relatórios. As fotos enviadas ficam no Storage.</small>
        </div>
        <button className="a-btn a-btn-danger" onClick={remove}>
          <Trash2 size={16} /> Excluir
        </button>
      </div>
    </div>
  );
}

function Invite({ hotel, pendingEmails, onDone }: { hotel: PlatformHotel; pendingEmails: string[]; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<HotelAdminRole>('owner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);

  const send = async (target: string) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await platformApi.invite(hotel.id, target.trim(), role));
      setEmail('');
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pf-invite">
      <h4 className="pf-subtitle">
        <UserPlus size={16} /> Convidar administrador
      </h4>
      <form
        className="pf-invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(email);
        }}
      >
        <Input
          type="email"
          required
          placeholder="email@dohotel.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="E-mail"
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as HotelAdminRole)} aria-label="Papel">
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <button type="submit" className="a-btn a-btn-primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />} Gerar convite
        </button>
      </form>
      {pendingEmails.length > 0 && !result && (
        <p className="a-hint">
          Link expirou? Gere de novo para {pendingEmails.length === 1 ? pendingEmails[0] : 'o e-mail pendente'}:{' '}
          {pendingEmails.map((m) => (
            <button key={m} type="button" className="pf-linkbtn" onClick={() => send(m)} disabled={busy}>
              novo link para {m}
            </button>
          ))}
        </p>
      )}
      {error && <p className="pf-error">{error}</p>}

      {result && <LinkResult hotel={hotel} result={result} />}
    </div>
  );
}

/** The access link to send (invite, expired invite or new password), with ready-to-send messages. */
function LinkResult({ hotel, result }: { hotel: PlatformHotel; result: InviteResult }) {
  const reset = result.status === 'reset';
  const message = !result.link
    ? ''
    : reset
      ? `Olá! Este é o link para criar uma nova senha no painel do ${hotel.name}:\n\n${result.link}\n\nEle vale por pouco tempo e só funciona uma vez. Ao abrir, confirme o código do app autenticador e crie a nova senha. O painel fica em ${adminUrl(hotel.id)}`
      : `Olá! Este é o seu acesso ao painel do ${hotel.name} no ${PLATFORM_NAME}:\n\n${result.link}\n\nO link vale por pouco tempo e só funciona uma vez. Ao abrir, você vai cadastrar a verificação em 2 etapas (app autenticador, como Google Authenticator) e criar sua senha. Depois, o painel fica em ${adminUrl(hotel.id)}`;
  return (
    <div className="pf-result">
      {result.link ? (
        <>
          <p>
            <Check size={16} /> {reset ? 'Link de nova senha' : result.status === 'invited' ? 'Convite criado' : 'Novo link gerado'} para{' '}
            <strong>{result.email}</strong>. Envie o link abaixo — ele não é mandado por e-mail automaticamente.
          </p>
          <code className="pf-code">{result.link}</code>
          <div className="pf-links">
            <CopyButton text={message} label="Copiar mensagem" />
            <a className="a-btn a-btn-outline" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Enviar por WhatsApp
            </a>
          </div>
        </>
      ) : (
        <p>
          <Check size={16} /> <strong>{result.email}</strong> já tinha conta e agora também administra este hotel. Ela entra em{' '}
          <code>{adminUrl(hotel.id)}</code> com a senha e o autenticador de sempre.
        </p>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="a-btn a-btn-outline"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? 'Copiado' : label}
    </button>
  );
}
