import React, { useEffect, useRef, useState } from 'react';
import { Bell, CreditCard, LayoutDashboard, LogOut, MessageCircle, RefreshCw, UserCircle } from 'lucide-react';
import { LiveCounter } from './LiveCounter';
import { ThemeToggle } from './ThemeToggle';
import upchangeLogo from '../../assets/upchange-logo.png';

export interface LinkedInNavProps {
  /** Shown left of the logo (e.g. back button on sub-pages). */
  leadingSlot?: React.ReactNode;
  /** Opens Career Mentor chat when provided. */
  onCareerMentor?: () => void;
  /** Opens account login/signup. */
  onLogin?: () => void;
  /** Opens subscription plans. */
  onSubscriptions?: () => void;
  /** Signed-in user display name. */
  accountName?: string;
  onDashboard?: () => void;
  onRecalculate?: () => void;
  onLogout?: () => void;
  onSettings?: () => void;
}

export function LinkedInNav({
  leadingSlot,
  onCareerMentor,
  onLogin,
  onSubscriptions,
  accountName,
  onDashboard,
  onRecalculate,
  onLogout,
  onSettings
}: LinkedInNavProps) {
  const displayName = accountName?.trim() ? accountName.trim().split(/\s+/)[0] : '';
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [accountOpen]);

  return (
    <nav className="sticky top-0 z-50 w-full bg-dark-bg border-b border-dark-border h-14 px-4 md:px-6 lg:px-8 grid grid-cols-3 items-center">
      <div className="flex items-center min-w-0">
        {leadingSlot}
        <img src={upchangeLogo} alt="UpChange" className="h-7 w-auto logo-themed shrink-0" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className="text-lg font-semibold text-dark-textPri hidden md:block whitespace-nowrap">
          AI Resilience Score™
        </span>
        <LiveCounter />
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-4">
        {onCareerMentor && (
          <button
            type="button"
            onClick={onCareerMentor}
            className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-2.5 py-1.5 text-xs font-medium text-dark-textPri hover:border-dark-accent hover:text-dark-accent transition-colors"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Career Mentor</span>
          </button>
        )}
        {onSubscriptions && (
          <button
            type="button"
            onClick={onSubscriptions}
            className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-2.5 py-1.5 text-xs font-medium text-dark-textPri hover:border-dark-accent hover:text-dark-accent transition-colors"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Subscriptions</span>
          </button>
        )}
        <ThemeToggle />
        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => displayName ? setAccountOpen((v) => !v) : onLogin?.()}
            className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity"
          >
            <UserCircle className="w-6 h-6 text-dark-textSec" />
            <span className="text-[10px] text-dark-textSec hidden md:block">
              {displayName || (onLogin ? 'Login' : 'Me')}
            </span>
          </button>
          {accountOpen && displayName && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden py-2">
              <div className="px-4 py-3 border-b border-dark-border">
                <p className="text-xs text-dark-textMuted">Signed in as</p>
                <p className="text-sm font-semibold text-dark-textPri truncate">{accountName}</p>
              </div>
              {onDashboard && (
                <button type="button" onClick={() => { setAccountOpen(false); onDashboard(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-dark-textSec hover:bg-dark-bg hover:text-dark-textPri">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              )}
              {onSubscriptions && (
                <button type="button" onClick={() => { setAccountOpen(false); onSubscriptions(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-dark-textSec hover:bg-dark-bg hover:text-dark-textPri">
                  <CreditCard className="w-4 h-4" />
                  Subscription
                </button>
              )}
              {onRecalculate && (
                <button type="button" onClick={() => { setAccountOpen(false); onRecalculate(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-dark-textSec hover:bg-dark-bg hover:text-dark-textPri">
                  <RefreshCw className="w-4 h-4" />
                  Recalculate score
                </button>
              )}
              {onSettings && (
                <button type="button" onClick={() => { setAccountOpen(false); onSettings(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-dark-textSec hover:bg-dark-bg hover:text-dark-textPri">
                  <Bell className="w-4 h-4" />
                  Notification settings
                </button>
              )}
              {onLogout && (
                <button type="button" onClick={() => { setAccountOpen(false); onLogout(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-300 hover:bg-red-950/30">
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>);

}