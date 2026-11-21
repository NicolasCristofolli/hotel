import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Card({
  title,
  desc,
  actions,
  children,
  className = '',
}: {
  title?: string;
  desc?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`a-card ${className}`}>
      {(title || actions) && (
        <header className="a-card-head">
          <div>
            {title && <h3>{title}</h3>}
            {desc && <p>{desc}</p>}
          </div>
          {actions && <div className="a-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** `group`: render a <div> for button groups — a <label> would forward caption clicks to the first button. */
export function Field({
  label,
  hint,
  children,
  wide,
  group,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
  group?: boolean;
}) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`a-field ${wide ? 'is-wide' : ''}`}>
      <span className="a-label">{label}</span>
      {children}
      {hint && <span className="a-hint">{hint}</span>}
    </Tag>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input className="a-input" {...p} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="a-input a-textarea" rows={3} {...p} />;
export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="a-input a-select" {...p}>
    {children}
  </select>
);

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`a-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="a-seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="a-empty">{children}</div>;
}
