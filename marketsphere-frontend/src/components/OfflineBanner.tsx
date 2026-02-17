import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-rose-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-3 sticky top-0 z-50 shadow-md">
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span className="font-semibold">
        You are currently offline. Product changes and checkout submissions will queue once reconnected.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
};
