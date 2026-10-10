export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden className="flex-none">
      <rect x="2" y="2" width="32" height="32" rx="9" fill="#2a2622" />
      <circle cx="18" cy="18" r="12.5" fill="#FDFCF9" stroke="var(--color-primary)" strokeWidth="1.5" />
      <line x1="18" y1="7.5" x2="18" y2="9.2" stroke="#2a2622" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="28.5" y1="18" x2="26.8" y2="18" stroke="#2a2622" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18" y1="28.5" x2="18" y2="26.8" stroke="#2a2622" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="18" x2="9.2" y2="18" stroke="#2a2622" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18" y1="18" x2="13.2" y2="13.2" stroke="#2a2622" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="18" x2="23" y2="11.5" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="18" r="1.8" fill="var(--color-primary)" />
    </svg>
  );
}
