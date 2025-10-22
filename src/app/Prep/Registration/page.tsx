'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { auth, db } from '@/firebase/config'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', age: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetError, setResetError] = useState('')
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleToggle = () => {
    setIsLogin(!isLogin)
    setError('')
    setSuccess('')
    // Clear form when switching modes
    setForm({ name: '', email: '', age: '', password: '' })
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetSuccess('')
    setResetLoading(true)

    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetSuccess('Password reset email sent! Check your inbox and follow the instructions to reset your password.')
      setResetEmail('')
      // Don't close modal immediately, let user see success message
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetSuccess('')
      }, 3000)
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setResetError('No account found with this email address.')
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address.')
      } else if (err.code === 'auth/too-many-requests') {
        setResetError('Too many reset attempts. Please try again later.')
      } else {
        setResetError(err.message || 'Failed to send reset email. Please try again.')
      }
    } finally {
      setResetLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError('')
    setSuccess('')
    setGoogleLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      // Optional: Add custom parameters
      provider.addScope('email')
      provider.addScope('profile')
      
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Check if this is a new user by looking in Firestore
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        // New user - save their data to Firestore
        await setDoc(userDocRef, {
          name: user.displayName || '',
          email: user.email || '',
          age: null, // We don't get age from Google
          createdAt: new Date(),
          authProvider: 'google',
          photoURL: user.photoURL || null,
        })

        setSuccess('Welcome to Prep! 🎓')
        // Redirect new users to chronotype survey
        router.push('/Prep/Registration/chronotype-survey')
      } else {
        setSuccess('Welcome back! 🎉')
        // Redirect existing users to About Me page
        router.push('/Prep/AboutMe')
      }

    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.')
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups and try again.')
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with the same email address but different sign-in credentials.')
      } else {
        setError(err.message || 'Google sign-in failed. Please try again.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password)
      setSuccess('Login successful! 🎉')
      
      // Redirect to About Me page after login
      router.push('/Prep/AboutMe')
      
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please register first.')
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // Check if user already exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, form.email)
      if (signInMethods.length > 0) {
        setError('An account with this email already exists. Please log in instead.')
        setLoading(false)
        return
      }

      // Create user account
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password)

      // Save user data to Firestore
      await setDoc(doc(db, 'users', userCred.user.uid), {
        name: form.name,
        email: form.email,
        age: parseInt(form.age),
        createdAt: new Date(),
        authProvider: 'email',
      })

      setSuccess('Welcome to Prep! 🎓')
      
      // Redirect after registration
      router.push('/Prep/Registration/chronotype-survey')

    } catch (err: any) {
      if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.')
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else {
        setError(err.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 py-12 px-6 font-sans">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Welcome to <span className="text-pink-500">Prep</span> 🎓
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            {isLogin ? 'Welcome back! Ready to optimize your learning?' : 'Join thousands of students optimizing their learning rhythm.'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white/30 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              {isLogin ? 'Login to Your Account' : 'Create Your Account'}
            </h2>
            
            {/* Toggle buttons */}
            <div className="flex bg-white/40 backdrop-blur-sm rounded-full p-1 mb-6 border border-white/40">
              <button
                type="button"
                onClick={() => isLogin && setIsLogin(false)}
                className={`flex-1 py-3 px-6 rounded-full font-medium transition-all ${
                  !isLogin 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => !isLogin && setIsLogin(true)}
                className={`flex-1 py-3 px-6 rounded-full font-medium transition-all ${
                  isLogin 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Login
              </button>
            </div>
          </div>

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={googleLoading || loading}
            className={`w-full mb-6 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${
              googleLoading || loading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-white hover:bg-gray-50 text-gray-700 shadow-lg hover:scale-105 active:scale-95 border border-gray-300'
            }`}
          >
            {googleLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in with Google...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/50 text-gray-600 rounded-full">or</span>
            </div>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {/* Name field - only for registration */}
            {!isLogin && (
              <div>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Full Name"
                  required
                  className="w-full p-4 bg-white/50 backdrop-blur-sm border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all placeholder-gray-600"
                />
              </div>
            )}

            <div>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                placeholder="Email Address"
                required
                className="w-full p-4 bg-white/50 backdrop-blur-sm border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all placeholder-gray-600"
              />
            </div>

            {/* Age field - only for registration */}
            {!isLogin && (
              <div>
                <input
                  name="age"
                  value={form.age}
                  onChange={handleChange}
                  type="number"
                  placeholder="Age"
                  required
                  min="1"
                  max="120"
                  className="w-full p-4 bg-white/50 backdrop-blur-sm border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all placeholder-gray-600"
                />
              </div>
            )}

            <div>
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                type="password"
                placeholder="Password"
                required
                minLength={6}
                className="w-full p-4 bg-white/50 backdrop-blur-sm border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all placeholder-gray-600"
              />
            </div>

            {/* Forgot Password Link - only show on login */}
            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-pink-600 hover:text-pink-800 font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                loading || googleLoading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-lg hover:scale-105 active:scale-95'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isLogin ? 'Logging in...' : 'Creating Account...'}
                </span>
              ) : (
                <>
                  {isLogin ? '🔓 Login' : '🚀 Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Error and Success Messages */}
          {error && (
            <div className="mt-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl">
              <p className="text-red-700 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}
          {success && (
            <div className="mt-6 p-4 bg-green-50/80 backdrop-blur-sm border border-green-200/50 rounded-xl">
              <p className="text-green-700 text-sm font-medium">✅ {success}</p>
            </div>
          )}

          {/* Additional Links */}
          <div className="mt-8 text-center">
            <p className="text-gray-700 text-sm">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={handleToggle}
                className="text-pink-600 hover:text-pink-800 font-semibold transition-colors"
              >
                {isLogin ? 'Register here' : 'Login here'}
              </button>
            </p>
          </div>
        </div>

        {/* Bottom text */}
        <div className="text-center mt-8">
          <p className="text-gray-600 text-sm">
            Join thousands of students who've already discovered their optimal learning rhythm
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full mx-4 border border-white/40 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h3>
              <p className="text-gray-600 text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full p-4 bg-white/50 backdrop-blur-sm border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all placeholder-gray-600"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setResetEmail('')
                    setResetError('')
                    setResetSuccess('')
                  }}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                    resetLoading
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white'
                  }`}
                >
                  {resetLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>

            {/* Reset Error and Success Messages */}
            {resetError && (
              <div className="mt-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl">
                <p className="text-red-700 text-sm font-medium">⚠️ {resetError}</p>
              </div>
            )}
            {resetSuccess && (
              <div className="mt-4 p-3 bg-green-50/80 backdrop-blur-sm border border-green-200/50 rounded-xl">
                <p className="text-green-700 text-sm font-medium">✅ {resetSuccess}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}