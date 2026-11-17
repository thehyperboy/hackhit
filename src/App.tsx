import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'

import { HomePage } from './components/HomePage'
import { LoginScreen } from './components/LoginScreen'
import { CreateAccountScreen } from './components/CreateAccountScreen'
import { CommunityFeed } from './components/CommunityFeed'
import { StudentProfilePage } from './components/StudentProfilePage'
import { StudentProfileModal } from './components/StudentProfileModal'
import { HackathonDiscovery } from './components/HackathonDiscovery'
import { CodingGamesArena } from './components/CodingGamesArena'
import { HackathonDetails } from './components/HackathonDetails'
import { HackathonRegistration } from './components/HackathonRegistration'
import { MyRegistrations } from './components/MyRegistrations'
import { OrganizerDashboard } from './components/OrganizerDashboard'
import { supabase } from './lib/supabase'
import { normalizeUuid } from './lib/community'
import { fetchHackathons, REAL_WORLD_HACKATHONS } from './lib/hackathons'
import type { Hackathon, HackathonFilterState } from './types/hackathons'

function App() {
  const [currentView, setCurrentView] = useState<
    | 'landing'
    | 'explore'
    | 'login'
    | 'signup'
    | 'community'
    | 'hackathons'
    | 'hackathon-details'
    | 'hackathon-register'
    | 'my-registrations'
    | 'profile'
    | 'organizer'
  >(() => {
    const hash = window.location.hash
    if (hash === '#signup') return 'signup'
    if (hash.startsWith('#login')) return 'login'
    if (hash === '#community') return 'community'
    if (hash === '#organizer' || hash === '#organizer-dashboard') return 'organizer'
    if (hash === '#my-registrations' || hash === '#registrations') return 'my-registrations'
    if (hash.match(/^#hackathons?\/[^/?#]+\/register$/)) return 'hackathon-register'
    if (hash.match(/^#hackathons?\/[^/?#]+/)) return 'hackathon-details'
    if (hash === '#explore') return 'explore'
    if (hash === '#hackathons' || hash === '#games' || hash === '#arena') return 'hackathons'
    if (hash === '#profile' || hash === '#my-profile' || hash.match(/^#profiles?\/[^/?#]+/)) return 'profile'
    return 'landing'
  })
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>(() => {
    const match = window.location.hash.match(/^#hackathons?\/([^/?#]+)/)
    return match ? match[1] : ''
  })
  const [hackathonFilters, setHackathonFilters] = useState<HackathonFilterState>({
    searchQuery: '',
    category: 'All',
    mode: 'All',
    sortBy: 'closing-soon',
  })
  const [communityPrefill, setCommunityPrefill] = useState<string>('')
  const [session, setSession] = useState<Session | null>(null)
  const [prefilledEmail, setPrefilledEmail] = useState<string>('')
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string>('')
  const [allHackathons, setAllHackathons] = useState<Hackathon[]>(REAL_WORLD_HACKATHONS)

  useEffect(() => {
    fetchHackathons().then((res) => {
      if (res.hackathons && res.hackathons.length > 0) {
        setAllHackathons(res.hackathons)
      }
    })
  }, [])

  // Selected Profile ID for full-page profile or author inspection
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    const match = window.location.hash.match(/^#profiles?\/([^/?#]+)/)
    if (!match) return null
    const rawId = match[1]
    if (rawId === '[object%20Object]' || rawId === '[object Object]') {
      window.history.replaceState({}, document.title, window.location.pathname + '#profile')
      return null
    }
    return rawId
  })
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // Sync hash routing (#signup / #login / #community / #explore / #hackathons / #hackathons/:id / #profile / #home)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      const registerMatch = hash.match(/^#hackathons?\/([^/?#]+)\/register$/)
      const hackathonMatch = hash.match(/^#hackathons?\/([^/?#]+)/)
      const profileMatch = hash.match(/^#profiles?\/([^/?#]+)/)

      if (registerMatch) {
        setSelectedHackathonId(registerMatch[1])
        setCurrentView('hackathon-register')
      } else if (hackathonMatch) {
        setSelectedHackathonId(hackathonMatch[1])
        setCurrentView('hackathon-details')
      } else if (profileMatch && profileMatch[1] !== 'register') {
        const rawId = profileMatch[1]
        const validatedId = normalizeUuid(rawId)
        if (validatedId) {
          setSelectedProfileId(validatedId)
        } else if (rawId === '[object%20Object]' || rawId === '[object Object]') {
          // If the bug caused [object Object] in the URL, recover cleanly to #profile
          if (session?.user?.id) {
            setSelectedProfileId(session.user.id)
          } else {
            setSelectedProfileId(null)
          }
          window.history.replaceState({}, document.title, window.location.pathname + '#profile')
        } else {
          setSelectedProfileId(rawId)
        }
        setCurrentView('profile')
      } else if (hash === '#profile' || hash === '#my-profile') {
        if (session?.user?.id) {
          setSelectedProfileId(session.user.id)
        } else {
          setSelectedProfileId(null)
        }
        setCurrentView('profile')
      } else if (hash === '#signup') {
        setCurrentView('signup')
      } else if (hash.startsWith('#login')) {
        setCurrentView('login')
      } else if (hash === '#community') {
        setCurrentView('community')
      } else if (hash === '#organizer' || hash === '#organizer-dashboard') {
        setCurrentView('organizer')
      } else if (hash === '#my-registrations' || hash === '#registrations') {
        setCurrentView('my-registrations')
      } else if (hash === '#explore') {
        setCurrentView('explore')
      } else if (hash === '#hackathons' || hash === '#games' || hash === '#arena') {
        setCurrentView('hackathons')
      } else if (hash === '#home' || !hash || hash === '#about') {
        setCurrentView('landing')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [session])

  // Listen to Supabase auth session and handle OAuth callbacks
  useEffect(() => {
    if (!supabase) return

    // Clean up OAuth error or access token parameters if returned
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const oauthError =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error')

    if (oauthError) {
      console.warn('Authentication callback error:', oauthError)
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'SIGNED_IN' && newSession) {
        // Remove OAuth hash fragments or search codes cleanly without full page refresh
        if (
          window.location.hash.includes('access_token') ||
          window.location.search.includes('code=')
        ) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        if (window.location.hash.startsWith('#login')) {
          window.location.hash = '#home'
          setCurrentView('landing')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const navigateToLogin = (redirect?: string, email?: string) => {
    if (email) setPrefilledEmail(email)
    if (redirect) setRedirectAfterLogin(redirect)
    window.location.hash = '#login'
    setCurrentView('login')
  }

  const navigateToSignup = () => {
    window.location.hash = '#signup'
    setCurrentView('signup')
  }

  const navigateToHome = () => {
    window.location.hash = '#home'
    setCurrentView('landing')
  }

  const navigateToCommunity = (prefill?: string) => {
    if (typeof prefill === 'string') {
      setCommunityPrefill(prefill)
    }
    window.location.hash = '#community'
    setCurrentView('community')
  }

  const navigateToExplore = () => {
    window.location.hash = '#explore'
    setCurrentView('explore')
  }

  const navigateToHackathons = () => {
    window.location.hash = '#hackathons'
    setCurrentView('hackathons')
  }

  const navigateToHackathonDetails = (id: string) => {
    setSelectedHackathonId(id)
    window.location.hash = `#hackathons/${id}`
    setCurrentView('hackathon-details')
  }

  const navigateToHackathonRegister = (id: string) => {
    setSelectedHackathonId(id)
    window.location.hash = `#hackathons/${id}/register`
    setCurrentView('hackathon-register')
  }

  const navigateToMyRegistrations = () => {
    window.location.hash = '#my-registrations'
    setCurrentView('my-registrations')
  }

  const navigateToProfile = (target?: string | { id?: string } | unknown) => {
    const validTargetId = normalizeUuid(target)

    if (validTargetId && (!session || validTargetId !== session.user.id)) {
      setSelectedProfileId(validTargetId)
      window.location.hash = `#profile/${validTargetId}`
      setCurrentView('profile')
    } else if (session?.user?.id) {
      setSelectedProfileId(session.user.id)
      window.location.hash = '#profile'
      setCurrentView('profile')
    } else {
      setSelectedProfileId(null)
      window.location.hash = '#profile'
      setCurrentView('profile')
    }
  }

  const navigateToOrganizer = () => {
    window.location.hash = '#organizer'
    setCurrentView('organizer')
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    navigateToHome()
  }

  const handleLoginSuccess = (target?: string) => {
    const dest = target || redirectAfterLogin
    setRedirectAfterLogin('')
    if (dest === 'community') {
      navigateToCommunity()
    } else if (dest === 'explore') {
      navigateToExplore()
    } else if (dest === 'hackathons') {
      navigateToHackathons()
    } else if (dest === 'my-registrations') {
      navigateToMyRegistrations()
    } else if (dest === 'profile') {
      navigateToProfile()
    } else if (dest === 'organizer') {
      navigateToOrganizer()
    } else if (dest?.startsWith('hackathons/') && dest.endsWith('/register')) {
      const match = dest.match(/^hackathons\/([^/]+)\/register$/)
      if (match) navigateToHackathonRegister(match[1])
      else navigateToExplore()
    } else if (dest?.startsWith('hackathons/')) {
      const match = dest.match(/^hackathons\/([^/]+)/)
      if (match) navigateToHackathonDetails(match[1])
      else navigateToExplore()
    } else {
      navigateToCommunity()
    }
  }

  return (
    <div className="site-shell min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      {currentView === 'login' ? (
        <LoginScreen
          onBackToHome={navigateToHome}
          onNavigateToSignup={navigateToSignup}
          onNavigateToCommunity={() => navigateToCommunity()}
          onLoginSuccess={handleLoginSuccess}
          redirectTarget={redirectAfterLogin}
          currentSession={session}
          onSessionChange={setSession}
          initialEmail={prefilledEmail}
        />
      ) : currentView === 'signup' ? (
        <CreateAccountScreen
          onBackToHome={navigateToHome}
          onNavigateToLogin={(email) => navigateToLogin('', email)}
          currentSession={session}
          onSessionChange={setSession}
        />
      ) : currentView === 'community' ? (
        <CommunityFeed
          session={session}
          onNavigateToHome={navigateToHome}
          onNavigateToLogin={navigateToLogin}
          onNavigateToSignup={navigateToSignup}
          onSignOut={handleSignOut}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToProfile={navigateToProfile}
          initialDraft={communityPrefill}
        />
      ) : currentView === 'explore' ? (
        <HackathonDiscovery
          session={session}
          filters={hackathonFilters}
          onFiltersChange={setHackathonFilters}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={() => navigateToCommunity()}
          onNavigateToExplore={navigateToExplore}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToLogin={() => navigateToLogin('explore')}
          onNavigateToSignup={navigateToSignup}
          onSignOut={handleSignOut}
          onOpenProfile={navigateToProfile}
          onSelectHackathon={(hackathon) => navigateToHackathonDetails(hackathon.id)}
        />
      ) : currentView === 'hackathons' ? (
        <CodingGamesArena
          session={session}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={() => navigateToCommunity()}
          onNavigateToExplore={navigateToExplore}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToProfile={navigateToProfile}
          onNavigateToOrganizer={navigateToOrganizer}
          onNavigateToLogin={() => navigateToLogin('hackathons')}
          onNavigateToSignup={navigateToSignup}
          onSignOut={handleSignOut}
        />
      ) : currentView === 'hackathon-details' ? (
        <HackathonDetails
          hackathonId={selectedHackathonId}
          session={session}
          onNavigateBack={navigateToExplore}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={navigateToCommunity}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToLogin={() => navigateToLogin(`hackathons/${selectedHackathonId}`)}
          onNavigateToSignup={navigateToSignup}
          onNavigateToRegister={navigateToHackathonRegister}
          onSignOut={handleSignOut}
          onOpenProfile={navigateToProfile}
        />
      ) : currentView === 'hackathon-register' ? (
        <HackathonRegistration
          hackathonId={selectedHackathonId}
          session={session}
          onNavigateBack={() => navigateToHackathonDetails(selectedHackathonId)}
          onNavigateToEventDetails={(id) => navigateToHackathonDetails(id)}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToCommunity={navigateToCommunity}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToLogin={() => navigateToLogin(`hackathons/${selectedHackathonId}/register`)}
          onNavigateToSignup={navigateToSignup}
          onNavigateToHome={navigateToHome}
          onSignOut={handleSignOut}
          onOpenProfile={navigateToProfile}
        />
      ) : currentView === 'my-registrations' ? (
        <MyRegistrations
          session={session}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={navigateToCommunity}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToEventDetails={navigateToHackathonDetails}
          onNavigateToLogin={() => navigateToLogin('my-registrations')}
          onNavigateToSignup={navigateToSignup}
          onSignOut={handleSignOut}
          onOpenProfile={navigateToProfile}
        />
      ) : currentView === 'profile' ? (
        <StudentProfilePage
          userId={selectedProfileId}
          session={session}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={navigateToCommunity}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToProfile={navigateToProfile}
          onNavigateToLogin={() => navigateToLogin('profile')}
          onNavigateToSignup={navigateToSignup}
          onSignOut={handleSignOut}
        />
      ) : currentView === 'organizer' ? (
        <OrganizerDashboard
          session={session}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={() => navigateToCommunity()}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToProfile={navigateToProfile}
          onNavigateToLogin={(redirect) => navigateToLogin(redirect || 'organizer')}
          onNavigateToSignup={navigateToSignup}
          onNavigateToEventDetails={navigateToHackathonDetails}
          onSignOut={handleSignOut}
        />
      ) : (
        <HomePage
          hackathons={allHackathons}
          session={session}
          onNavigateToHome={navigateToHome}
          onNavigateToCommunity={() => navigateToCommunity()}
          onNavigateToExplore={navigateToExplore}
          onNavigateToHackathons={navigateToHackathons}
          onNavigateToHackathonDetails={navigateToHackathonDetails}
          onNavigateToHackathonRegister={navigateToHackathonRegister}
          onNavigateToMyRegistrations={navigateToMyRegistrations}
          onNavigateToProfile={navigateToProfile}
          onNavigateToOrganizer={navigateToOrganizer}
          onNavigateToLogin={(redirect) => navigateToLogin(redirect)}
          onNavigateToSignup={navigateToSignup}
          onSignOut={handleSignOut}
        />
      )}

      {/* Global Student Profile Modal */}
      {selectedProfileId && (
        <StudentProfileModal
          userId={selectedProfileId}
          currentUserId={session?.user?.id}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false)
            setSelectedProfileId(null)
          }}
        />
      )}
    </div>
  )
}

export default App
