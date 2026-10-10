// Horizontal chip rows (`.drag-scroll`) scroll by touch natively; this adds the same for a mouse:
// drag sideways to scroll, and the vertical wheel scrolls the row sideways.
// A drag never triggers the click of the chip it started on.

export function installDragScroll() {
  let row: HTMLElement | null = null;
  let startX = 0;
  let startLeft = 0;
  let moved = false;
  let suppressClick = false;

  const scrollable = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1;

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = (e.target as Element | null)?.closest<HTMLElement>('.drag-scroll');
    if (!t || !scrollable(t)) return;
    row = t;
    startX = e.clientX;
    startLeft = t.scrollLeft;
    moved = false;
  });

  document.addEventListener('pointermove', (e) => {
    if (!row) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < 5) return;
    if (!moved) {
      moved = true;
      row.classList.add('dragging');
    }
    row.scrollLeft = startLeft - dx;
  });

  const end = () => {
    if (!row) return;
    row.classList.remove('dragging');
    if (moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
    }
    row = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);

  document.addEventListener(
    'click',
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const t = (e.target as Element | null)?.closest<HTMLElement>('.drag-scroll');
      if (!t || !scrollable(t)) return;
      const before = t.scrollLeft;
      t.scrollLeft += e.deltaY;
      if (t.scrollLeft !== before) e.preventDefault();
    },
    { passive: false },
  );
}
