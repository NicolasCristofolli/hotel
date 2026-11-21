import type { Identity } from '../types';

/** Hotel logo when one is configured, otherwise the circular monogram. */
export function BrandMark({ identity, size = 'md', className = '' }: { identity: Identity; size?: 'md' | 'lg'; className?: string }) {
  if (identity.logo) {
    return <img src={identity.logo} alt={identity.name} className={`brand-logo ${size} ${className}`} draggable={false} />;
  }
  return <span className={`monogram-mark ${size === 'lg' ? 'lg' : ''} ${className}`}>{identity.monogram}</span>;
}
