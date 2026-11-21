import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Lock, MailCheck, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { authMessage, LOGOUT_REASON_KEY, nextStep, RECOVERY_KEY, type AdminRole, type AuthStep } from '../../lib/adminAuth';
import { supabase } from '../../lib/supabase';
import { Turnstile, TURNSTILE_SITE_KEY } from './Turnstile';

type Step = AuthStep | 'loading' | 'forgot' | 'forgot-sent';

const REASONS: Record<string, string> = {
  idle: 'Sessão encerrada após 30 minutos sem uso.',
  'password-changed': 'Senha alterada. Entre novamente.',
};

/**
 * Admin sign-in, one step at a time:
 * e-mail + senha (+ CAPTCHA) → 2FA (cadastro na 1ª vez, depois só o código) → [nova senha, se veio do e-mail de recuperação].
 */
export function AdminLogin({
  open,
  initialError,
  onSuccess,
  onCancel,
}: {
  open: boolean;
  initialError?: string;
  onSuccess: (r: AdminRole) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);

  // Ref so a parent re-render doesn't restart the flow.
  const success = useRef(onSuccess);
  success.current = onSuccess;

  const advance = useCallback(async () => {
    const r = await nextStep();
    if (r.error) setError(r.error);
    if (r.step === 'done' && r.role) return success.current(r.role);
    setCode('');
    setStep(r.step);
  }, []);

  // Opening the modal → figure out where this session stands.
  useEffect(() => {
    if (!open) return;
    setError(initialError ?? '');
    setPassword('');
    setPassword2('');
    setCode('');
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    sessionStorage.removeItem(LOGOUT_REASON_KEY);
    setNotice(reason ? (REASONS[reason] ?? '') : '');
    setStep('loading');
    advance();
  }, [open, initialError, advance]);

  // 2FA first time: create the authenticator factor and show its QR code.
  useEffect(() => {
    if (step !== 'mfa-enroll' || !supabase || enroll) return;
    const db = supabase;
    (async () => {
      // Leftovers from an abandoned setup would block a new one.
      const { data: list } = await db.auth.mfa.listFactors();
      for (const f of list?.all ?? [])
        if (f.factor_type === 'totp' && f.status === 'unverified') await db.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: err } = await db.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Guia do Hóspede ${new Date().toISOString().slice(0, 16)}`,
      });
      if (err) return setError(authMessage(err));
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [step, enroll]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const needCaptcha = !!TURNSTILE_SITE_KEY && !captcha;

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await supabase!.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captcha ? { captchaToken: captcha } : undefined,
      });
      setCaptchaReset((n) => n + 1); // tokens are single-use
      if (err) return setError(authMessage(err));
      setNotice('');
      await advance();
    });
  };

  const verifyCode = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      let factorId = enroll?.factorId;
      if (step === 'mfa-verify') {
        const { data } = await supabase!.auth.mfa.listFactors();
        factorId = data?.totp[0]?.id;
      }
      if (!factorId) return setError('Verificação em duas etapas não encontrada. Saia e entre novamente.');
      const { error: err } = await supabase!.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, '') });
      if (err) {
        setCode('');
        return setError(authMessage(err));
      }
      setEnroll(null);
      await advance();
    });
  };

  const sendReset = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}?reset=1`,
        captchaToken: captcha || undefined,
      });
      setCaptchaReset((n) => n + 1);
      // Same answer whether or not the e-mail exists (doesn't reveal who is an admin).
      if (err && err.status !== 400 && err.status !== 404) return setError(authMessage(err));
      setStep('forgot-sent');
    });
  };

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))
      return setError('Use pelo menos 10 caracteres, com letras e números.');
    if (password !== password2) return setError('As senhas não conferem.');
    run(async () => {
      const { error: err } = await supabase!.auth.updateUser({ password });
      if (err) return setError(authMessage(err));
      sessionStorage.removeItem(RECOVERY_KEY);
      setPassword('');
      setPassword2('');
      await advance();
    });
  };

  // Leaving mid-way never keeps a half-authenticated session around.
  const cancel = async () => {
    if (step === 'mfa-enroll' || step === 'mfa-verify' || step === 'new-password') {
      sessionStorage.removeItem(RECOVERY_KEY);
      await supabase?.auth.signOut();
      setEnroll(null);
    }
    onCancel();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const codeInput = (
    <label className="login-field">
      <span>Código de 6 dígitos</span>
      <input
        className="login-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
      />
    </label>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="pin-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="pin-backdrop" />
          <motion.div
            className="pin-card login-card"
            role="dialog"
            aria-modal="true"
            aria-label="Acesso ao painel administrativo"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {step === 'loading' && (
              <Head icon={<Lock size={20} strokeWidth={1.5} />} title="Painel Administrativo" sub="Verificando sessão…" />
            )}

            {step === 'password' && (
              <form onSubmit={signIn}>
                <Head icon={<Lock size={20} strokeWidth={1.5} />} title="Painel Administrativo" sub="Entre com sua conta da equipe." />
                {notice && <p className="login-notice">{notice}</p>}
                <label className="login-field">
                  <span>E-mail</span>
                  <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="login-field">
                  <span>Senha</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
                <Err msg={error} />
                <button type="submit" className="btn btn-primary btn-block" disabled={busy || needCaptcha}>
                  {busy ? 'Entrando…' : 'Entrar'}
                </button>
                <div className="login-links">
                  <button type="button" onClick={() => (setError(''), setStep('forgot'))}>
                    Esqueci minha senha
                  </button>
                  <button type="button" onClick={cancel}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {step === 'forgot' && (
              <form onSubmit={sendReset}>
                <Head
                  icon={<KeyRound size={20} strokeWidth={1.5} />}
                  title="Redefinir senha"
                  sub="Enviaremos um link para o seu e-mail. Abra-o neste mesmo navegador."
                />
                <label className="login-field">
                  <span>E-mail</span>
                  <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
                <Err msg={error} />
                <button type="submit" className="btn btn-primary btn-block" disabled={busy || needCaptcha}>
                  {busy ? 'Enviando…' : 'Enviar link'}
                </button>
                <div className="login-links">
                  <button type="button" onClick={() => (setError(''), setStep('password'))}>
                    <ArrowLeft size={14} /> Voltar ao login
                  </button>
                </div>
              </form>
            )}

            {step === 'forgot-sent' && (
              <div>
                <Head
                  icon={<MailCheck size={20} strokeWidth={1.5} />}
                  title="Verifique seu e-mail"
                  sub={`Se ${email || 'o e-mail'} estiver cadastrado, você receberá um link para criar uma nova senha. Abra-o neste mesmo navegador.`}
                />
                <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('password')}>
                  Voltar ao login
                </button>
              </div>
            )}

            {step === 'mfa-enroll' && (
              <form onSubmit={verifyCode}>
                <Head
                  icon={<ShieldCheck size={20} strokeWidth={1.5} />}
                  title="Ative a verificação em 2 etapas"
                  sub="Obrigatória para a equipe. Escaneie o QR Code com o Google Authenticator, Microsoft Authenticator ou 1Password."
                />
                <div className="mfa-qr">
                  {enroll ? <img src={enroll.qr} alt="QR Code para o app autenticador" /> : <span>Gerando…</span>}
                </div>
                {enroll && (
                  <details className="mfa-secret">
                    <summary>Não consegue escanear? Digite a chave</summary>
                    <code>{enroll.secret}</code>
                  </details>
                )}
                {codeInput}
                <Err msg={error} />
                <button type="submit" className="btn btn-primary btn-block" disabled={busy || !enroll}>
                  {busy ? 'Verificando…' : 'Ativar e entrar'}
                </button>
                <div className="login-links">
                  <button type="button" onClick={cancel}>
                    Sair
                  </button>
                </div>
              </form>
            )}

            {step === 'mfa-verify' && (
              <form onSubmit={verifyCode}>
                <Head
                  icon={<ShieldCheck size={20} strokeWidth={1.5} />}
                  title="Verificação em 2 etapas"
                  sub="Digite o código que aparece no seu app autenticador."
                />
                {codeInput}
                <Err msg={error} />
                <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? 'Verificando…' : 'Verificar'}
                </button>
                <p className="login-help">Perdeu o celular? Peça ao proprietário para redefinir sua verificação.</p>
                <div className="login-links">
                  <button type="button" onClick={cancel}>
                    Sair
                  </button>
                </div>
              </form>
            )}

            {step === 'new-password' && (
              <form onSubmit={savePassword}>
                <Head
                  icon={<KeyRound size={20} strokeWidth={1.5} />}
                  title="Crie uma nova senha"
                  sub="Pelo menos 10 caracteres, com letras e números."
                />
                <label className="login-field">
                  <span>Nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label className="login-field">
                  <span>Repita a nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                  />
                </label>
                <Err msg={error} />
                <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? 'Salvando…' : 'Salvar e entrar'}
                </button>
                <div className="login-links">
                  <button type="button" onClick={cancel}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Head({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <>
      <div className="pin-icon">{icon}</div>
      <h2>{title}</h2>
      <p className="login-sub">{sub}</p>
    </>
  );
}

const Err = ({ msg }: { msg: string }) => (
  <p className="login-error" role="alert">
    {msg}
  </p>
);
