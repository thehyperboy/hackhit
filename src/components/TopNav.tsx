/**
 * HackhIt — Full-Width Top Navigation Component
 *
 * Full-width responsive navigation bar matching HackhIt visual identity:
 * - Full browser viewport width with solid ink #050505 background
 * - Desktop icon-based navigation with smooth hover & focus tooltips:
 *   - Home: House (#home)
 *   - Explore: Compass (#explore -> Campus Hackathons)
 *   - Arena: Swords (#hackathons -> Coding Games & Collegiate Leaderboard)
 *   - Community: Users (#community)
 *   - My Profile: UserRound (#profile)
 * - Restrained lemon-yellow active route styling (#F5F04A)
 * - Accessible labels, keyboard-focus tooltips, and interactive tooltip bridge
 * - Mobile responsive drawer menu with icons and explicit text labels
 * - Sticky mobile bottom navigation bar for quick thumb ergonomics
 */

import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  House,
  Users,
  Compass,
  Swords,
  CalendarDays,
  UserRound,
  Building2,
  Menu,
  X,
  ArrowRight,
  LogOut,
} from 'lucide-react'
import brandLogo from '../assets/hackhit-logo-sticker.png'
import { isInstitutionalDomain } from '../lib/institutionalAuth'

export interface TopNavProps {
  currentView?:
    | 'landing'
    | 'explore'
    | 'community'
    | 'hackathons'
    | 'hackathon-details'
    | 'hackathon-register'
    | 'login'
    | 'signup'
    | 'my-registrations'
    | 'profile'
    | 'organizer'
  session?: Session | null
  userDisplayName?: string
  onNavigateToHome: () => void
  onNavigateToCommunity: () => void
  onNavigateToExplore?: () => void
  onNavigateToHackathons: () => void
  onNavigateToMyRegistrations?: () => void
  onNavigateToProfile?: () => void
  onNavigateToOrganizer?: () => void
  onNavigateToLogin: () => void
  onNavigateToSignup: () => void
  onSignOut?: () => void
  onOpenProfile?: () => void
}

interface NavIconItemProps {
  label: string
  href: string
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
}

function NavIconItem({ label, href, isActive, onClick, children }: NavIconItemProps) {
  return (
    <div className="relative group/nav flex items-center justify-center">
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault()
          onClick()
        }}
        aria-label={label}
        title={label}
        className={`grid h-10 w-10 place-items-center rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5F04A] ${
          isActive
            ? 'border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[2px_2px_0_#fff]'
            : 'border-transparent text-[#E9E7D8]/80 hover:text-[#050505] hover:bg-[#F5F04A] hover:border-[#050505] hover:shadow-[1.5px_1.5px_0_#fff]'
        }`}
      >
        <span className="transition-transform group-hover/nav:scale-110">
          {children}
        </span>
      </a>

      {/* Hover & keyboard-focus tooltip with pointer bridge */}
      <div
        role="tooltip"
        className="absolute top-full left-1/2 -translate-x-1/2 pt-2 pointer-events-auto opacity-0 invisible translate-y-1 group-hover/nav:opacity-100 group-hover/nav:visible group-hover/nav:translate-y-0 group-focus-within/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:translate-y-0 transition-all duration-150 ease-out z-50"
      >
        <div className="rounded-lg border-[1.5px] border-[#050505] bg-[#fffef8] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] whitespace-nowrap">
          {label}
        </div>
      </div>
    </div>
  )
}

