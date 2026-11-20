import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-30 pointer-events-none flex items-center gap-2 rounded-lg bg-slate-900/95 border border-amber-500/60 px-3 py-1.5 text-xs font-medium text-amber-300 shadow-lg">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline Mode — Solo &amp; 2P Split-Screen Ready</span>
    </div>
  );
};
