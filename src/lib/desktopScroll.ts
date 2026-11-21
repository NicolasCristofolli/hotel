/**
 * Desktop support for horizontal scrollers (chip rows, notice carousel, day selector…).
 * Touch devices swipe natively; a mouse can't, and the scrollbars are hidden for the look.
 *  - Mouse wheel over a horizontal row scrolls it sideways (until it hits an edge).
 *  - Click-and-drag scrolls it; a drag never triggers the click underneath.
 * Installed once, works for any element with `overflow-x: auto|scroll`.
 */
const isHScroller = (el: HTMLElement) => {
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  const ox = getComputedStyle(el).overflowX;
  return ox === 'auto' || ox === 'scroll';
};

function findScroller(target: EventTarget | null): HTMLElement | null {
  let el = target instanceof Element ? (target as HTMLElement) : null;
  while (el && el !== document.body) {
    if (isHScroller(el)) return el;
    el = el.parentElement;
  }
  return null;
}

const hasSnap = (el: HTMLElement) => getComputedStyle(el).scrollSnapType.startsWith('x');

export function installDesktopHorizontalScroll() {
  // ── Wheel ───────────────────────────────────────────────
  let snapLock = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch-zoom or trackpad already sideways
      const el = findScroller(e.target);
      if (!el) return;
      const dir = Math.sign(e.deltaY);
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((dir < 0 && atStart) || (dir > 0 && atEnd)) return; // let the page scroll
      e.preventDefault();
      if (hasSnap(el)) {
        // Snap carousels: one card per wheel gesture.
        const now = Date.now();
        if (now < snapLock) return;
        snapLock = now + 380;
        el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
      } else {
        el.scrollLeft += e.deltaY;
      }
    },
    { passive: false },
  );

  // ── Drag ────────────────────────────────────────────────
  let drag: { el: HTMLElement; x: number; left: number; moved: boolean; snap: string } | null = null;
  let suppressClick = false;

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as Element).closest('input, textarea, select, [draggable="true"]')) return;
    const el = findScroller(e.target);
    if (!el) return;
    drag = { el, x: e.clientX, left: el.scrollLeft, moved: false, snap: el.style.scrollSnapType };
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.el.style.scrollSnapType = 'none'; // snapping fights manual scrollLeft
      drag.el.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
    drag.el.scrollLeft = drag.left - dx;
  });

  const end = () => {
    if (!drag) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      drag.el.style.scrollSnapType = drag.snap;
      drag.el.style.cursor = '';
      document.body.style.userSelect = '';
    }
    drag = null;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  window.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    },
    true,
  );
}
