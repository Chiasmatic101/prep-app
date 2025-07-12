'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { doc, getDoc, addDoc, collection, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { X, Clock, Utensils, Dumbbell, Moon } from 'lucide-react'

// Types
interface UserData {
  name: string
  email: string
  age: number
  chronotype?: {
    chronotype: string
    outOfSync: number
  }
  responses?: {
    animalType: string
    bestMentalTime: string
    alertTime: string
    idealWakeTime: string
    preferredSleepTime: string
    morningFeel: string
    difficultyWaking: string
    [key: string]: string
  }
}

interface DietEntry {
  time: string
  type: 'Light' | 'Medium' | 'Heavy'
  description?: string
}

interface ActivityEntry {
  time: string
  type: 'Light' | 'Medium' | 'Intense'
  activity: string
  duration: number
}

interface SleepEntry {
  bedTime: string
  wakeTime: string
  date: string
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
}

// Diet Modal Component
const DietModal: React.FC<ModalProps> = ({ isOpen, onClose, onSave }) => {
  const [dietEntry, setDietEntry] = useState<DietEntry>({
    time: '',
    type: 'Medium',
    description: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(dietEntry)
    setDietEntry({ time: '', type: 'Medium', description: '' })
    onClose()
  }

  const mealTypes = [
    { 
      type: 'Light' as const, 
      emoji: '🥗', 
      description: 'Snacks, fruits, light salads',
      examples: 'Apple, yogurt, crackers, small salad'
    },
    { 
      type: 'Medium' as const, 
      emoji: '🍽️', 
      description: 'Regular meals, balanced portions',
      examples: 'Sandwich, pasta, regular lunch/dinner'
    },
    { 
      type: 'Heavy' as const, 
      emoji: '🍖', 
      description: 'Large meals, multiple courses',
      examples: 'Thanksgiving dinner, buffet, large portions'
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2">
                <Utensils className="w-6 h-6" />
                Track Your Meal
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Meal Time
                </label>
                <input
                  type="time"
                  value={dietEntry.time}
                  onChange={(e) => setDietEntry(prev => ({ ...prev, time: e.target.value }))}
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Meal Type
                </label>
                <div className="space-y-3">
                  {mealTypes.map((meal) => (
                    <label
                      key={meal.type}
                      className={`block p-4 border rounded-xl cursor-pointer transition-all hover:border-pink-400 ${
                        dietEntry.type === meal.type 
                          ? 'border-pink-500 bg-pink-50/50' 
                          : 'border-gray-200 bg-white/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mealType"
                        value={meal.type}
                        checked={dietEntry.type === meal.type}
                        onChange={(e) => setDietEntry(prev => ({ ...prev, type: e.target.value as any }))}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{meal.emoji}</span>
                        <div>
                          <div className="font-semibold text-gray-800">{meal.type} Meal</div>
                          <div className="text-sm text-gray-600 mb-1">{meal.description}</div>
                          <div className="text-xs text-gray-500">{meal.examples}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What did you eat? (Optional)
                </label>
                <textarea
                  value={dietEntry.description}
                  onChange={(e) => setDietEntry(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Chicken salad with vegetables"
                  rows={2}
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
              >
                Save Meal Entry
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Activity Modal Component
const ActivityModal: React.FC<ModalProps> = ({ isOpen, onClose, onSave }) => {
  const [activityEntry, setActivityEntry] = useState<ActivityEntry>({
    time: '',
    type: 'Medium',
    activity: '',
    duration: 30
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(activityEntry)
    setActivityEntry({ time: '', type: 'Medium', activity: '', duration: 30 })
    onClose()
  }

  const activityTypes = [
    { 
      type: 'Light' as const, 
      emoji: '🚶', 
      description: 'Low intensity, relaxed movement',
      examples: 'Walking, playing outside, stretching, casual games'
    },
    { 
      type: 'Medium' as const, 
      emoji: '🏃', 
      description: 'Moderate intensity, some effort',
      examples: 'Softball practice, bike riding, dancing, swimming'
    },
    { 
      type: 'Intense' as const, 
      emoji: '💪', 
      description: 'High intensity, challenging workout',
      examples: 'Running, soccer, basketball, gym workout'
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2">
                <Dumbbell className="w-6 h-6" />
                Track Your Activity
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Activity Time
                </label>
                <input
                  type="time"
                  value={activityEntry.time}
                  onChange={(e) => setActivityEntry(prev => ({ ...prev, time: e.target.value }))}
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Activity Intensity
                </label>
                <div className="space-y-3">
                  {activityTypes.map((activity) => (
                    <label
                      key={activity.type}
                      className={`block p-4 border rounded-xl cursor-pointer transition-all hover:border-pink-400 ${
                        activityEntry.type === activity.type 
                          ? 'border-pink-500 bg-pink-50/50' 
                          : 'border-gray-200 bg-white/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="activityType"
                        value={activity.type}
                        checked={activityEntry.type === activity.type}
                        onChange={(e) => setActivityEntry(prev => ({ ...prev, type: e.target.value as any }))}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{activity.emoji}</span>
                        <div>
                          <div className="font-semibold text-gray-800">{activity.type} Intensity</div>
                          <div className="text-sm text-gray-600 mb-1">{activity.description}</div>
                          <div className="text-xs text-gray-500">{activity.examples}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What activity did you do?
                </label>
                <input
                  type="text"
                  value={activityEntry.activity}
                  onChange={(e) => setActivityEntry(prev => ({ ...prev, activity: e.target.value }))}
                  placeholder="e.g., Soccer practice, Morning jog, Dance class"
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={activityEntry.duration}
                  onChange={(e) => setActivityEntry(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                  min="5"
                  max="480"
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
              >
                Save Activity Entry
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Sleep Modal Component
const SleepModal: React.FC<ModalProps> = ({ isOpen, onClose, onSave }) => {
  const [sleepEntry, setSleepEntry] = useState<SleepEntry>({
    bedTime: '',
    wakeTime: '',
    date: new Date().toISOString().split('T')[0]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(sleepEntry)
    setSleepEntry({ bedTime: '', wakeTime: '', date: new Date().toISOString().split('T')[0] })
    onClose()
  }

  const calculateSleepDuration = () => {
    if (!sleepEntry.bedTime || !sleepEntry.wakeTime) return ''
    
    const bedTime = new Date(`${sleepEntry.date}T${sleepEntry.bedTime}`)
    let wakeTime = new Date(`${sleepEntry.date}T${sleepEntry.wakeTime}`)
    
    if (wakeTime <= bedTime) {
      wakeTime.setDate(wakeTime.getDate() + 1)
    }
    
    const diffMs = wakeTime.getTime() - bedTime.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hours}h ${minutes}m`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2">
                <Moon className="w-6 h-6" />
                Track Your Sleep
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sleep Date
                </label>
                <input
                  type="date"
                  value={sleepEntry.date}
                  onChange={(e) => setSleepEntry(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🌙 Bedtime
                </label>
                <input
                  type="time"
                  value={sleepEntry.bedTime}
                  onChange={(e) => setSleepEntry(prev => ({ ...prev, bedTime: e.target.value }))}
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ☀️ Wake Time
                </label>
                <input
                  type="time"
                  value={sleepEntry.wakeTime}
                  onChange={(e) => setSleepEntry(prev => ({ ...prev, wakeTime: e.target.value }))}
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              {sleepEntry.bedTime && sleepEntry.wakeTime && (
                <div className="bg-purple-50/80 rounded-xl p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">Total Sleep Duration</div>
                  <div className="text-2xl font-bold text-purple-700">{calculateSleepDuration()}</div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
              >
                Save Sleep Entry
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function AboutMePage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dietModalOpen, setDietModalOpen] = useState(false)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [sleepModalOpen, setSleepModalOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData)
          } else {
            setError('User profile not found')
          }
        } catch (err) {
          console.error('Error fetching user data:', err)
          setError('Failed to load profile')
        }
      } else {
        router.push('/auth')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleSaveDiet = async (data: DietEntry) => {
    try {
      if (auth.currentUser) {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'dietEntries'), {
          ...data,
          timestamp: new Date(),
          date: new Date().toISOString().split('T')[0]
        })
        setSaveSuccess('Meal entry saved successfully! 🍽️')
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving diet entry:', error)
      setError('Failed to save meal entry')
    }
  }

  const handleSaveActivity = async (data: ActivityEntry) => {
    try {
      if (auth.currentUser) {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'activityEntries'), {
          ...data,
          timestamp: new Date(),
          date: new Date().toISOString().split('T')[0]
        })
        setSaveSuccess('Activity entry saved successfully! 🏃')
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving activity entry:', error)
      setError('Failed to save activity entry')
    }
  }

  const handleSaveSleep = async (data: SleepEntry) => {
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'sleepEntries', data.date), {
          ...data,
          timestamp: new Date(),
          sleepDuration: calculateSleepDuration(data.bedTime, data.wakeTime, data.date)
        })
        setSaveSuccess('Sleep entry saved successfully! 🌙')
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving sleep entry:', error)
      setError('Failed to save sleep entry')
    }
  }

  const calculateSleepDuration = (bedTime: string, wakeTime: string, date: string) => {
    const bedDateTime = new Date(`${date}T${bedTime}`)
    let wakeDateTime = new Date(`${date}T${wakeTime}`)
    
    if (wakeDateTime <= bedDateTime) {
      wakeDateTime.setDate(wakeDateTime.getDate() + 1)
    }
    
    const diffMs = wakeDateTime.getTime() - bedDateTime.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    return { hours, minutes, totalMinutes: Math.floor(diffMs / (1000 * 60)) }
  }

  const getChronotypeEmoji = (chronotype: string) => {
    switch (chronotype) {
      case 'Lion': return '🦁'
      case 'Bear': return '🐻'
      case 'Wolf': return '🐺'
      case 'Dolphin': return '🐬'
      default: return '🧠'
    }
  }

  const getSyncStatus = (outOfSync: number) => {
    if (outOfSync <= 30) return { status: 'Well Synced', color: 'text-green-600', bg: 'bg-green-50' }
    if (outOfSync <= 60) return { status: 'Moderately Synced', color: 'text-yellow-600', bg: 'bg-yellow-50' }
    return { status: 'Out of Sync', color: 'text-red-600', bg: 'bg-red-50' }
  }

  const syncStatus = userData?.chronotype ? getSyncStatus(userData.chronotype.outOfSync) : null

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading your profile...</p>
        </motion.div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-md"
        >
          <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/auth')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full font-medium transition"
          >
            Go to Login
          </button>
        </motion.div>
      </main>
    )
  }

  if (!userData) return null

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50"
          >
            {saveSuccess}
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Welcome, <span className="text-pink-500">{userData.name}</span>! 👋
          </h1>
          <p className="text-lg text-gray-700">Here's your personalized learning profile</p>
        </motion.div>

        {/* Main Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          {userData.chronotype ? (
            <div className="text-center">
              <div className="text-6xl mb-4">
                {getChronotypeEmoji(userData.chronotype.chronotype)}
              </div>
              <h2 className="text-3xl font-bold text-purple-700 mb-2">
                {userData.chronotype.chronotype} Chronotype
              </h2>
              <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
                {userData.chronotype.chronotype === 'Lion' && 'Early risers who are most productive in the morning. Natural leaders who prefer to wake up early and get things done.'}
                {userData.chronotype.chronotype === 'Bear' && 'Follow the solar cycle and are most productive during the day. They make up about 55% of the population.'}
                {userData.chronotype.chronotype === 'Wolf' && 'Night owls who are most creative and productive in the evening. They prefer to sleep in and stay up late.'}
                {userData.chronotype.chronotype === 'Dolphin' && 'Light sleepers with erratic routines who struggle with traditional schedules. Highly intelligent and cautious.'}
              </p>
              
              {syncStatus && (
                <div className={`inline-flex items-center px-4 py-2 rounded-full ${syncStatus.bg} border`}>
                  <span className={`font-semibold ${syncStatus.color}`}>
                    Sync Status: {syncStatus.status} ({userData.chronotype.outOfSync}%)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🧠</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Chronotype Assessment Needed</h2>
              <p className="text-gray-600 mb-6">Complete your chronotype quiz to unlock personalized insights!</p>
              <button
                onClick={() => router.push('/chronotype-quiz')}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
              >
                Take Quiz Now
              </button>
            </div>
          )}
        </motion.div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Basic Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              📊 Basic Info
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium text-sm">{userData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Age:</span>
                <span className="font-medium">{userData.age} years old</span>
              </div>
            </div>
          </motion.div>

          {/* My Brain */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-xl p-6 border border-purple-200 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              🧠 My Brain
            </h3>
            <div className="space-y-3">
              {userData.chronotype ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium flex items-center text-sm">
                      {getChronotypeEmoji(userData.chronotype.chronotype)} {userData.chronotype.chronotype}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sync Status:</span>
                    <span className={`font-medium text-sm ${getSyncStatus(userData.chronotype.outOfSync).color}`}>
                      {getSyncStatus(userData.chronotype.outOfSync).status}
                    </span>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => router.push('/my-brain')}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      View Details
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-gray-600 text-sm mb-3">Complete your assessment</p>
                  <button
                    onClick={() => router.push('/chronotype-quiz')}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full text-xs font-medium transition"
                  >
                    Take Quiz
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* My Life */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="bg-gradient-to-br from-green-50 to-blue-100 rounded-xl p-6 border border-green-200 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              🌱 My Life
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setDietModalOpen(true)}
                className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🍽️ Diet
              </button>
              <button
                onClick={() => setActivityModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🏃 Activity
              </button>
              <button
                onClick={() => setSleepModalOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🌙 Sleep
              </button>
            </div>
          </motion.div>
        </div>

        {/* Optimal Times Section - Now separate and full width */}
        {userData.responses && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg mb-8"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              ⏰ Your Optimal Times
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <span className="text-gray-600 block mb-1">Best Mental Performance</span>
                <span className="font-medium">{userData.responses.bestMentalTime}</span>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block mb-1">Most Alert</span>
                <span className="font-medium">{userData.responses.alertTime}</span>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block mb-1">Ideal Wake Time</span>
                <span className="font-medium">{userData.responses.idealWakeTime}</span>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block mb-1">Preferred Sleep Time</span>
                <span className="font-medium">{userData.responses.preferredSleepTime}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Animal Type Card */}
        {userData.responses?.animalType && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6 border border-white/40 shadow-lg mb-8"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-3">🔍 Your Learning Style</h3>
            <p className="text-gray-700 text-lg">{userData.responses.animalType}</p>
          </motion.div>
        )}

        {/* Optimization Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h3 className="text-2xl font-bold text-purple-700 mb-6 text-center">
            🎯 Optimizing Your Cognition For
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Learning Card */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📚</div>
                <h4 className="text-xl font-bold text-blue-700 mb-3">Learning</h4>
                <p className="text-blue-600 text-sm mb-4">
                  Optimize your brain for absorbing new information and building understanding
                </p>
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                  Get Learning Tips
                </button>
              </div>
            </div>

            {/* Exam Prep Card */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📝</div>
                <h4 className="text-xl font-bold text-orange-700 mb-3">Exam Prep</h4>
                <p className="text-orange-600 text-sm mb-4">
                  Enhance memory consolidation and review strategies for effective preparation
                </p>
                <button className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                  Get Prep Strategies
                </button>
              </div>
            </div>

            {/* Exam Performance Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎯</div>
                <h4 className="text-xl font-bold text-green-700 mb-3">Exam Performance</h4>
                <p className="text-green-600 text-sm mb-4">
                  Maximize focus, recall, and mental clarity during test-taking
                </p>
                <button className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                  Get Performance Tips
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="text-center space-y-4"
        >
          <div className="space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
            >
              📈 View Dashboard
            </button>
            <button
              onClick={() => router.push('/chronotype-quiz')}
              className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-8 py-3 rounded-full font-semibold border border-purple-300 transition-all hover:scale-105"
            >
              🔄 Retake Quiz
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            Your chronotype helps us recommend the best study times and techniques for you
          </p>
        </motion.div>

        {/* Lifestyle Tracking Modals */}
        <DietModal 
          isOpen={dietModalOpen} 
          onClose={() => setDietModalOpen(false)} 
          onSave={handleSaveDiet} 
        />
        <ActivityModal 
          isOpen={activityModalOpen} 
          onClose={() => setActivityModalOpen(false)} 
          onSave={handleSaveActivity} 
        />
        <SleepModal 
          isOpen={sleepModalOpen} 
          onClose={() => setSleepModalOpen(false)} 
          onSave={handleSaveSleep} 
        />
      </div>
    </main>
  )
}