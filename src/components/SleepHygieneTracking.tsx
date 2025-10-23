// components/SleepHygieneTracking.tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Moon, Sun, Volume2, Thermometer, Lightbulb } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, setDoc } from 'firebase/firestore'

interface SleepRoutineTrackerProps {
  challengeId: string
  onComplete: () => void
}

export const DimDownTracker: React.FC<SleepRoutineTrackerProps> = ({ challengeId, onComplete }) => {
  const [completed, setCompleted] = useState(false)
  const [dimDownTime, setDimDownTime] = useState('')
  const [activities, setActivities] = useState<string[]>([])

  const dimDownActivities = [
    'Dimmed lights to warm/amber',
    'Turned off bright overhead lights',
    'Closed curtains/blinds',
    'Enabled blue light filter on devices',
    'Set phone to night mode'
  ]

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'sleepRoutine', today), {
        dimDownCompleted: true,
        dimDownTime,
        activities,
        timestamp: new Date(),
        challengeId
      }, { merge: true })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging dim-down:', error)
    }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-indigo-600 text-white">
          <Moon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Evening Dim-Down Checklist</h3>
          <p className="text-sm text-gray-600">Complete your pre-sleep routine</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What time did you start dimming down?
            </label>
            <input
              type="time"
              value={dimDownTime}
              onChange={(e) => setDimDownTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Activities completed:
            </label>
            <div className="space-y-2">
              {dimDownActivities.map((activity, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActivities(prev => 
                      prev.includes(activity) 
                        ? prev.filter(a => a !== activity)
                        : [...prev, activity]
                    )
                  }}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    activities.includes(activity)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      activities.includes(activity)
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300'
                    }`}>
                      {activities.includes(activity) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="text-sm text-gray-700">{activity}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={!dimDownTime || activities.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Log Dim-Down Complete
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800 mb-2">Great Job!</h4>
          <p className="text-gray-600">Your dim-down routine is logged for today</p>
        </motion.div>
      )}
    </div>
  )
}

export const BedroomEnvironmentSetup: React.FC<SleepRoutineTrackerProps> = ({ 
  challengeId, 
  onComplete 
}) => {
  const [checklist, setChecklist] = useState({
    darkness: false,
    temperature: false,
    noise: false,
    comfort: false,
    safety: false
  })
  const [notes, setNotes] = useState('')
  const [completed, setCompleted] = useState(false)

  const environmentChecks = [
    {
      key: 'darkness',
      icon: <Moon className="w-5 h-5" />,
      title: 'Darkness',
      description: 'Blackout curtains, eye mask, or remove light sources',
      tips: ['Cover LED lights on devices', 'Use blackout curtains', 'Try a sleep mask']
    },
    {
      key: 'temperature',
      icon: <Thermometer className="w-5 h-5" />,
      title: 'Cool Temperature',
      description: 'Keep room between 65-68°F (18-20°C)',
      tips: ['Adjust thermostat', 'Use a fan', 'Choose lighter bedding']
    },
    {
      key: 'noise',
      icon: <Volume2 className="w-5 h-5" />,
      title: 'Minimal Noise',
      description: 'Use white noise machine or earplugs if needed',
      tips: ['Try white noise app', 'Use earplugs', 'Close windows if noisy outside']
    },
    {
      key: 'comfort',
      icon: <Lightbulb className="w-5 h-5" />,
      title: 'Comfortable Space',
      description: 'Comfortable mattress, pillows, and bedding',
      tips: ['Adjust pillow height', 'Clean sheets weekly', 'Ensure proper mattress support']
    },
    {
      key: 'safety',
      icon: <CheckCircle className="w-5 h-5" />,
      title: 'Space & Safety',
      description: 'Clear clutter, ensure good air flow',
      tips: ['Remove clutter', 'Open window for fresh air', 'Keep space clean']
    }
  ]

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    const completedCount = Object.values(checklist).filter(Boolean).length
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'bedroomSetup', 'current'), {
        ...checklist,
        completedCount,
        totalItems: environmentChecks.length,
        notes,
        lastUpdated: new Date(),
        challengeId
      })
      
      // Also log daily tracking
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'sleepRoutine', today), {
        bedroomSetupMaintained: completedCount >= 4, // Need at least 4/5
        bedroomScore: (completedCount / environmentChecks.length) * 100,
        timestamp: new Date()
      }, { merge: true })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging bedroom setup:', error)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-blue-600 text-white">
          <Moon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Optimize Your Sleep Environment</h3>
          <p className="text-sm text-gray-600">
            Set up your room for better sleep (4/5 items required)
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {environmentChecks.map((check) => (
          <div key={check.key} className="bg-white rounded-lg p-4 border border-gray-200">
            <button
             onClick={() => setChecklist(prev => ({ ...prev, [check.key]: !prev[check.key as keyof typeof prev] }))}
              className="w-full"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  checklist[check.key as keyof typeof checklist]
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}>
                  {checklist[check.key as keyof typeof checklist] && (
                    <CheckCircle className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-blue-600">{check.icon}</div>
                    <h4 className="font-semibold text-gray-800">{check.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600">{check.description}</p>
                </div>
              </div>
            </button>
            
            <div className="ml-9 mt-2">
              <details className="text-sm">
                <summary className="text-blue-600 cursor-pointer hover:text-blue-700">
                  Tips & suggestions
                </summary>
                <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-600">
                  {check.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any specific changes you made or challenges you're facing..."
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Progress:</span>
          <span className="font-semibold text-blue-700">
            {Object.values(checklist).filter(Boolean).length}/{environmentChecks.length} items
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ 
              width: `${(Object.values(checklist).filter(Boolean).length / environmentChecks.length) * 100}%` 
            }}
          />
        </div>
      </div>

      {!completed ? (
        <button
          onClick={handleComplete}
          disabled={Object.values(checklist).filter(Boolean).length < 4}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
        >
          Save Environment Setup
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4"
        >
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-gray-800 mb-1">Environment Optimized!</h4>
          <p className="text-sm text-gray-600">
            Remember to maintain these conditions nightly
          </p>
        </motion.div>
      )}
    </div>
  )
}

export const SleepCoolDownRoutine: React.FC<SleepRoutineTrackerProps> = ({ 
  challengeId, 
  onComplete 
}) => {
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [duration, setDuration] = useState(20)
  const [startTime, setStartTime] = useState('')
  const [completed, setCompleted] = useState(false)

  const coolDownActivities = [
    { id: 'reading', label: 'Reading (physical book)', icon: '📖', duration: 15 },
    { id: 'stretching', label: 'Gentle stretching/yoga', icon: '🧘', duration: 10 },
    { id: 'breathing', label: 'Breathing exercises', icon: '🫁', duration: 5 },
    { id: 'journaling', label: 'Journaling', icon: '📝', duration: 10 },
    { id: 'meditation', label: 'Meditation', icon: '🧠', duration: 10 },
    { id: 'music', label: 'Calming music', icon: '🎵', duration: 15 },
    { id: 'shower', label: 'Warm shower/bath', icon: '🚿', duration: 15 }
  ]

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'sleepRoutine', today), {
        coolDownCompleted: true,
        activities: selectedActivities,
        duration,
        startTime,
        timestamp: new Date(),
        challengeId
      }, { merge: true })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging cool-down routine:', error)
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-purple-600 text-white">
          <Moon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Sleep Cool-Down Routine</h3>
          <p className="text-sm text-gray-600">Build a consistent pre-sleep ritual</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose 2-3 activities for your routine:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {coolDownActivities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => {
                    setSelectedActivities(prev => 
                      prev.includes(activity.id)
                        ? prev.filter(id => id !== activity.id)
                        : prev.length < 3 ? [...prev, activity.id] : prev
                    )
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedActivities.includes(activity.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{activity.icon}</div>
                  <div className="text-sm font-medium text-gray-800">{activity.label}</div>
                  <div className="text-xs text-gray-500 mt-1">~{activity.duration} min</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Select {3 - selectedActivities.length} more activity(ies)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total routine duration (minutes):
            </label>
            <input
              type="range"
              min="10"
              max="45"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10 min</span>
              <span className="font-medium text-purple-700">{duration} minutes</span>
              <span>45 min</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What time will you start your routine?
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Aim to start 20-30 minutes before your target bedtime
            </p>
          </div>

          <button
            onClick={handleComplete}
            disabled={selectedActivities.length < 2 || !startTime}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Save My Routine
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800 mb-2">Routine Set!</h4>
          <p className="text-gray-600 mb-4">
            Follow this routine for {duration} minutes starting at {startTime}
          </p>
          <div className="bg-purple-50 rounded-lg p-4">
            <h5 className="font-semibold text-purple-800 mb-2">Your Activities:</h5>
            <div className="space-y-1">
              {selectedActivities.map(id => {
                const activity = coolDownActivities.find(a => a.id === id)
                return activity ? (
                  <div key={id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{activity.icon}</span>
                    <span>{activity.label}</span>
                  </div>
                ) : null
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
