'use client'

import { useState } from 'react'
import initializeFirestore from '@/scripts/initFirestore'

export default function InitDB() {
  const [status, setStatus] = useState('Ready to initialize')
  const [loading, setLoading] = useState(false)

  const handleInit = async () => {
    setLoading(true)
    setStatus('Initializing Firestore...')
    
    try {
      await initializeFirestore()
      setStatus('✅ Success! Collections created in Firestore')
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Initialize Firestore</h1>
        <p className="text-gray-600 mb-6">
          This will create the invites and friendships collections in your Firestore database.
        </p>
        
        <button 
          onClick={handleInit}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-all"
        >
          {loading ? 'Initializing...' : 'Initialize Collections'}
        </button>
        
        <p className="mt-4 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
          {status}
        </p>
      </div>
    </div>
  )
}