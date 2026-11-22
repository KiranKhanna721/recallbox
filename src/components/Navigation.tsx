/**
 * App sidebar — desktop: fixed left rail; mobile: top bar + slide-over drawer.
 *
 * Keeps the scaffold's test hooks (`app-navigation`, `nav-sign-in-button`,
 * `nav-user-name`, `nav-user-email`) that the shipped smoke tests rely on.
 */

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthOverlay, signOut, useAuthProfileReady } from 'deepspace'
import { LayoutDashboard, LogIn, LogOut, Menu, NotebookText, Plus, Sparkles, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui'
import { Logo } from './Logo'

const NAV = [
  { path: '/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/notes', label: 'All Notes', icon: NotebookText },
  { path: '/ask', label: 'Ask AI', icon: Sparkles },
] as const

export default function Navigation() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const navigate = useNavigate()
  const { isSignedIn } = useAuthProfileReady({ requireUser: true })

  useEffect(() => setOpen(false), [location.pathname, location.search])

  // Alt+N: new note from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN' && isSignedIn) {
        e.preventDefault()
        navigate('/notes?new=1')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSignedIn, navigate])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-shell px-4 md:hidden">
        <Link to="/home" aria-label="RecallBox dashboard">
          <Logo />
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-in slide-in-from-left-2">
            <SidebarBody onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside data-testid="app-navigation" className="hidden w-64 shrink-0 md:block">
        <SidebarBody />
      </aside>
    </>
  )
}

function SidebarBody({ onClose }: { onClose?: () => void }) {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const location = useLocation()
  const navigate = useNavigate()
  const [showAuth, setShowAuth] = useState(false)
  const profileReady = !isSignedIn || (!userLoading && !!user)

  return (
    <nav className="flex h-full flex-col border-r border-border bg-shell px-3 py-4">
      <div className="flex items-center justify-between px-2 pb-5">
        <Link to="/home" aria-label="RecallBox dashboard">
          <Logo />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <button
        onClick={() => navigate('/notes?new=1')}
        disabled={!isSignedIn}
        className="mb-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-medium text-white shadow-[0_6px_20px_-8px_rgba(124,108,246,0.8)] transition hover:brightness-110 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden /> New note
        <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 text-[10px] font-normal lg:inline">Alt N</kbd>
      </button>

      <ul className="space-y-1">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname.startsWith(path)
          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                  active
                    ? 'bg-accent text-foreground shadow-[inset_0_0_0_1px_rgba(139,124,248,0.25)]'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4', active && 'text-primary')} aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="flex-1" />

      <div className="border-t border-border pt-3">
        {!isLoaded ? null : isSignedIn && !profileReady ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
        ) : isSignedIn && user ? (
          <div className="space-y-1">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarImage src={user.imageUrl ?? undefined} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-xs">
                  {(user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div data-testid="nav-user-name" className="truncate text-sm font-medium text-foreground">
                  {user.name || user.email}
                </div>
                <div data-testid="nav-user-email" className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        ) : (
          <button
            data-testid="nav-sign-in-button"
            onClick={() => setShowAuth(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent"
          >
            <LogIn className="h-4 w-4" aria-hidden /> Sign in
          </button>
        )}
      </div>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </nav>
  )
}
