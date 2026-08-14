'use client';

import { useState, useEffect } from 'react';
import { X, Globe, AtSign, ImageIcon } from 'lucide-react';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

type Platform = 'FACEBOOK' | 'PINTEREST' | 'X';

interface Connection {
  platform:    Platform;
  status:      'CONNECTED' | 'DISCONNECTED';
  connectedAt: string | null;
}

const PLATFORM_META: Record<Platform, { label: string; icon: React.ElementType; color: string; disabled?: boolean }> = {
  FACEBOOK:  { label: 'Facebook',  icon: Globe,     color: 'text-[#1877F2] bg-[#1877F2]/10' },
  PINTEREST: { label: 'Pinterest', icon: ImageIcon, color: 'text-[#E60023] bg-[#E60023]/10', disabled: true },
  X:         { label: 'X',         icon: AtSign,    color: 'text-secondary bg-muted/10' },
};

interface SocialAccountSettingsModalProps {
  onClose: () => void;
}

export function SocialAccountSettingsModal({ onClose }: SocialAccountSettingsModalProps) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [busy, setBusy] = useState<Platform | null>(null);

  const load = () => api.get<Connection[]>(API_ROUTES.ADMIN.SOCIAL_CONNECTIONS).then(setConnections).catch(() => setConnections([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggle = async (platform: Platform, connect: boolean) => {
    setBusy(platform);
    try {
      await api.patch(API_ROUTES.ADMIN.SOCIAL_CONNECTION(platform), { connect });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-surface rounded-card border border-border shadow-2xl w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-secondary text-base">Social account settings</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {!connections ? (
            <div className="h-32 bg-background rounded-card animate-pulse" />
          ) : (
            (Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
              const meta = PLATFORM_META[platform];
              const Icon = meta.icon;
              const conn = connections.find((c) => c.platform === platform);
              const connected = conn?.status === 'CONNECTED';
              return (
                <div key={platform} className="flex items-center gap-3 p-3 border border-border rounded-card">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary">{meta.label}</p>
                    <p className="text-xs text-muted">
                      {meta.disabled ? 'Coming soon' : connected ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={meta.disabled || busy === platform}
                    onClick={() => toggle(platform, !connected)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-button border transition-colors disabled:opacity-40 ${
                      connected ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-primary/40 text-primary hover:bg-primary/5'
                    }`}
                  >
                    {busy === platform ? '…' : connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              );
            })
          )}
          <p className="text-[11px] text-muted/70 italic pt-1">
            Connecting doesn&apos;t publish anything automatically — it only lets you tag a platform when you create a post.
          </p>
        </div>

        <div className="border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
