import { useState, type ImgHTMLAttributes } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement>;

/** Image with a soft fade-in and a branded gradient fallback (never shows a broken icon). */
export function Img(props: Props) {
  // Keyed by src so load state resets cleanly when the admin swaps the URL.
  return <ImgInner key={String(props.src)} {...props} />;
}

function ImgInner({ className = '', alt = '', ...props }: Props) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  return (
    <span className={`img ${className} img-${state}`}>
      {state !== 'error' && props.src && (
        <img
          {...props}
          alt={alt}
          loading={props.loading ?? 'lazy'}
          decoding="async"
          ref={(el) => {
            // Cached images may finish before React attaches onLoad
            if (el?.complete && el.naturalWidth > 0 && state === 'loading') setState('ok');
          }}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
        />
      )}
    </span>
  );
}
