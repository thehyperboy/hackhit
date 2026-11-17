/**
 * HackhIt — Login Screen Component
 *
 * Dedicated login screen for Phase 2, Step 2.
 * Connects to Supabase Auth using signInWithPassword, with client-side validation,
 * password visibility toggle, restrained animations, and HackhIt editorial aesthetics.
 */

import React, { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  LogOut,
  Sparkles,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import brandLogo from '../assets/hackhit-logo-sticker.png'
import { GoogleIcon } from './GoogleIcon'
import { PhoneOtpAuth } from './PhoneOtpAuth'

interface LoginScreenProps {
  onBackToHome: () => void
  onNavigateToSignup?: () => void
  onNavigateToCommunity?: () => void
  onLoginSuccess?: (redirectTarget?: string) => void
  redirectTarget?: string
  currentSession?: Session | null
  onSessionChange?: (session: Session | null) => void
  initialEmail?: string
}

export function LoginScreen({
  onBackToHome,
  onNavigateToSignup,
  onNavigateToCommunity,
  onLoginSuccess,
  redirectTarget,
  currentSession: initialSession,
  onSessionChange,
  initialEmail = '',
}: LoginScreenProps) {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(initialSession ?? null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const isSubmittingRef = useRef(false)

  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  // Field validation errors
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Listen to Supabase auth state changes
  useEffect(() => {
    if (!supabase) return

    // Fetch active session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        onSessionChange?.(data.session)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      onSessionChange?.(currentSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [onSessionChange])

  // Client-side input validation
  const validateInputs = (): boolean => {
    let isValid = true
    setEmailError(null)
    setPasswordError(null)
    setErrorMessage(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setEmailError('Please enter your campus email address.')
      isValid = false
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        setEmailError('Please enter a valid email format (e.g., student@university.edu).')
        isValid = false
      }
    }

    if (!password) {
      setPasswordError('Please enter your password.')
      isValid = false
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      isValid = false
    }

    return isValid
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading || isSubmittingRef.current || cooldownSeconds > 0) return

    if (!validateInputs()) return

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMessage(
        'Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local.'
      )
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) {
        const msg = error.message.toLowerCase()

        if (msg.includes('fetch failed') || msg.includes('failed to fetch')) {
          setErrorMessage(
            'Unable to reach the Supabase authentication server. Your free-tier project may be paused due to inactivity. Please check and unpause/restore it in your Supabase Dashboard.'
          )
        } else if (msg.includes('invalid login credentials') || error.status === 400) {
          setErrorMessage(
            'Invalid email or password. Please verify your credentials and try again.'
          )
        } else if (msg.includes('email not confirmed')) {
          setErrorMessage(
            'Your email address has not been confirmed yet. Please verify your email via the confirmation link sent to your inbox.'
          )
        } else if (error.status === 429 || msg.includes('too many requests')) {
          setErrorMessage(
            'Too many sign-in attempts. Please wait a minute before trying again.'
          )
          setCooldownSeconds(60)
        } else {
          setErrorMessage(error.message || 'Unable to sign in. Please try again.')
        }
        return
      }

      if (data.session) {
        setSession(data.session)
        onSessionChange?.(data.session)
        // Clear password from component memory after successful authentication
        setPassword('')
        if (onLoginSuccess) {
          onLoginSuccess(redirectTarget)
        } else if (redirectTarget === 'community' && onNavigateToCommunity) {
          onNavigateToCommunity()
        } else if (onBackToHome) {
          onBackToHome()
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('fetch failed') || msg.toLowerCase().includes('failed to fetch')) {
        setErrorMessage(
          'Unable to reach the Supabase authentication server. Your free-tier project may be paused due to inactivity. Please check and unpause/restore it in your Supabase Dashboard.'
        )
      } else {
        setErrorMessage(`Network error: ${msg}. Please check your connection.`)
      }
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    if (!supabase) return
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      setSession(null)
      onSessionChange?.(null)
      setEmail('')
      setPassword('')
      setErrorMessage(null)
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Google OAuth sign-in
  const handleGoogleSignIn = async () => {
    if (isLoading || isGoogleLoading || isSubmittingRef.current) return

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMessage(
        'Authentication services are temporarily unavailable. Please try again shortly.'
      )
      return
    }

    setIsGoogleLoading(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('provider is not enabled') || msg.includes('disabled')) {
          setErrorMessage(
            'Google sign-in is not yet enabled on this project. Please configure Google provider credentials in your dashboard.'
          )
        } else {
          setErrorMessage(error.message || 'Unable to start Google sign-in. Please try again.')
        }
        setIsGoogleLoading(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Connection error initiating Google sign-in: ${msg}`)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="login-screen-view min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      {/* Top Header inside the view */}
      <header className="w-full bg-[#050505] text-[#E9E7D8] border-b-2 border-[#050505] sticky top-0 z-40 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToHome}
            className="brand flex items-center gap-2 cursor-pointer bg-transparent border-none p-0 group"
            aria-label="Back to HackhIt Home"
          >
            <img
              src={brandLogo}
              alt="HackhIt Logo"
              className="brand-logo h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
              width={106}
              height={34}
            />
          </button>

          <nav className="hidden sm:flex items-center" aria-label="Login navigation">
            <span className="text-[#E9E7D8]/80 text-xs font-semibold tracking-wider uppercase">
              Campus Community
            </span>
          </nav>

          {onNavigateToSignup ? (
            <button
              type="button"
              onClick={onNavigateToSignup}
              className="join-button cursor-pointer text-xs"
            >
              Create account <ArrowRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onBackToHome}
              className="join-button cursor-pointer text-xs"
            >
              <ArrowLeft size={13} /> Back to Home
            </button>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="login-layout-grid">
        {/* Left Editorial Section */}
        <div className="reveal">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#050505] shadow-[2px_2px_0_#050505]">
            <Sparkles size={12} />
            Campus Social Network
          </div>

          <h1 className="display-font mt-4 text-5xl md:text-6xl lg:text-7xl leading-[0.95] text-[#050505]">
            WELCOME
            <br />
            BACK TO
            <br />
            HACKHIT.
          </h1>

          <p className="mt-5 max-w-[420px] text-sm text-[#39382f] leading-relaxed">
            Sign in with your registered student account to browse hackathons, connect with university peers, and access your campus events.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              ✳ Verified Students
            </span>
            <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              ⚡ Fast Access
            </span>
            <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              🛡 Verified Network
            </span>
          </div>
        </div>

        {/* Right Form / Session Card */}
        <div className="reveal reveal-delay-1">
          {session ? (
            /* Logged-In Active Session State */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              <div className="flex items-center justify-between border-b border-[#050505]/15 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-[#050505] bg-emerald-400 text-[#050505]">
                    <CheckCircle2 size={20} />
                  </span>
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-tight text-[#050505]">
                      Active Session
                    </h2>
                    <p className="text-xs text-[#050505]/70">
                      Connected to your campus account
                    </p>
                  </div>
                </div>

                <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#050505]">
                  Logged In
                </span>
              </div>

              <div className="mt-6 space-y-3.5 rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/50 p-4">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#050505]/60">
                    User Account
                  </span>
                  <p className="mt-0.5 font-mono text-xs font-bold text-[#050505]">
                    {session.user.email || session.user.phone || 'Campus Member'}
                  </p>
                </div>

                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#050505]/60">
                    User ID
                  </span>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[#050505]/80">
                    {session.user.id}
                  </p>
                </div>

                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#050505]/60">
                    Last Sign In
                  </span>
                  <p className="mt-0.5 text-xs text-[#050505]/80">
                    {session.user.last_sign_in_at
                      ? new Date(session.user.last_sign_in_at).toLocaleString()
                      : 'Just now'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                {onNavigateToCommunity ? (
                  <button
                    type="button"
                    onClick={onNavigateToCommunity}
                    className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Go to Community Feed <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Go to Campus Home <ArrowRight size={14} />
                  </button>
                )}

                {onNavigateToCommunity && (
                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-colors hover:bg-neutral-100"
                  >
                    Campus Home
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-colors hover:bg-red-50 hover:text-red-700 active:translate-y-0"
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  Sign Out
                </button>
              </div>
            </div>
          ) : authMethod === 'phone' ? (
            /* Phone OTP Flow */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              <PhoneOtpAuth
                title="Sign in with Phone"
                subtitle="Enter your mobile number to receive a one-time verification code."
                onSuccess={(newSession) => {
                  setSession(newSession)
                  onSessionChange?.(newSession)
                  setAuthMethod('email')
                  if (onLoginSuccess) {
                    onLoginSuccess(redirectTarget)
                  } else if (onNavigateToCommunity) {
                    onNavigateToCommunity()
                  }
                }}
                onBackToEmail={() => {
                  setAuthMethod('email')
                  setErrorMessage(null)
                }}
              />
            </div>
          ) : (
            /* Login Form Card */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              <div className="border-b border-[#050505]/15 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold uppercase tracking-tight text-[#050505]">
                    Student Sign In
                  </h2>
                  <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#050505]">
                    Student Access
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#050505]/70">
                  Choose your sign-in method or enter your credentials.
                </p>
              </div>

              {/* Server-level Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border-[1.5px] border-red-600 bg-red-50 p-3 text-red-950"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                  <div className="text-xs">
                    <strong className="block font-bold">Sign-in Notice</strong>
                    <span className="leading-relaxed">{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Social & Phone Sign-In Options */}
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  id="google-signin-button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-[2px] border-[#050505] bg-white px-5 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2.5px_2.5px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[3.5px_3.5px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isGoogleLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <GoogleIcon size={17} />
                  )}
                  Continue with Google
                </button>

                <button
                  type="button"
                  id="phone-signin-toggle"
                  onClick={() => {
                    setAuthMethod('phone')
                    setErrorMessage(null)
                  }}
                  disabled={isLoading || isGoogleLoading}
                  className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-all hover:bg-[#E9E7D8]/60 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  <Smartphone size={15} />
                  Continue with phone
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#050505]/20"></div>
                </div>
                <span className="relative bg-[#fffef8] px-3 text-[10px] font-extrabold uppercase tracking-widest text-[#050505]/50">
                  or with email
                </span>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                  >
                    Campus Email
                  </label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                      <Mail size={16} />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError(null)
                      }}
                      placeholder="student@university.edu"
                      autoComplete="email"
                      disabled={isLoading}
                      className={`h-[46px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-3.5 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
                        emailError
                          ? 'border-red-600 bg-red-50/40'
                          : 'border-[#050505] focus:border-[#050505]'
                      }`}
                    />
                  </div>
                  {emailError && (
                    <p className="mt-1 text-[11px] font-semibold text-red-600">
                      {emailError}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                  >
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                      <Lock size={16} />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (passwordError) setPasswordError(null)
                      }}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className={`h-[46px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-11 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
                        passwordError
                          ? 'border-red-600 bg-red-50/40'
                          : 'border-[#050505] focus:border-[#050505]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#050505]/60 hover:text-[#050505] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-1 text-[11px] font-semibold text-red-600">
                      {passwordError}
                    </p>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="login-submit-button"
                    disabled={isLoading || isGoogleLoading || cooldownSeconds > 0}
                    className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Signing In...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      <>
                        Please wait {cooldownSeconds}s
                      </>
                    ) : (
                      <>
                        Log In to HackhIt <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Link to Create Account */}
              <div className="mt-6 border-t border-[#050505]/10 pt-4 text-center">
                <p className="text-xs text-[#050505]/75">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={onNavigateToSignup}
                    className="font-bold text-[#050505] underline decoration-[#F5F04A] decoration-2 hover:opacity-80 cursor-pointer"
                  >
                    Create an account
                  </button>
                </p>
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#050505]/60 uppercase tracking-wider">
                  <ShieldCheck size={12} />
                  Protected student network
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </main>
    </div>
  )
}
