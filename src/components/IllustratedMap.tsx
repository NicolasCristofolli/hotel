/**
 * Built-in illustrated resort map (1000×750, 4:3). Uses theme CSS variables so it
 * re-colours with every palette preset. Feature positions match the default pins.
 */
const trees: [number, number, number][] = [
  // top-left forest + trail
  [40, 60, 26],
  [85, 40, 22],
  [140, 70, 24],
  [60, 120, 20],
  [190, 40, 20],
  [30, 190, 24],
  [75, 230, 18],
  [230, 90, 18],
  [175, 150, 16],
  [250, 30, 16],
  // left edge
  [40, 330, 22],
  [70, 400, 18],
  [30, 470, 20],
  [95, 480, 14],
  // bottom-right
  [880, 650, 26],
  [940, 600, 22],
  [820, 700, 20],
  [960, 700, 18],
  [760, 690, 14],
  // top-middle
  [400, 60, 18],
  [440, 30, 14],
  [650, 50, 18],
  [690, 90, 14],
  [610, 120, 12],
  // bottom-left
  [260, 700, 18],
  [320, 720, 14],
  [110, 690, 18],
  // right
  [960, 360, 20],
  [930, 420, 16],
  [970, 470, 14],
];

export function IllustratedMap() {
  return (
    <svg className="illustrated-map" viewBox="0 0 1000 750" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="im-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--color-primary) 16%, #EEF0E2)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--color-primary) 8%, #F3EEDF)' }} />
        </linearGradient>
        <radialGradient id="im-lake" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#B9D4CF" />
          <stop offset="1" stopColor="#8FB3AE" />
        </radialGradient>
        <linearGradient id="im-pool" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#BFE3E6" />
          <stop offset="1" stopColor="#7FBFC6" />
        </linearGradient>
        <pattern id="im-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-primary)" strokeOpacity="0.06" strokeWidth="2" />
        </pattern>
      </defs>

      <rect width="1000" height="750" fill="url(#im-ground)" />
      <rect width="1000" height="750" fill="url(#im-hatch)" />

      {/* contour lines */}
      <g fill="none" stroke="var(--color-accent)" strokeOpacity="0.35" strokeWidth="1.2">
        <path d="M0 260 C180 220 260 300 420 250 S720 190 1000 250" />
        <path d="M0 300 C200 260 300 340 460 290 S760 240 1000 300" strokeOpacity="0.22" />
        <path d="M0 560 C150 520 300 600 500 540 S820 500 1000 560" />
        <path d="M0 610 C180 570 320 650 520 590 S840 560 1000 620" strokeOpacity="0.22" />
      </g>

      {/* lake */}
      <path
        d="M700 95 C760 50 900 60 950 110 C990 160 940 230 860 235 C780 240 690 200 685 150 C682 125 688 108 700 95Z"
        fill="url(#im-lake)"
      />
      <path d="M720 120 C780 95 880 100 920 140" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      {/* deck */}
      <rect x="800" y="168" width="44" height="58" rx="3" fill="#C9A77A" stroke="#8E6E48" strokeWidth="1.5" />

      {/* paths */}
      <g fill="none" stroke="#FFFDF6" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
        <path d="M500 380 C500 460 470 540 460 600" />
        <path d="M500 380 C560 360 600 330 630 310" />
        <path d="M500 380 C440 360 400 330 370 315" />
        <path d="M500 380 C520 300 520 250 520 210" />
        <path d="M370 315 C340 270 320 230 310 205" />
        <path d="M500 380 C560 420 610 460 640 490" />
        <path d="M640 490 C700 470 760 450 800 445" />
        <path d="M500 380 C420 410 330 440 270 465" />
        <path d="M270 465 C230 510 190 560 170 585" />
        <path d="M630 310 C700 260 760 230 820 200" />
        <path d="M500 380 C540 600 700 700 900 750" />
      </g>
      <g fill="none" stroke="#C9B48A" strokeWidth="1.5" strokeDasharray="1 0">
        <path d="M500 380 C500 460 470 540 460 600" strokeOpacity="0.4" />
      </g>
      {/* trail (dashed) */}
      <path
        d="M310 205 C260 180 200 150 110 128 C80 120 60 100 40 70"
        fill="none"
        stroke="#8E6E48"
        strokeWidth="3"
        strokeDasharray="7 7"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* trees */}
      <g>
        {trees.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x + 3} cy={y + 4} r={r} fill="var(--color-primary)" opacity="0.15" />
            <circle cx={x} cy={y} r={r} style={{ fill: 'color-mix(in srgb, var(--color-primary) 45%, #3F6B4E)' }} />
            <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.45} fill="#fff" opacity="0.09" />
          </g>
        ))}
      </g>

      {/* buildings */}
      <g stroke="var(--color-primary)" strokeWidth="1.5">
        {/* 1 lobby */}
        <rect x="425" y="335" width="150" height="85" rx="6" fill="#F7F1E4" />
        <path d="M425 350 L500 315 L575 350" fill="none" strokeWidth="2" />
        <rect x="485" y="392" width="30" height="28" fill="var(--color-accent)" opacity="0.6" stroke="none" />
        {/* 2 restaurant */}
        <rect x="585" y="272" width="96" height="62" rx="5" fill="#F7F1E4" />
        <rect x="595" y="282" width="76" height="8" fill="var(--color-accent)" opacity="0.35" stroke="none" />
        {/* 3 cafe */}
        <rect x="320" y="282" width="92" height="60" rx="5" fill="#F7F1E4" />
        {/* 8 adega */}
        <rect x="478" y="175" width="84" height="56" rx="5" fill="#EFE3CF" />
        <path d="M478 190 L520 168 L562 190" fill="none" />
        {/* 10 academia */}
        <rect x="270" y="170" width="80" height="52" rx="5" fill="#F7F1E4" />
        {/* 6 spa */}
        <rect x="205" y="430" width="120" height="70" rx="22" fill="#F7F1E4" />
        <circle cx="265" cy="465" r="14" fill="none" stroke="var(--color-accent)" />
        {/* 5 pool bar */}
        <rect x="770" y="415" width="70" height="52" rx="5" fill="#EFE3CF" />
        {/* cabins */}
        {[
          [120, 300],
          [130, 380],
          [860, 300],
          [900, 520],
          [700, 600],
          [620, 650],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 18} y={y - 13} width="36" height="26" rx="4" fill="#F7F1E4" />
            <path d={`M${x - 18} ${y - 6} L${x} ${y - 20} L${x + 18} ${y - 6}`} fill="none" />
          </g>
        ))}
      </g>

      {/* 4 pool */}
      <rect x="585" y="460" width="115" height="62" rx="10" fill="#E9DFC9" stroke="var(--color-primary)" strokeWidth="1.5" />
      <rect x="595" y="470" width="95" height="42" rx="7" fill="url(#im-pool)" />
      <path d="M605 485 q10 -6 20 0 t20 0 t20 0" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
      {/* 7 jacuzzi */}
      <circle cx="170" cy="590" r="30" fill="#E9DFC9" stroke="var(--color-primary)" strokeWidth="1.5" />
      <circle cx="170" cy="590" r="21" fill="url(#im-pool)" />
      {/* 9 fire pit */}
      <circle cx="460" cy="605" r="30" fill="#E2D3B5" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="4 4" />
      <circle cx="460" cy="605" r="11" fill="#E07A3F" />
      <circle cx="460" cy="605" r="5" fill="#F5C26B" />

      {/* compass */}
      <g transform="translate(62 610)" stroke="var(--color-primary)" fill="none" strokeWidth="1.2">
        <circle r="24" strokeOpacity="0.5" />
        <path d="M0 -18 L6 0 L0 18 L-6 0Z" fill="var(--color-accent)" stroke="none" />
        <text y="-28" textAnchor="middle" fontSize="12" fill="var(--color-primary)" stroke="none" fontFamily="Plus Jakarta Sans">
          N
        </text>
      </g>
    </svg>
  );
}
