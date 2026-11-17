/**
 * HackhIt — Phone OTP Authentication Component
 *
 * Implements SMS OTP authentication using Supabase signInWithOtp and verifyOtp.
 * Includes country-code selector (defaulting to India +91), E.164 normalization,
 * 6-digit OTP input with paste support, auto-advance, backspace handling,
 * resend countdown, and HackhIt editorial aesthetics.
 */

import React, { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Phone,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit2,
  ShieldCheck,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface CountryCode {
  name: string
  code: string
  flag: string
  digits: number
}

const COUNTRY_CODES: CountryCode[] = [
  { name: 'India', code: '+91', flag: '🇮🇳', digits: 10 },
  { name: 'United States', code: '+1', flag: '🇺🇸', digits: 10 },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧', digits: 10 },
  { name: 'Canada', code: '+1', flag: '🇨🇦', digits: 10 },
  { name: 'Australia', code: '+61', flag: '🇦🇺', digits: 9 },
  { name: 'Germany', code: '+49', flag: '🇩🇪', digits: 10 },
  { name: 'Singapore', code: '+65', flag: '🇸🇬', digits: 8 },
  { name: 'UAE', code: '+971', flag: '🇦🇪', digits: 9 },
]

interface PhoneOtpAuthProps {
  onSuccess: (session: Session) => void
  onBackToEmail: () => void
  title?: string
  subtitle?: string
}

export function PhoneOtpAuth({
  onSuccess,
  onBackToEmail,
  title = 'Continue with Phone',
  subtitle = 'We will send a 6-digit verification code to your mobile number.',
}: PhoneOtpAuthProps) {
  // Step: 'input_phone' | 'verify_otp'
  const [step, setStep] = useState<'input_phone' | 'verify_otp'>('input_phone')

  // Phone state
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]) // Default India (+91)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Loading & general errors
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  // Resend countdown timer (60s)
  const [resendCountdown, setResendCountdown] = useState(0)

  // Handle countdown tick
  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  // Clean and normalize phone number
  const getNormalizedPhone = (): string => {
    const digitsOnly = phoneNumber.replace(/\D/g, '')
    return `${selectedCountry.code}${digitsOnly}`
  }

  // Validate phone input
  const validatePhone = (): boolean => {
    setPhoneError(null)
    setErrorMessage(null)

    const digitsOnly = phoneNumber.replace(/\D/g, '')
    if (!digitsOnly) {
      setPhoneError('Please enter your mobile phone number.')
      return false
    }

    // India specific format validation (10 digits)
    if (selectedCountry.code === '+91') {
      if (digitsOnly.length !== 10) {
        setPhoneError('Please enter a valid 10-digit Indian mobile number.')
        return false
      }
      if (!/^[6-9]/.test(digitsOnly)) {
        setPhoneError('Indian mobile numbers usually start with 6, 7, 8, or 9.')
        return false
      }
    } else {
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        setPhoneError('Please enter a valid phone number (7 to 15 digits).')
        return false
      }
    }

    return true
  }

  // Send OTP request
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (isLoading || isSubmittingRef.current) return

    if (!validatePhone()) return

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMessage('Authentication services are temporarily unavailable. Please try again shortly.')
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setErrorMessage(null)
    setPhoneError(null)

    const normalizedPhone = getNormalizedPhone()

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        const code = error.code || ''

        if (code === 'phone_provider_disabled' || msg.includes('unsupported phone provider')) {
          setErrorMessage(
            'Phone verification is not yet enabled on this project. Please enable the Phone provider in your dashboard.'
          )
        } else if (error.status === 429 || msg.includes('rate limit') || msg.includes('for security purposes')) {
          setErrorMessage('Too many verification requests. For security, please wait a few moments before trying again.')
        } else if (msg.includes('invalid') && msg.includes('phone')) {
          setPhoneError('The phone number format was rejected by the provider. Please check the number and country code.')
        } else {
          setErrorMessage(error.message || 'Unable to send verification code. Please try again.')
        }
        return
      }

      // Success: advance to OTP verification step
      setStep('verify_otp')
      setResendCountdown(60)
      setOtpDigits(['', '', '', '', '', ''])
      setOtpError(null)

      // Auto-focus first digit input after transition
      setTimeout(() => {
        otpInputRefs.current[0]?.focus()
      }, 100)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Network error sending verification code: ${msg}`)
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned && value !== '') return

    const newDigits = [...otpDigits]
    newDigits[index] = cleaned.slice(-1) // Take last entered digit
    setOtpDigits(newDigits)
    if (otpError) setOtpError(null)

    // Auto-advance to next box if digit was entered
    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  // Handle keyboard navigation (Backspace, arrows)
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Move to previous box and clear it
        otpInputRefs.current[index - 1]?.focus()
        const newDigits = [...otpDigits]
        newDigits[index - 1] = ''
        setOtpDigits(newDigits)
      } else {
        const newDigits = [...otpDigits]
        newDigits[index] = ''
        setOtpDigits(newDigits)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  // Handle Paste event for 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const digits = pastedData.replace(/\D/g, '').slice(0, 6)

    if (!digits) return

    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = digits[i] || ''
    }
    setOtpDigits(newDigits)
    if (otpError) setOtpError(null)

    // Focus either the next empty box or the last box
    const nextEmptyIndex = newDigits.findIndex((d) => d === '')
    if (nextEmptyIndex !== -1) {
      otpInputRefs.current[nextEmptyIndex]?.focus()
    } else {
      otpInputRefs.current[5]?.focus()
    }
  }

  // Verify OTP submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading || isSubmittingRef.current) return

    const fullCode = otpDigits.join('')
    if (fullCode.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.')
      return
    }

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMessage('Authentication services are temporarily unavailable. Please try again.')
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setOtpError(null)
    setErrorMessage(null)

    const normalizedPhone = getNormalizedPhone()

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: fullCode,
        type: 'sms',
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('invalid') || msg.includes('token') || msg.includes('code')) {
          setOtpError('The verification code you entered is invalid. Please double-check and try again.')
        } else if (msg.includes('expired')) {
          setOtpError('This verification code has expired. Please request a new code below.')
        } else {
          setOtpError(error.message || 'Verification failed. Please try again.')
        }
        return
      }

      if (data.session) {
        // Clear sensitive state from memory
        setOtpDigits(['', '', '', '', '', ''])
        onSuccess(data.session)
      } else {
        setErrorMessage('Verification completed, but no session was established. Please sign in.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setOtpError(`Connection error: ${msg}. Please check your connection and try again.`)
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }

  return (
    <div className="phone-auth-container">
      {/* Header */}
      <div className="border-b border-[#050505]/15 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold uppercase tracking-tight text-[#050505]">
            {step === 'input_phone' ? title : 'Verify Code'}
          </h2>
          <span className="rounded-full border border-[#050505] bg-[#F5F04A] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#050505]">
            SMS OTP
          </span>
        </div>
        <p className="mt-1 text-xs text-[#050505]/70">
          {step === 'input_phone'
            ? subtitle
            : `Enter the 6-digit code sent to ${selectedCountry.code} ${phoneNumber}`}
        </p>
      </div>

      {/* General Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border-[1.5px] border-red-600 bg-red-50 p-3 text-red-950"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <div className="text-xs">
            <strong className="block font-bold">Verification Notice</strong>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* STEP 1: Phone Number Input */}
      {step === 'input_phone' && (
        <form onSubmit={handleSendOtp} noValidate className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="phone-input"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505]"
            >
              Mobile Number
            </label>

            <div className="mt-1.5 flex gap-2">
              {/* Country Code Selector */}
              <div className="relative shrink-0">
                <select
                  id="country-code-select"
                  value={selectedCountry.code}
                  onChange={(e) => {
                    const found = COUNTRY_CODES.find((c) => c.code === e.target.value)
                    if (found) setSelectedCountry(found)
                    if (phoneError) setPhoneError(null)
                  }}
                  disabled={isLoading}
                  className="h-[46px] rounded-xl border-[1.5px] border-[#050505] bg-white px-2.5 text-xs font-bold text-[#050505] outline-none transition-all focus:ring-2 focus:ring-[#F5F04A] cursor-pointer"
                  aria-label="Select country code"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.name} value={c.code}>
                      {c.flag} {c.code} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone Input */}
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-[#050505]/50">
                  <Phone size={16} />
                </span>
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value)
                    if (phoneError) setPhoneError(null)
                  }}
                  placeholder={selectedCountry.code === '+91' ? '98765 43210' : 'Mobile number'}
                  autoComplete="tel-national"
                  disabled={isLoading}
                  className={`h-[46px] w-full rounded-xl border-[1.5px] bg-white pl-10 pr-3.5 font-medium text-xs text-[#050505] outline-none transition-all placeholder:text-[#050505]/35 focus:ring-2 focus:ring-[#F5F04A] ${
                    phoneError
                      ? 'border-red-600 bg-red-50/40'
                      : 'border-[#050505] focus:border-[#050505]'
                  }`}
                />
              </div>
            </div>

            {phoneError && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-600">
                {phoneError}
              </p>
            )}

            <p className="mt-1.5 text-[10px] text-[#050505]/60">
              Standard SMS rates may apply. Selected: {selectedCountry.name} ({selectedCountry.code})
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="send-otp-button"
              disabled={isLoading}
              className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending Code...
                </>
              ) : (
                <>
                  Send Verification Code <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onBackToEmail}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#050505] hover:underline cursor-pointer"
            >
              <ArrowLeft size={13} />
              Return to email sign in
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: 6-Digit OTP Verification */}
      {step === 'verify_otp' && (
        <form onSubmit={handleVerifyOtp} noValidate className="mt-5 space-y-4">
          {/* Target number banner with Edit link */}
          <div className="flex items-center justify-between rounded-xl border border-[#050505]/20 bg-[#E9E7D8]/60 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs">{selectedCountry.flag}</span>
              <span className="font-mono text-xs font-bold text-[#050505]">
                {selectedCountry.code} {phoneNumber}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('input_phone')
                setOtpError(null)
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#050505] underline hover:opacity-80 cursor-pointer"
            >
              <Edit2 size={11} /> Edit number
            </button>
          </div>

          {/* 6-Digit Inputs Container */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#050505] text-center">
              Enter 6-Digit Security Code
            </label>

            <div className="mt-2.5 flex justify-center gap-2 sm:gap-2.5">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  className={`h-12 w-10 sm:h-13 sm:w-12 rounded-xl border-[2px] bg-white text-center font-mono text-lg font-extrabold text-[#050505] outline-none transition-all shadow-[2px_2px_0_#050505] focus:border-[#050505] focus:ring-2 focus:ring-[#F5F04A] ${
                    otpError
                      ? 'border-red-600 bg-red-50/40 text-red-900'
                      : 'border-[#050505]'
                  }`}
                  aria-label={`Digit ${idx + 1}`}
                />
              ))}
            </div>

            {otpError && (
              <p className="mt-2 text-center text-[11px] font-semibold text-red-600">
                {otpError}
              </p>
            )}
          </div>

          {/* Verify Action */}
          <div className="pt-2">
            <button
              type="submit"
              id="verify-otp-button"
              disabled={isLoading || otpDigits.join('').length !== 6}
              className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[2px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-extrabold uppercase tracking-wider text-[#050505] shadow-[3px_3px_0_#050505] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#050505] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Verifying Code...
                </>
              ) : (
                <>
                  Verify Code & Continue <CheckCircle2 size={16} />
                </>
              )}
            </button>
          </div>

          {/* Resend Countdown & Actions */}
          <div className="pt-2 text-center space-y-2">
            {resendCountdown > 0 ? (
              <p className="text-xs text-[#050505]/65">
                Didn't get the code? Resend in{' '}
                <strong className="font-mono font-bold text-[#050505]">{resendCountdown}s</strong>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#050505] hover:underline cursor-pointer"
              >
                <RefreshCw size={12} /> Resend verification code
              </button>
            )}

            <div>
              <button
                type="button"
                onClick={onBackToEmail}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#050505]/75 hover:text-[#050505] underline cursor-pointer"
              >
                <ArrowLeft size={12} />
                Use another sign-in method
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Safety notice */}
      <div className="mt-5 border-t border-[#050505]/10 pt-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#050505]/60 uppercase tracking-wider">
          <ShieldCheck size={12} />
          Encrypted one-time passcode verification
        </div>
      </div>
    </div>
  )
}
