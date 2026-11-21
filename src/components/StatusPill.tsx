import type { LiveStatus } from '../lib/status';

export function StatusPill({ status, size = 'sm' }: { status: LiveStatus; size?: 'sm' | 'md' }) {
  return (
    <span className={`status status-${status.tone} status-${size}`}>
      <i className="status-dot" aria-hidden />
      {status.label}
    </span>
  );
}
