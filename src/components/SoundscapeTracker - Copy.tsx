// components/SoundscapeTracker.tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, Play, Pause, CheckCircle, Music } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, setDoc } from 'firebase/firestore'

interface SoundscapeSession {
  soundType: string
  startTime: string
  duration: number
  volumeLevel: number
  helpedSleep: boolean
}

export const SoundscapeTracker: React.FC<{
  challengeId: string
  onComplete: () => void
}> = ({ challengeId, onComplete }) => {
  const [selectedSound, setSelectedSound] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(15)
  const [volumeLevel, setVolumeLevel] = useState(30)
  const [helpedSleep, setHelpedSleep] = useState<boolean | null>(null)
  const [completed, setCompleted] = useState(false)

  const soundOptions = [
    { 
      id: 'white-noise', 
      label: 'White Noise', 
      icon: '🌫️',
      description: 'Consistent sound that masks other noises'
    },
    { 
      id: 'rain', 
      label: 'Rain Sounds', 
      icon: '🌧️',
      description: 'Gentle rainfall and thunder'
    },
    { 
      id: 'ocean', 
      label: 'Ocean Waves', 
      icon: '🌊',
      description: 'Rhythmic wave sounds'
    },
    { 
      id: 'forest', 
      label: 'Forest Sounds', 
      icon: '🌲',
      description: 'Birds, wind, and nature sounds'
    },
    { 
      id: 'fan', 
      label: 'Fan Sound', 
      icon: '💨',
      description: 'Consistent fan hum'
    },
    { 
      id: 'binaural', 
      label: 'Binaural Beats', 
      icon: '🎧',
      description: 'Frequency-based relaxation'
    },
    { 
      id: 'meditation', 
      label: 'Guided Meditation', 
      icon: '🧘',
      description: 'Calm voice guidance'
    },
    { 
      id: 'music', 
      label: 'Calm Music', 
      icon: '🎵',
      description: 'Soft instrumental music'
    }
  ]

  const handleComplete = async () => {
    if (!auth.currentUser || helpedSleep === null) return
    
    const today = new Date().toISOString().split('T')[0]
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'soundscapeSessions', today), {
        soundType: selectedSound,
        startTime,
        duration,
        volumeLevel,
        helpedSleep,
        timestamp: new Date(),
        challengeId
      })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging soundscape session:', error)
    }
  }

  const soundOption = soundOptions.find(s => s.id === selectedSound)

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-cyan-600 text-white">
          <Volume2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Soundscape Sleep Aid</h3>
          <p className="text-sm text-gray-600">Track your calming audio routine</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose your soundscape:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {soundOptions.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => setSelectedSound(sound.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedSound === sound.id
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 hover:border-cyan-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{sound.icon}</div>
                  <div className="text-sm font-medium text-gray-800 mb-1">
                    {sound.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    {sound.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedSound && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{soundOption?.icon}</span>
                  <div>
                    <h4 className="font-semibold text-blue-900">{soundOption?.label}</h4>
                    <p className="text-sm text-blue-700">{soundOption?.description}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  
                    href={`https://mynoise.net`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    myNoise.net
                  </a>
                  
                    href={`https://rainymood.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    RainyMood
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What time did you start listening?
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How long did you listen? {duration} minutes
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5 min</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Volume level: {volumeLevel}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={volumeLevel}
                  onChange={(e) => setVolumeLevel(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Quiet</span>
                  <span>Medium</span>
                  <span>Loud</span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  💡 Tip: Volume should be just loud enough to mask other sounds
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Did this help you relax/sleep?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setHelpedSleep(true)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      helpedSleep === true
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <CheckCircle className={`w-6 h-6 mx-auto mb-2 ${
                      helpedSleep === true ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div className="text-sm font-medium text-gray-800">Yes, helpful!</div>
                  </button>
                  <button
                    onClick={() => setHelpedSleep(false)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      helpedSleep === false
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <Music className={`w-6 h-6 mx-auto mb-2 ${
                      helpedSleep === false ? 'text-yellow-600' : 'text-gray-400'
                    }`} />
                    <div className="text-sm font-medium text-gray-800">Not really</div>
                  </button>
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={!startTime || helpedSleep === null}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
              >
                Log Soundscape Session
              </button>
            </>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800 mb-2">Session Logged!</h4>
          <p className="text-gray-600 mb-4">
            {helpedSleep 
              ? '🎵 Great! Keep using this soundscape consistently' 
              : '🔄 Try a different sound tomorrow to find what works best'}
          </p>
          {helpedSleep && (
            <div className="bg-cyan-50 rounded-lg p-3">
              <p className="text-sm text-cyan-800">
                💡 Tip: Use the same soundscape each night to create a sleep association
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}