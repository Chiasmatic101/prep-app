// components/ScreenTimeTracker.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Monitor, Tv, Clock, CheckCircle, XCircle } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, getDoc } from 'firebase/firestore'

interface ScreenTimeEntry {
  device: string
  lastUsed: string
  blueFilterEnabled: boolean
  notes?: string
}

export const ScreensOff30Tracker: React.FC<{ 
  challengeId: string
  onComplete: () => void 
}> = ({ challengeId, onComplete }) => {
  const [screenEntries, setScreenEntries] = useState<ScreenTimeEntry[]>([])
  const [lastScreenTime, setLastScreenTime] = useState('')
  const [blueFilterEnabled, setBlueFilterEnabled] = useState(false)
  const [targetBedtime, setTargetBedtime] = useState('')
  const [completed, setCompleted] = useState(false)

  const devices = [
    { id: 'phone', label: 'Phone', icon: <Smartphone className="w-5 h-5" /> },
    { id: 'laptop', label: 'Laptop', icon: <Monitor className="w-5 h-5" /> },
    { id: 'tv', label: 'TV', icon: <Tv className="w-5 h-5" /> },
    { id: 'tablet', label: 'Tablet', icon: <Smartphone className="w-5 h-5" /> }
  ]

  useEffect(() => {
    loadTargetBedtime()
  }, [])

  const loadTargetBedtime = async () => {
    if (!auth.currentUser) return
    
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        // Get target bedtime from user's challenge setup or default
        setTargetBedtime(userData.targetBedtime || '22:30')
      }
    } catch (error) {
      console.error('Error loading target bedtime:', error)
    }
  }

  const calculateMinutesBeforeBed = () => {
    if (!lastScreenTime || !targetBedtime) return 0
    
    const screen = new Date(`2024-01-01T${lastScreenTime}`)
    const bed = new Date(`2024-01-01T${targetBedtime}`)
    
    return Math.round((bed.getTime() - screen.getTime()) / (1000 * 60))
  }

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    const minutesBeforeBed = calculateMinutesBeforeBed()
    const success = minutesBeforeBed >= 30
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'screenTime', today), {
        lastScreenTime,
        targetBedtime,
        minutesBeforeBed,
        blueFilterEnabled,
        success,
        timestamp: new Date(),
        challengeId
      })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging screen time:', error)
    }
  }

  const minutesBeforeBed = calculateMinutesBeforeBed()
  const meetsTarget = minutesBeforeBed >= 30

  return (
    <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-red-600 text-white">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Screens Off 30 Minutes Before Bed</h3>
          <p className="text-sm text-gray-600">Track your last screen use</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-800">Your Target Bedtime</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{targetBedtime}</div>
            <p className="text-sm text-blue-700 mt-1">
              Last screen use should be by {
                new Date(`2024-01-01T${targetBedtime}`).getTime() - 30 * 60 * 1000 > 0
                  ? new Date(new Date(`2024-01-01T${targetBedtime}`).getTime() - 30 * 60 * 1000)
                      .toTimeString().slice(0, 5)
                  : 'calculating...'
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What time did you last use a screen?
            </label>
            <input
              type="time"
              value={lastScreenTime}
              onChange={(e) => setLastScreenTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {lastScreenTime && (
            <div className={`rounded-lg p-4 border-2 ${
              meetsTarget 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {meetsTarget ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span className={`font-semibold ${
                  meetsTarget ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {minutesBeforeBed} minutes before bed
                </span>
              </div>
              <p className={`text-sm ${
                meetsTarget ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {meetsTarget 
                  ? '✓ Great job! You met the 30-minute target!' 
                  : '⚠ Try to put screens away earlier tomorrow'}
              </p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={blueFilterEnabled}
                onChange={(e) => setBlueFilterEnabled(e.target.checked)}
                className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
              />
              <div>
                <span className="font-medium text-gray-800">
                  Blue light filter enabled
                </span>
                <p className="text-sm text-gray-600">
                  Night Shift, Night Mode, or similar feature active
                </p>
              </div>
            </label>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3">Alternative Activities</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">📖</span>
                <span>Read a physical book or e-reader (no backlight)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">🧘</span>
                <span>Gentle stretching or meditation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">📝</span>
                <span>Journal about your day</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">🎵</span>
                <span>Listen to calming music (eyes closed)</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleComplete}
            disabled={!lastScreenTime}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Log Screen Time
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800 mb-2">Logged!</h4>
          <p className="text-gray-600">
            {meetsTarget 
              ? '🎉 You met your goal! Keep it up!' 
              : '📱 Tomorrow try putting screens away earlier'}
          </p>
        </motion.div>
      )}
    </div>
  )
}