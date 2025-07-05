'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AuthMode = 'signup' | 'login'

interface FormData {
  email: string
  password: string
}

export default function SignupPage() {
  const [mode, setMode] = useState<AuthMode>('signup')
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' })
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 🚀 Redirect after fake login/signup
      router.push('/games/reaction')
    } catch (error) {
      console.error('Authentication error:', error)
      // Handle error here (show toast, etc.)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = (): void => {
    setMode(prev => prev === 'signup' ? 'login' : 'signup')
    setFormData({ email: '', password: '' }) // Clear form when switching modes
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-20">
      <div className="bg-gray-900 p-10 rounded-xl shadow-lg w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">
          {mode === 'signup' ? 'Create an Account' : 'Log In to Max'}
        </h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            required
            disabled={isLoading}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            required
            disabled={isLoading}
            minLength={6}
          />
          <button
            type="submit"
            disabled={isLoading || !formData.email || !formData.password}
            className="w-full py-2 bg-blue-600 rounded hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    fill="none" 
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                  />
                </svg>
                {mode === 'signup' ? 'Signing Up...' : 'Logging In...'}
              </span>
            ) : (
              mode === 'signup' ? 'Sign Up' : 'Log In'
            )}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                onClick={toggleMode}
                className="text-blue-400 hover:underline focus:outline-none focus:underline"
                disabled={isLoading}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={toggleMode}
                className="text-blue-400 hover:underline focus:outline-none focus:underline"
                disabled={isLoading}
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  )
}