import React from 'react';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  className = '',
  onClick,
}) => {
  // Determine pixel sizes
  let pixelSize = 32;
  let wordmarkClass = 'text-xl';
  let taglineVisible = showTagline;

  if (typeof size === 'number') {
    pixelSize = size;
    wordmarkClass = size >= 40 ? 'text-2xl' : size >= 32 ? 'text-xl' : 'text-base';
  } else {
    switch (size) {
      case 'sm':
        pixelSize = 24;
        wordmarkClass = 'text-base';
        taglineVisible = false;
        break;
      case 'md':
        pixelSize = 32;
        wordmarkClass = 'text-xl';
        taglineVisible = false;
        break;
      case 'lg':
        pixelSize = 40;
        wordmarkClass = 'text-2xl';
        break;
      case 'xl':
        pixelSize = 48;
        wordmarkClass = 'text-3xl';
        break;
    }
  }

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Crisp SVG mark */}
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ms-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="ms-sphere-grad" x1="13" y1="4" x2="19" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#C7D2FE" />
          </linearGradient>
        </defs>
        {/* Rounded square container */}
        <rect width="32" height="32" rx="8" fill="url(#ms-logo-grad)" />
        
        {/* Geometric M path */}
        <path
          d="M8.5 22.5V11.5L16 18L23.5 11.5V22.5"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Orbiting sphere icon */}
        <circle cx="16" cy="7.5" r="2.25" fill="url(#ms-sphere-grad)" />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={`font-extrabold tracking-tight font-['Plus_Jakarta_Sans',sans-serif] ${wordmarkClass}`}
          >
            <span className="text-slate-900 dark:text-white">Market</span>
            <span className="text-indigo-600 dark:text-indigo-400">Sphere</span>
          </span>
          {taglineVisible && (
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">
              Multi-Vendor Marketplace
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group inline-flex items-center rounded-lg p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-opacity hover:opacity-95"
        aria-label="MarketSphere Home"
      >
        {content}
      </button>
    );
  }

  return content;
};
