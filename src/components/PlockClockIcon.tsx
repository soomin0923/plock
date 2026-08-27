import React from 'react';

interface PlockClockIconProps {
  className?: string;
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export const PlockClockIcon: React.FC<PlockClockIconProps> = ({
  className = 'w-9 h-9',
  size = 36,
  primaryColor = '#C1876B',
  secondaryColor = '#1A1A1A',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform ${className}`}
    >
      {/* Outer Rounded Squircle / Dial Base */}
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="9"
        fill={secondaryColor}
        className="transition-colors"
      />
      
      {/* Clock Face Circle */}
      <circle
        cx="18"
        cy="18"
        r="12.5"
        fill="#FDFCF9"
        stroke={primaryColor}
        strokeWidth="1.5"
      />

      {/* 12, 3, 6, 9 Hour Dial Markers */}
      <line x1="18" y1="7.5" x2="18" y2="9.2" stroke={secondaryColor} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="28.5" y1="18" x2="26.8" y2="18" stroke={secondaryColor} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18" y1="28.5" x2="18" y2="26.8" stroke={secondaryColor} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7.5" y1="18" x2="9.2" y2="18" stroke={secondaryColor} strokeWidth="1.6" strokeLinecap="round" />

      {/* Clock Hands: Pointing dynamically to 10:10 (Classic Elegant Time) */}
      {/* Hour Hand */}
      <line
        x1="18"
        y1="18"
        x2="13.2"
        y2="13.2"
        stroke={secondaryColor}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Minute Hand */}
      <line
        x1="18"
        y1="18"
        x2="23"
        y2="11.5"
        stroke={primaryColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Center Pin Accent */}
      <circle cx="18" cy="18" r="1.8" fill={primaryColor} />
      <circle cx="18" cy="18" r="0.8" fill="#FDFCF9" />
    </svg>
  );
};
