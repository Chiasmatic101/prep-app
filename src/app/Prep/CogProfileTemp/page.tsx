'use client'
import React, { useEffect, useState } from 'react'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { CognitiveProfileDashboard } from '../../../components/CognitiveProfileDashboard'

export default function CognitiveDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('🆔 Your User ID:', user.uid)
        console.log('📧 Your Email:', user.email)
        setUserId(user.uid)
      } else {
        console.log('❌ No user logged in')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <CognitiveProfileDashboard />
    </main>
  )
}