import { motion } from 'framer-motion';
import { QrCode, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { lazy, Suspense } from 'react';
import { BrandMark } from './components/BrandMark';
import { IMAGES } from './config/defaultHotelConfig';
import { GuestApp } from './GuestApp';
import { AdminAccessProvider, useAdminAccess } from './state/AdminAccess';
import { isRemote } from './lib/backend';
import { hasHotel, isPlatformPanel } from './lib/tenant';
import { HotelLoading, HotelNotFound, HotelOffline, PlatformHome, PlatformMessage } from './platform/PlatformHome';
import { HotelProvider, useHotel } from './state/HotelContext';

// Admin code (panels, editors, reports) is downloaded only when someone opens it — guests never load it.
const AdminPanel = lazy(() => import('./admin/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const PlatformPanel = lazy(() => import('./platform/PlatformPanel').then((m) => ({ default: m.PlatformPanel })));

export default function App() {
  // hotelguia.com.br/ → platform; /painel → super admin; /<hotel> → that hotel's portal (#/admin for its panel).
  if (isPlatformPanel)
    return (
      <AdminAccessProvider>
        <PlatformGate />
      </AdminAccessProvider>
    );
  if (!hasHotel) return <PlatformHome />;
  return (
    <HotelProvider>
      <HotelGate />
    </HotelProvider>
  );
}

/** Super admin: the login modal (from AdminAccessProvider) sits on top until a platform admin is signed in. */
function PlatformGate() {
  const { role } = useAdminAccess();
  if (!isRemote) return <PlatformMessage text="O painel da plataforma precisa do Supabase configurado (.env.local)." />;
  if (role === 'platform')
    return (
      <Suspense fallback={<HotelLoading />}>
        <PlatformPanel />
      </Suspense>
    );
  return <HotelLoading />;
}

/** Only mounts the portal/admin once this hotel's own content is known. */
function HotelGate() {
  const { presence } = useHotel();
  if (presence === 'loading') return <HotelLoading />;
  if (presence === 'missing') return <HotelNotFound />;
  if (presence === 'offline') return <HotelOffline />;
  return (
    <AdminAccessProvider>
      <Root />
    </AdminAccessProvider>
  );
}

function Root() {
  const { isAdminRoute, unlocked } = useAdminAccess();
  const showAdmin = isAdminRoute && unlocked;
  // Entry-only fade: an exit animation ("wait" mode) could leave the screen blank when switching quickly.
  return (
    <motion.div key={showAdmin ? 'admin' : 'guest'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {showAdmin ? (
        <Suspense fallback={<HotelLoading />}>
          <AdminPanel />
        </Suspense>
      ) : (
        <GuestStage />
      )}
    </motion.div>
  );
}

/** Mobile: full-bleed portal. Desktop: centered luxury app shell over an editorial backdrop. */
function GuestStage() {
  const { config } = useHotel();
  const id = config.identity;
  const portalUrl = `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="stage">
      <div className="stage-bg" style={{ backgroundImage: `url(${IMAGES.desktopBg})` }} aria-hidden />
      <div className="stage-grain" aria-hidden />

      <aside className="stage-side stage-left">
        <BrandMark identity={id} size="lg" />
        <p className="eyebrow light">Guia do Hóspede</p>
        <h2 className="stage-title">
          {id.name}
          <em>{id.subtitle}</em>
        </h2>
        <p className="stage-copy">{id.tagline}.</p>
      </aside>

      <motion.div
        className="shell"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        <GuestApp mode="hash" />
      </motion.div>

      <aside className="stage-side stage-right">
        <div className="qr-card">
          <div className="qr-head">
            <QrCode size={16} strokeWidth={1.5} /> Acesse pelo celular
          </div>
          <div className="qr-code">
            <QRCodeSVG value={portalUrl} size={148} bgColor="transparent" fgColor={config.theme.primary} level="M" />
          </div>
          <p>Aponte a câmera para abrir o portal no seu smartphone.</p>
          <span className="qr-foot">
            <Smartphone size={14} strokeWidth={1.5} /> Otimizado para mobile
          </span>
        </div>
      </aside>
    </div>
  );
}