export function TopNav({
  currentView = 'landing',
  session,
  userDisplayName,
  onNavigateToHome,
  onNavigateToCommunity,
  onNavigateToExplore,
  onNavigateToHackathons,
  onNavigateToMyRegistrations,
  onNavigateToProfile,
  onNavigateToOrganizer,
  onNavigateToLogin,
  onNavigateToSignup,
  onSignOut,
  onOpenProfile,
}: TopNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleProfileNav = () => {
    if (onNavigateToProfile) {
      onNavigateToProfile()
    } else if (onOpenProfile) {
      onOpenProfile()
    } else {
      window.location.hash = '#profile'
    }
  }

  const handleExploreNav = () => {
    if (onNavigateToExplore) {
      onNavigateToExplore()
    } else {
      window.location.hash = '#explore'
      onNavigateToHackathons()
    }
  }

  const isUniversity = Boolean(
    session?.user?.user_metadata?.role === 'university' ||
      session?.user?.user_metadata?.is_university === true ||
      (session?.user?.email && isInstitutionalDomain(session.user.email))
  )

  const handleOrganizerNav = () => {
    if (onNavigateToOrganizer) {
      onNavigateToOrganizer()
    } else {
      window.location.hash = '#organizer'
    }
  }

  const displayName =
    userDisplayName ||
    session?.user?.user_metadata?.organization_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    session?.user?.phone ||
    'My Profile'

  return (
    <>
      <header className="w-full bg-[#050505] text-[#E9E7D8] border-b-2 border-[#050505] sticky top-0 z-40 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault()
              setIsMobileMenuOpen(false)
              onNavigateToHome()
            }}
            className="brand flex items-center gap-2 group cursor-pointer"
            aria-label="HackhIt home"
          >
            <img
              src={brandLogo}
              alt="HackhIt Logo"
              className="brand-logo h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
              width={106}
              height={34}
            />
          </a>

          {/* Desktop Icon-Based Navigation with Tooltips */}
          <nav
            className="hidden md:flex items-center gap-2.5 lg:gap-3"
            aria-label="Main navigation"
          >
            {/* Home: House */}
            <NavIconItem
              label="Home"
              href="#home"
              isActive={currentView === 'landing'}
              onClick={onNavigateToHome}
            >
              <House size={18} />
            </NavIconItem>

            {/* Explore Campus Hackathons: Compass */}
            <NavIconItem
              label="Explore Hackathons"
              href="#explore"
              isActive={currentView === 'explore'}
              onClick={handleExploreNav}
            >
              <Compass size={18} />
            </NavIconItem>

            {/* Coding Arena & Leaderboard: Swords */}
            <NavIconItem
              label="Coding Games & Leaderboard"
              href="#hackathons"
              isActive={currentView === 'hackathons'}
              onClick={onNavigateToHackathons}
            >
              <Swords size={18} />
            </NavIconItem>

            {/* Community: Users */}
            <NavIconItem
              label="Community"
              href="#community"
              isActive={currentView === 'community'}
              onClick={onNavigateToCommunity}
            >
              <Users size={18} />
            </NavIconItem>

            {/* My Profile: UserRound */}
            <NavIconItem
              label="My Profile"
              href="#profile"
              isActive={currentView === 'profile'}
              onClick={handleProfileNav}
            >
              <UserRound size={18} />
            </NavIconItem>

            {/* University Portal: Building2 (for universities / organizers) */}
            {(isUniversity || currentView === 'organizer') && (
              <NavIconItem
                label="University Portal"
                href="#organizer"
                isActive={currentView === 'organizer'}
                onClick={handleOrganizerNav}
              >
                <Building2 size={18} className="text-[#F5F04A]" />
              </NavIconItem>
            )}
          </nav>

          {/* Desktop Auth Controls */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2">
                {isUniversity && (
                  <button
                    type="button"
                    onClick={handleOrganizerNav}
                    title="University Portal"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#F5F04A] bg-[#F5F04A]/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#F5F04A] hover:bg-[#F5F04A] hover:text-[#050505] transition-colors cursor-pointer"
                  >
                    <Building2 size={12} />
                    <span>College Portal</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleProfileNav()}
                  title={displayName}
                  className={`join-button cursor-pointer max-w-[170px] truncate ${
                    currentView === 'profile'
                      ? '!bg-[#F5F04A] !text-[#050505] !border-[#050505]'
                      : ''
                  }`}
                >
                  {displayName}
                </button>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="Sign Out"
                    className="outline-button cursor-pointer !min-h-[38px] !px-2.5"
                    aria-label="Sign out"
                  >
                    <LogOut size={13} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="outline-button !min-h-[36px] !px-4 cursor-pointer text-xs font-bold"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={onNavigateToSignup}
                  className="join-button cursor-pointer text-xs"
                >
                  Create account <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Navigation Controls */}
          <div className="flex md:hidden items-center gap-2">
            {session && (
              <button
                type="button"
                onClick={handleProfileNav}
                className="h-8 max-w-[130px] truncate rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-bold text-[#E9E7D8] flex items-center gap-1.5 cursor-pointer"
                title={displayName}
              >
                <UserRound size={12} className="text-[#F5F04A] shrink-0" />
                <span className="truncate">{displayName}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-[#151515] text-[#E9E7D8] hover:bg-white/10 cursor-pointer transition-colors"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation (Icons + Text Labels for Touch Usability) */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/15 bg-[#050505] px-4 py-5 shadow-2xl animate-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col space-y-2 font-bold text-sm" aria-label="Mobile navigation">
              {/* Home */}
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault()
                  setIsMobileMenuOpen(false)
                  onNavigateToHome()
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                  currentView === 'landing'
                    ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                    : 'text-[#E9E7D8] hover:bg-white/10'
                }`}
              >
                <House size={18} />
                <span>Home</span>
                {currentView === 'landing' && <span className="text-xs ml-auto">● Active</span>}
              </a>

              {/* Explore Hackathons */}
              <a
                href="#explore"
                onClick={(e) => {
                  e.preventDefault()
                  setIsMobileMenuOpen(false)
                  handleExploreNav()
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                  currentView === 'explore'
                    ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                    : 'text-[#E9E7D8] hover:bg-white/10'
                }`}
              >
                <Compass size={18} />
                <span>Explore Hackathons</span>
                {currentView === 'explore' && <span className="text-xs ml-auto">● Active</span>}
              </a>

              {/* Coding Games & Arena */}
              <a
                href="#hackathons"
                onClick={(e) => {
                  e.preventDefault()
                  setIsMobileMenuOpen(false)
                  onNavigateToHackathons()
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                  currentView === 'hackathons'
                    ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                    : 'text-[#E9E7D8] hover:bg-white/10'
                }`}
              >
                <Swords size={18} />
                <span>Coding Games & Arena</span>
                {currentView === 'hackathons' && <span className="text-xs ml-auto">● Active</span>}
              </a>

              {/* Community */}
              <a
                href="#community"
                onClick={(e) => {
                  e.preventDefault()
                  setIsMobileMenuOpen(false)
                  onNavigateToCommunity()
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                  currentView === 'community'
                    ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                    : 'text-[#E9E7D8] hover:bg-white/10'
                }`}
              >
                <Users size={18} />
                <span>Community Feed</span>
                {currentView === 'community' && <span className="text-xs ml-auto">● Active</span>}
              </a>

              {/* My Profile */}
              <a
                href="#profile"
                onClick={(e) => {
                  e.preventDefault()
                  setIsMobileMenuOpen(false)
                  handleProfileNav()
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                  currentView === 'profile'
                    ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                    : 'text-[#E9E7D8] hover:bg-white/10'
                }`}
              >
                <UserRound size={18} />
                <span>My Profile</span>
                {currentView === 'profile' && <span className="text-xs ml-auto">● Active</span>}
              </a>

              {/* My Registrations (if authenticated and available) */}
              {session && onNavigateToMyRegistrations && (
                <a
                  href="#my-registrations"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsMobileMenuOpen(false)
                    onNavigateToMyRegistrations()
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                    currentView === 'my-registrations'
                      ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                      : 'text-[#E9E7D8] hover:bg-white/10'
                  }`}
                >
                  <CalendarDays size={18} />
                  <span>My Registrations</span>
                  {currentView === 'my-registrations' && (
                    <span className="text-xs ml-auto">● Active</span>
                  )}
                </a>
              )}

              {/* University Portal / Organizer Dashboard */}
              {session && (isUniversity || onNavigateToOrganizer || currentView === 'organizer') && (
                <a
                  href="#organizer"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsMobileMenuOpen(false)
                    handleOrganizerNav()
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer ${
                    currentView === 'organizer'
                      ? 'bg-[#F5F04A] text-[#050505] font-extrabold shadow-[2px_2px_0_#fff]'
                      : 'text-[#E9E7D8] hover:bg-white/10'
                  }`}
                >
                  <Building2 size={18} />
                  <span>University Portal</span>
                  {currentView === 'organizer' && (
                    <span className="text-xs ml-auto">● Active</span>
                  )}
                </a>
              )}
            </nav>

            <div className="mt-5 border-t border-white/15 pt-4">
              {session ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    onSignOut?.()
                  }}
                  className="inline-flex w-full min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-full border border-red-500/40 bg-red-950/40 text-xs font-bold text-red-200 hover:bg-red-900/60 transition-colors"
                >
                  <LogOut size={13} />
                  <span>Sign Out ({displayName})</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      onNavigateToLogin()
                    }}
                    className="outline-button !min-h-[40px] w-full justify-center !text-xs font-bold cursor-pointer"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      onNavigateToSignup()
                    }}
                    className="join-button !min-h-[40px] w-full justify-center !text-xs font-bold !bg-[#F5F04A] cursor-pointer"
                  >
                    Create account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Sticky Mobile Bottom Navigation Bar (Ultra-responsive & ergonomic for mobile touch) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#050505]/95 backdrop-blur-md border-t-2 border-[#050505] shadow-[0_-4px_20px_rgba(0,0,0,0.4)] pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 px-2"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Home */}
          <button
            type="button"
            onClick={onNavigateToHome}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
              currentView === 'landing'
                ? 'bg-[#F5F04A] text-[#050505] font-black shadow-[1.5px_1.5px_0_#fff]'
                : 'text-[#E9E7D8]/75 hover:text-[#E9E7D8]'
            }`}
          >
            <House size={18} />
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">Home</span>
          </button>

          {/* Explore Hackathons */}
          <button
            type="button"
            onClick={handleExploreNav}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
              currentView === 'explore'
                ? 'bg-[#F5F04A] text-[#050505] font-black shadow-[1.5px_1.5px_0_#fff]'
                : 'text-[#E9E7D8]/75 hover:text-[#E9E7D8]'
            }`}
          >
            <Compass size={18} />
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">Explore</span>
          </button>

          {/* Arena / Coding Games */}
          <button
            type="button"
            onClick={onNavigateToHackathons}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
              currentView === 'hackathons'
                ? 'bg-[#F5F04A] text-[#050505] font-black shadow-[1.5px_1.5px_0_#fff]'
                : 'text-[#E9E7D8]/75 hover:text-[#E9E7D8]'
            }`}
          >
            <Swords size={18} />
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">Arena</span>
          </button>

          {/* Community */}
          <button
            type="button"
            onClick={onNavigateToCommunity}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
              currentView === 'community'
                ? 'bg-[#F5F04A] text-[#050505] font-black shadow-[1.5px_1.5px_0_#fff]'
                : 'text-[#E9E7D8]/75 hover:text-[#E9E7D8]'
            }`}
          >
            <Users size={18} />
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">Feed</span>
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={handleProfileNav}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
              currentView === 'profile'
                ? 'bg-[#F5F04A] text-[#050505] font-black shadow-[1.5px_1.5px_0_#fff]'
                : 'text-[#E9E7D8]/75 hover:text-[#E9E7D8]'
            }`}
          >
            <UserRound size={18} />
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">Profile</span>
          </button>
        </div>
      </nav>
    </>
  )
}
