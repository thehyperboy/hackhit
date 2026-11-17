/**
 * HackhIt — Create Account Screen
 *
 * Dedicated registration page matching HackhIt editorial aesthetics.
 * Connects to Supabase Auth signUp with metadata storage, client-side validation,
 * password visibility controls, and natural product wording ("Check your email").
 */

import React, { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Sparkles,
  User,
  Inbox,
  RefreshCw,
  Smartphone,
  GraduationCap,
  Building2,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { validateUniversityEmail } from '../lib/institutionalAuth'
import brandLogo from '../assets/hackhit-logo-sticker.png'
import { GoogleIcon } from './GoogleIcon'
import { PhoneOtpAuth } from './PhoneOtpAuth'

interface CreateAccountScreenProps {
  onBackToHome: () => void
  onNavigateToLogin: (prefilledEmail?: string) => void
  onSessionChange?: (session: Session | null) => void
  currentSession?: Session | null
}

export function CreateAccountScreen({
  onBackToHome,
  onNavigateToLogin,
  onSessionChange,
  currentSession,
}: CreateAccountScreenProps) {
  // Account role: 'student' | 'university'
  const [accountType, setAccountType] = useState<'student' | 'university'>('student')
  const [universityName, setUniversityName] = useState('')
  const [universityNameError, setUniversityNameError] = useState<string | null>(null)

  // Method: 'email' | 'phone'
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
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

  // Form fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Success view state
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isDirectSession, setIsDirectSession] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  // Field validation errors
  const [fullNameError, setFullNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  // Client-side validation
  const validateForm = (): boolean => {
    let isValid = true
    setFullNameError(null)
    setEmailError(null)
    setUniversityNameError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)
    setErrorMessage(null)

    if (accountType === 'university') {
      const trimmedUni = universityName.trim()
      if (!trimmedUni) {
        setUniversityNameError('Please enter your university or college name.')
        isValid = false
      } else if (trimmedUni.length < 3) {
        setUniversityNameError('University name must be at least 3 characters.')
        isValid = false
      }
    }

    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setFullNameError(
        accountType === 'university'
          ? 'Please enter the representative full name.'
          : 'Please enter your full name.'
      )
      isValid = false
    } else if (trimmedName.length < 2) {
      setFullNameError('Name must be at least 2 characters.')
      isValid = false
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setEmailError(
        accountType === 'university'
          ? 'Please enter your official college email.'
          : 'Please enter your email address.'
      )
      isValid = false
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        setEmailError('Please enter a valid email address.')
        isValid = false
      } else if (accountType === 'university') {
        const uVal = validateUniversityEmail(trimmedEmail)
        if (!uVal.isValid) {
          setEmailError(uVal.error || 'Universities must use an official college email address.')
          isValid = false
        }
      }
    }

    if (!password) {
      setPasswordError('Please enter a password.')
      isValid = false
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long.')
      isValid = false
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.')
      isValid = false
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      isValid = false
    }

    return isValid
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading || isSubmittingRef.current || cooldownSeconds > 0) return

    if (!validateForm()) return

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMessage(
        'Account services are temporarily unavailable. Please try again in a few moments.'
      )
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setErrorMessage(null)

    const trimmedEmail = email.trim()
    const trimmedName = fullName.trim()
    const trimmedUni = universityName.trim()

    const userMetadata: Record<string, unknown> = {
      full_name: trimmedName,
      role: accountType === 'university' ? 'university' : 'student',
    }

    if (accountType === 'university') {
      userMetadata.is_university = true
      userMetadata.organization_name = trimmedUni
      userMetadata.university = trimmedUni
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
        options: {
          data: userMetadata,
        },
      })

      if (error) {
        const msg = error.message.toLowerCase()
        const code = error.code || ''

        if (msg.includes('fetch failed') || msg.includes('failed to fetch')) {
          setErrorMessage(
            'Unable to reach the Supabase authentication server. Your free-tier project may be paused due to inactivity. Please check and restore it in your Supabase Dashboard.'
          )
        } else if (
          code === 'over_email_send_rate_limit' ||
          msg.includes('rate limit') ||
          msg.includes('for security purposes') ||
          error.status === 429
        ) {
          setErrorMessage(
            'The registration service has reached its hourly verification email limit. For security, please wait a minute before trying again, or contact the project administrator to enable custom SMTP.'
          )
          setCooldownSeconds(60)
        } else if (
          msg.includes('user already registered') ||
          msg.includes('already registered') ||
          msg.includes('email address is already')
        ) {
          setErrorMessage(
            'An account with this email address already exists. Please sign in instead.'
          )
        } else if (msg.includes('password') && msg.includes('characters')) {
          setErrorMessage('Password must be at least 6 characters long.')
        } else if (msg.includes('invalid') && msg.includes('email')) {
          setErrorMessage('Please provide a valid email address.')
        } else {
          setErrorMessage(error.message || 'Unable to create account. Please try again.')
        }
        return
      }

      // Check if user already exists (Supabase enumeration protection)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMessage(
          'An account with this email already exists. Please sign in instead.'
        )
        return
      }

      // Successful submission
      setSubmittedEmail(trimmedEmail)
      setIsSubmitted(true)

      // Clear sensitive password inputs from memory
      setPassword('')
      setConfirmPassword('')

      // If project has auto-confirm enabled and returned an active session
      if (data.session) {
        setIsDirectSession(true)
        onSessionChange?.(data.session)
      } else {
        setIsDirectSession(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Unable to connect. Please check your internet connection and try again. (${msg})`)
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }

  // Resend confirmation email
  const handleResendEmail = async () => {
    if (!supabase || !submittedEmail) return
    setIsResending(true)
    setResendStatus(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
      })

      if (error) {
        if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
          setResendStatus('Please wait a moment before requesting another email.')
        } else {
          setResendStatus(error.message)
        }
      } else {
        setResendStatus('Verification email resent! Please check your inbox.')
      }
    } catch {
      setResendStatus('Unable to resend email right now. Please try again shortly.')
    } finally {
      setIsResending(false)
    }
  }

  // Handle Google OAuth sign-in / registration
  const handleGoogleSignIn = async () => {
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
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Unable to connect to Google authentication: ${msg}`)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="login-screen-view min-h-screen bg-[#E9E7D8] text-[#050505] flex flex-col w-full">
      {/* Top Header */}
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

          <nav className="hidden sm:flex items-center" aria-label="Signup navigation">
            <span className="text-[#E9E7D8]/80 text-xs font-semibold tracking-wider uppercase">
              Campus Community
            </span>
          </nav>

          <button
            type="button"
            onClick={() => onNavigateToLogin()}
            className="join-button cursor-pointer text-xs"
          >
            Sign in <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="login-layout-grid">
        {/* Left Editorial Section */}
        <div className="reveal">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#050505] bg-[#F5F04A] px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#050505] shadow-[2px_2px_0_#050505]">
            <Sparkles size={12} />
            Join The Network
          </div>

          <h1 className="display-font mt-4 text-5xl md:text-6xl lg:text-7xl leading-[0.95] text-[#050505]">
            BUILD THE
            <br />
            FUTURE ON
            <br />
            YOUR CAMPUS.
          </h1>

          <p className="mt-5 max-w-[420px] text-sm text-[#39382f] leading-relaxed">
            Create your student account to discover hackathons, team up with peers from your university, and turn your boldest ideas into real projects.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              ✳ Campus Hackathons
            </span>
            <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              ⚡ Peer Collaboration
            </span>
            <span className="rounded-full border border-[#050505] bg-white px-3 py-1 text-xs font-bold text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              🛡 Verified Student Network
            </span>
          </div>
        </div>

        {/* Right Form / Success Card */}
        <div className="reveal reveal-delay-1">
          {currentSession ? (
            /* Active Session Card */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              <div className="flex items-center justify-between border-b border-[#050505]/15 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] text-[#050505]">
                    <CheckCircle2 size={24} />
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold uppercase tracking-tight text-[#050505]">
                      Active Session
                    </h2>
                    <p className="text-xs text-[#050505]/70">
                      Already connected to your campus account
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#050505]">
                  Logged In
                </span>
              </div>

              <div className="mt-6 space-y-3 rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/50 p-4">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#050505]/60">
                    Current Account
                  </span>
                  <p className="mt-0.5 font-mono text-xs font-bold text-[#050505]">
                    {currentSession.user.email || currentSession.user.phone || 'Campus Member'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Go to Campus Home <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase?.auth.signOut()
                    onSessionChange?.(null)
                  }}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : isSubmitted ? (
            /* Check Your Email / Success Card */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              <div className="flex items-center gap-3 border-b border-[#050505]/15 pb-4">
                <span className="grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] text-[#050505]">
                  {isDirectSession ? <CheckCircle2 size={24} /> : <Inbox size={24} />}
                </span>
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-tight text-[#050505]">
                    {isDirectSession ? 'Account Created' : 'Check Your Email'}
                  </h2>
                  <p className="text-xs text-[#050505]/70">
                    {isDirectSession
                      ? 'Your account is ready to use.'
                      : 'Verification link sent to your inbox.'}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/50 p-4.5">
                <p className="text-xs text-[#050505] leading-relaxed">
                  {isDirectSession ? (
                    <>
                      Welcome to HackhIt! Your account for{' '}
                      <strong className="font-mono">{submittedEmail}</strong> has been created.
                    </>
                  ) : (
                    <>
                      We sent a verification link to{' '}
                      <strong className="font-mono font-bold text-[#050505]">{submittedEmail}</strong>.
                      Please open the email and click the confirmation link to activate your student account.
                    </>
                  )}
                </p>
              </div>

              {resendStatus && (
                <div className="mt-4 rounded-xl border border-[#050505]/20 bg-white p-3 text-xs text-[#050505]">
                  {resendStatus}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateToLogin(submittedEmail)}
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2px_2px_0_#050505] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Proceed to Sign in <ArrowRight size={14} />
                </button>

                {!isDirectSession && (
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={isResending}
                    className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#E9E7D8]/60 disabled:opacity-60"
                  >
                    {isResending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    Resend verification email
                  </button>
                )}

                <button
                  type="button"
                  onClick={onBackToHome}
                  className="text-center text-xs font-semibold text-[#050505]/70 hover:text-[#050505] underline cursor-pointer pt-1"
                >
                  Return to home
                </button>
              </div>
            </div>
          ) : authMethod === 'phone' ? (
            /* Phone OTP Flow */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              <PhoneOtpAuth
                title="Create Account with Phone"
                subtitle="Enter your mobile number to get started with HackhIt."
                onSuccess={(newSession) => {
                  onSessionChange?.(newSession)
                  setAuthMethod('email')
                }}
                onBackToEmail={() => {
                  setAuthMethod('email')
                  setErrorMessage(null)
                }}
              />
            </div>
          ) : (
            /* Create Account Form Card */
            <div className="rounded-[24px] border-[2.5px] border-[#050505] bg-[#fffef8] p-7 md:p-9 shadow-[5px_5px_0_#050505]">
              {/* Dual Portal Switcher: Student vs. University */}
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border-[1.5px] border-[#050505] bg-[#E9E7D8]/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('student')
                    setErrorMessage(null)
                    setEmailError(null)
                    setUniversityNameError(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    accountType === 'student'
                      ? 'border-[1.5px] border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[2px_2px_0_#050505]'
                      : 'text-[#050505]/60 hover:text-[#050505]'
                  }`}
                >
                  <GraduationCap size={15} />
                  <span>Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('university')
                    setErrorMessage(null)
                    setEmailError(null)
                    setUniversityNameError(null)
                    setAuthMethod('email')
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    accountType === 'university'
                      ? 'border-[1.5px] border-[#050505] bg-[#050505] text-[#F5F04A] shadow-[2px_2px_0_#050505]'
                      : 'text-[#050505]/60 hover:text-[#050505]'
                  }`}
                >
                  <Building2 size={15} />
                  <span>University</span>
                </button>
              </div>

              <div className="border-b border-[#050505]/15 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold uppercase tracking-tight text-[#050505]">
                    {accountType === 'university'
                      ? 'University & Organizer Registration'
                      : 'Student Registration'}
                  </h2>
                  <span
                    className={`rounded-full border border-[#050505] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      accountType === 'university'
                        ? 'bg-[#050505] text-[#F5F04A]'
                        : 'bg-[#F5F04A] text-[#050505]'
                    }`}
                  >
                    {accountType === 'university' ? 'Official Campus Portal' : 'Student Portal'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#050505]/70">
                  {accountType === 'university'
                    ? 'Register your institution to create hackathons and track students.'
                    : 'Join HackhIt with personal email (Gmail, etc.) or Google.'}
                </p>
              </div>

              {/* University Role Explanatory Banner */}
              {accountType === 'university' && (
                <div className="mt-4 rounded-xl border border-[#050505] bg-[#F5F04A]/25 p-3 text-xs text-[#050505] flex items-start gap-2.5">
                  <Building2 size={16} className="shrink-0 mt-0.5 text-[#050505]" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Official College Faculty & Organizer Privilege</p>
                    <p className="text-[11px] text-[#050505]/80 leading-relaxed">
                      University representatives must use an official college domain (.edu, .ac.in, or university domain). Only verified universities can create hackathons, post announcements, and track registered students.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border-[1.5px] border-red-600 bg-red-50 p-3 text-red-950"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                  <div className="text-xs">
                    <strong className="block font-bold">Registration issue</strong>
                    <span className="leading-relaxed">{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Social & Phone Sign-Up Options (Student Only) */}
              {accountType === 'student' && (
                <>
                  <div className="mt-5 space-y-2.5">
                    <button
                      type="button"
                      id="google-signup-button"
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
                      id="phone-signup-toggle"
                      onClick={() => {
                        setAuthMethod('phone')
                        setErrorMessage(null)
                      }}
                      disabled={isLoading || isGoogleLoading}
                      className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-[2px] border-[#050505] bg-white px-5 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[2.5px_2.5px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[3.5px_3.5px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      <Smartphone size={17} />
                      Continue with phone
                    </button>
                  </div>

                  {/* Editorial Divider */}
                  <div className="relative my-6 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#050505]/20" />
                    </div>
                    <span className="relative bg-[#fffef8] px-3 text-[11px] font-extrabold uppercase tracking-widest text-[#050505]/60">
                      or register with email
                    </span>
                  </div>
                </>
              )}

              {/* Signup Form */}
              <form onSubmit={handleSubmit} noValidate className={`space-y-3.5 ${accountType === 'university' ? 'mt-5' : ''}`}>
                {/* University Name Field (University Only) */}
                {accountType === 'university' && (
                  <div>
                    <label
                      htmlFor="signup-university"
                      className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                    >
                      University / College Name *
                    </label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                        <Building2 size={16} />
                      </span>
                      <input
                        id="signup-university"
                        type="text"
                        value={universityName}
                        onChange={(e) => {
                          setUniversityName(e.target.value)
                          if (universityNameError) setUniversityNameError(null)
                        }}
                        placeholder="e.g. Malla Reddy University, IIT Hyderabad"
                        disabled={isLoading}
                        className={`h-[44px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-3.5 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
                          universityNameError
                            ? 'border-red-600 bg-red-50/40'
                            : 'border-[#050505] focus:border-[#050505]'
                        }`}
                      />
                    </div>
                    {universityNameError && (
                      <p className="mt-1 text-[11px] font-semibold text-red-600">
                        {universityNameError}
                      </p>
                    )}
                  </div>
                )}

                {/* Full Name Field */}
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                  >
                    {accountType === 'university' ? 'Representative Full Name *' : 'Full Name *'}
                  </label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                      <User size={16} />
                    </span>
                    <input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value)
                        if (fullNameError) setFullNameError(null)
                      }}
                      placeholder="e.g. Maya Lin"
                      autoComplete="name"
                      disabled={isLoading}
                      className={`h-[44px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-3.5 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
                        fullNameError
                          ? 'border-red-600 bg-red-50/40'
                          : 'border-[#050505] focus:border-[#050505]'
                      }`}
                    />
                  </div>
                  {fullNameError && (
                    <p className="mt-1 text-[11px] font-semibold text-red-600">
                      {fullNameError}
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                  >
                    {accountType === 'university'
                      ? 'Official College Email (.edu / .ac.in / university domain) *'
                      : 'Email Address (e.g. Gmail) *'}
                  </label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                      <Mail size={16} />
                    </span>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError(null)
                      }}
                      placeholder={
                        accountType === 'university'
                          ? 'faculty@mallareddyuniversity.ac.in'
                          : 'student@gmail.com'
                      }
                      autoComplete="email"
                      disabled={isLoading}
                      className={`h-[44px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-3.5 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
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
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="signup-password"
                      className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                    >
                      Password
                    </label>
                    <span className="text-[10px] text-[#050505]/60 font-semibold">
                      Min. 6 characters
                    </span>
                  </div>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                      <Lock size={16} />
                    </span>
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (passwordError) setPasswordError(null)
                      }}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className={`h-[44px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-11 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
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

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
                  >
                    Confirm Password
                  </label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                      <Lock size={16} />
                    </span>
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (confirmPasswordError) setConfirmPasswordError(null)
                      }}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className={`h-[44px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-11 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
                        confirmPasswordError
                          ? 'border-red-600 bg-red-50/40'
                          : 'border-[#050505] focus:border-[#050505]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#050505]/60 hover:text-[#050505] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPasswordError && (
                    <p className="mt-1 text-[11px] font-semibold text-red-600">
                      {confirmPasswordError}
                    </p>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="signup-submit-button"
                    disabled={isLoading || isGoogleLoading || cooldownSeconds > 0}
                    className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Creating Account...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      <>
                        Please wait {cooldownSeconds}s
                      </>
                    ) : (
                      <>
                        Create Account <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Link back to Sign In */}
              <div className="mt-5 border-t border-[#050505]/10 pt-4 text-center">
                <p className="text-xs text-[#050505]/75">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigateToLogin(email.trim())}
                    className="font-bold text-[#050505] underline decoration-[#F5F04A] decoration-2 hover:opacity-80 cursor-pointer"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      </main>
    </div>
  )
}
