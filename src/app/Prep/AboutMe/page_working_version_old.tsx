'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { doc, getDoc, addDoc, collection, setDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { X, Clock, Utensils, Dumbbell, Moon, TrendingUp, Brain, Target, Zap, BarChart, Activity, CheckCircle, ExternalLink } from 'lucide-react'
import { calculateEnhancedSyncScore, type CognitiveSession, type SleepEntry } from '../../../utils/syncScoreCalculator'
import LearningTimeline from '../../../components/LearningTimeline'

// Challenge-related type definitions
interface ChallengeProgress {
  challengeId: string
  startDate: string
  isActive: boolean
  currentDay: number
  totalDays: number
  dailyProgress: { [day: number]: boolean }
  targetValue?: string
  points: number
  completedDays: number
  notes?: string[]
}

interface UserChallengeData {
  activeChallenges: ChallengeProgress[]
  completedChallenges: ChallengeProgress[]
  totalPoints: number
  streaks: { [challengeId: string]: number }
}

interface Challenge {
  id: string
  title: string
  goal: string
  duration: string
  rules: string[]
  verification: string
  basePoints: number
  bonusPoints?: string
  icon: React.ReactNode
  color: string
  bgGradient: string
}

// Temporary CHALLENGES array - replace with your actual import
const CHALLENGES: Challenge[] = [
  {
    id: 'fifteen-minute-shift',
    title: '15-Minute Shift Week',
    goal: 'Nudge bedtime/wake time toward school schedule',
    duration: '7 days',
    rules: ['Shift target bedtime by ±15 min/day'],
    verification: 'Sleep timestamps within ±10 min of target',
    basePoints: 50,
    icon: <Clock className="w-6 h-6" />,
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-600'
  },
  {
    id: 'wake-time-anchor',
    title: 'Wake-Time Anchor Streak',
    goal: 'Lock a consistent wake time',
    duration: '10 days',
    rules: ['Wake within ±20 min of target time'],
    verification: 'Wearable wake or self-report; 8/10 days success',
    basePoints: 80,
    icon: <Target className="w-6 h-6" />,
    color: 'orange',
    bgGradient: 'from-orange-500 to-yellow-600'
  }
  // Add more challenges as needed...
]

interface ActiveChallengeDisplay {
  challengeId: string
  title: string
  currentDay: number
  totalDays: number
  completedDays: number
  todayTarget?: string
  icon: React.ReactNode
  color: string
  bgGradient: string
  isTimeBasedChallenge: boolean
}

// Updated UserData interface for AboutMe page to match Firebase structure
interface UserData {
  name: string
  email: string
  age?: number
  chronotype?: {
    chronotype: string
    outOfSync: number
    responses: Record<string, string>  // Complete survey responses
    timestamp: string
    syncScore?: number
  }
  syncScore?: number
  learningPhase?: number
  alignmentScores?: {
    school: number
    study: number
  }
}

interface EnhancedSyncData {
  syncScore: number
  schoolAlignment: number
  studyAlignment: number
  learningPhase: number
  adaptiveComponents: {
    observedAlignment: { school: number; study: number }
    predictedAlignment: { school: number; study: number }
    adaptationLevel: number
    domainReliability: Record<string, number>
  }
  sleepMetrics: {
    averageQuality: number
    consistency: number
    duration: number
  }
  learningTimeline: number[]
  chronotype: { chronotype: string; outOfSync: number }
}

interface DietEntry {
  time: string
  type: 'Light' | 'Medium' | 'Heavy'
  description?: string
}

interface HydrationEntry {
  time: string
  type: 'Water' | 'Coffee' | 'Tea' | 'Energy Drink' | 'Soda'
  amount: number
  caffeineContent?: number
}

interface NutritionEntry {
  meals: DietEntry[]
  hydration: HydrationEntry[]
  date: string
  timestamp: Date
  totalCaffeine: number
  totalFluids: number
  mealCount: number
}

interface ActivityEntry {
  time: string
  type: 'Light' | 'Medium' | 'Intense'
  activity: string
  duration: number
}

interface SleepEntryForm {
  bedTime: string
  wakeTime: string
  date: string
  wakingEvents?: number
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
}

// Helper functions
const getTodaysTarget = (progress: ChallengeProgress): string | undefined => {
  if (!progress.targetValue) return undefined
  
  if (progress.challengeId === 'fifteen-minute-shift') {
    const baseTime = new Date(`2024-01-01T${progress.targetValue}`)
    const shiftMinutes = (progress.currentDay - 1) * 15
    const targetTime = new Date(baseTime.getTime() + shiftMinutes * 60000)
    return `Bedtime: ${targetTime.toTimeString().slice(0, 5)}`
  }
  
  if (progress.challengeId === 'wake-time-anchor') {
    return `Wake by: ${progress.targetValue}`
  }
  
  return undefined
}

const getChallengeDisplayData = (progress: ChallengeProgress): ActiveChallengeDisplay | null => {
  const challengeInfo = CHALLENGES.find(c => c.id === progress.challengeId)
  if (!challengeInfo) return null
  
  const todayTarget = getTodaysTarget(progress)
  const isTimeBasedChallenge = ['fifteen-minute-shift', 'wake-time-anchor', 'weekend-drift-guard'].includes(progress.challengeId)
  
  return {
    challengeId: progress.challengeId,
    title: challengeInfo.title,
    currentDay: progress.currentDay,
    totalDays: progress.totalDays,
    completedDays: progress.completedDays,
    todayTarget,
    icon: challengeInfo.icon,
    color: challengeInfo.color,
    bgGradient: challengeInfo.bgGradient,
    isTimeBasedChallenge
  }
}

// Active Challenges Strip Component
const ActiveChallengesStrip: React.FC<{
  activeChallenges: ChallengeProgress[]
  onLogProgress: (challengeId: string, success: boolean) => void
  onViewAllChallenges: () => void
}> = ({ activeChallenges, onLogProgress, onViewAllChallenges }) => {
  if (activeChallenges.length === 0) return null

  const topChallenges = activeChallenges.slice(0, 2)
    .map(getChallengeDisplayData)
    .filter(Boolean) as ActiveChallengeDisplay[]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-r from-purple-100/80 to-pink-100/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/50 shadow-lg mb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
          <Target className="w-5 h-5" />
          My Active Challenges
        </h3>
        <button
          onClick={onViewAllChallenges}
          className="text-purple-700 hover:text-purple-800 text-sm font-medium flex items-center gap-1 hover:underline"
        >
          View All
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topChallenges.map((challenge) => (
          <div
            key={challenge.challengeId}
            className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${challenge.bgGradient} text-white`}>
                {challenge.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-800 text-sm truncate">
                  {challenge.title}
                </h4>
                <div className="text-xs text-gray-600">
                  Day {challenge.currentDay} of {challenge.totalDays}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>{challenge.completedDays}/{challenge.totalDays}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${challenge.bgGradient}`}
                  style={{ width: `${(challenge.completedDays / challenge.totalDays) * 100}%` }}
                />
              </div>
            </div>

            {challenge.todayTarget && (
              <div className="bg-blue-50/80 rounded-lg p-2 mb-3">
                <div className="text-xs text-blue-600 font-medium">Today's Target</div>
                <div className="text-sm font-semibold text-blue-800">{challenge.todayTarget}</div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => onLogProgress(challenge.challengeId, true)}
                className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                Success
              </button>
              <button
                onClick={() => onLogProgress(challenge.challengeId, false)}
                className="flex-1 bg-gray-400 hover:bg-gray-300 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-all"
              >
                Miss
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeChallenges.length > 2 && (
        <div className="mt-4 text-center">
          <div className="text-sm text-purple-700">
            +{activeChallenges.length - 2} more active challenge{activeChallenges.length - 2 > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Nutrition Modal Component
const NutritionModal: React.FC<ModalProps> = ({ isOpen, onClose, onSave }) => {
  const [meals, setMeals] = useState<DietEntry[]>([])
  const [hydration, setHydration] = useState<HydrationEntry[]>([])
  const [currentMeal, setCurrentMeal] = useState<DietEntry>({
    time: '',
    type: 'Medium',
    description: ''
  })
  const [currentHydration, setCurrentHydration] = useState<HydrationEntry>({
    time: '',
    type: 'Water',
    amount: 250,
    caffeineContent: 0
  })
  const [activeTab, setActiveTab] = useState<'meals' | 'hydration'>('meals')

  const mealTypes = [
    { 
      type: 'Light' as const, 
      emoji: '🥗', 
      description: 'Low intensity, quick consumption',
      examples: 'Snacks, fruits, light salads, beverages'
    },
    { 
      type: 'Medium' as const, 
      emoji: '🍽️', 
      description: 'Standard meals, moderate portions',
      examples: 'Lunch, dinner, balanced meals'
    },
    { 
      type: 'Heavy' as const, 
      emoji: '🍖', 
      description: 'Large meals, extended consumption',
      examples: 'Multi-course meals, celebration dinners'
    }
  ]

  const hydrationTypes = [
    { type: 'Water' as const, emoji: '💧', caffeine: 0, defaultAmount: 250 },
    { type: 'Coffee' as const, emoji: '☕', caffeine: 95, defaultAmount: 240 },
    { type: 'Tea' as const, emoji: '🍵', caffeine: 47, defaultAmount: 240 },
    { type: 'Energy Drink' as const, emoji: '⚡', caffeine: 80, defaultAmount: 250 },
    { type: 'Soda' as const, emoji: '🥤', caffeine: 34, defaultAmount: 355 }
  ]

  const addMeal = () => {
    if (currentMeal.time) {
      setMeals([...meals, currentMeal])
      setCurrentMeal({ time: '', type: 'Medium', description: '' })
    }
  }

  const addHydration = () => {
    if (currentHydration.time) {
      setHydration([...hydration, currentHydration])
      setCurrentHydration({
        time: '',
        type: 'Water',
        amount: 250,
        caffeineContent: 0
      })
    }
  }

  const removeMeal = (index: number) => {
    setMeals(meals.filter((_, i) => i !== index))
  }

  const removeHydration = (index: number) => {
    setHydration(hydration.filter((_, i) => i !== index))
  }

  const handleHydrationTypeChange = (type: HydrationEntry['type']) => {
    const hydType = hydrationTypes.find(h => h.type === type)
    setCurrentHydration(prev => ({
      ...prev,
      type,
      amount: hydType?.defaultAmount || 250,
      caffeineContent: hydType?.caffeine || 0
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nutritionEntry = {
      meals,
      hydration,
      date: new Date().toISOString().split('T')[0]
    }
    onSave(nutritionEntry)
    setMeals([])
    setHydration([])
    setCurrentMeal({ time: '', type: 'Medium', description: '' })
    setCurrentHydration({ time: '', type: 'Water', amount: 250, caffeineContent: 0 })
    onClose()
  }

  const getTotalCaffeine = () => {
    return hydration.reduce((total, entry) => total + (entry.caffeineContent || 0), 0)
  }

  const getTotalWater = () => {
    return hydration.reduce((total, entry) => total + entry.amount, 0)
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
            className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2">
                <Utensils className="w-6 h-6" />
                Track Nutrition & Hydration
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('meals')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'meals' 
                    ? 'bg-white text-purple-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🍽️ Meals ({meals.length})
              </button>
              <button
                onClick={() => setActiveTab('hydration')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'hydration' 
                    ? 'bg-white text-purple-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                💧 Hydration ({hydration.length})
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {activeTab === 'meals' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Meal Time
                    </label>
                    <input
                      type="time"
                      value={currentMeal.time}
                      onChange={(e) => setCurrentMeal(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Meal Classification
                    </label>
                    <div className="space-y-3">
                      {mealTypes.map((meal) => (
                        <label
                          key={meal.type}
                          className={`block p-4 border rounded-xl cursor-pointer transition-all hover:border-pink-400 ${
                            currentMeal.type === meal.type 
                              ? 'border-pink-500 bg-pink-50/50' 
                              : 'border-gray-200 bg-white/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="mealType"
                            value={meal.type}
                            checked={currentMeal.type === meal.type}
                            onChange={(e) => setCurrentMeal(prev => ({ ...prev, type: e.target.value as any }))}
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

                  <button
                    type="button"
                    onClick={addMeal}
                    disabled={!currentMeal.time}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
                  >
                    Add Meal
                  </button>

                  {meals.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700">Added Meals:</h4>
                      {meals.map((meal, index) => (
                        <div key={index} className="flex justify-between items-center bg-green-50 p-3 rounded-lg">
                          <div>
                            <span className="font-medium">{meal.time}</span> - 
                            <span className="text-green-700 ml-1">{meal.type}</span>
                            {meal.description && <div className="text-sm text-gray-600">{meal.description}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMeal(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'hydration' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Time
                    </label>
                    <input
                      type="time"
                      value={currentHydration.time}
                      onChange={(e) => setCurrentHydration(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Beverage Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {hydrationTypes.map((drink) => (
                        <label
                          key={drink.type}
                          className={`block p-4 border rounded-xl cursor-pointer transition-all hover:border-blue-400 ${
                            currentHydration.type === drink.type 
                              ? 'border-blue-500 bg-blue-50/50' 
                              : 'border-gray-200 bg-white/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="hydrationType"
                            value={drink.type}
                            checked={currentHydration.type === drink.type}
                            onChange={() => handleHydrationTypeChange(drink.type)}
                            className="sr-only"
                          />
                          <div className="text-center">
                            <div className="text-2xl mb-1">{drink.emoji}</div>
                            <div className="font-semibold text-gray-800 text-sm">{drink.type}</div>
                            <div className="text-xs text-gray-500">{drink.caffeine}mg caffeine</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addHydration}
                    disabled={!currentHydration.time}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
                  >
                    Add Beverage
                  </button>

                  {hydration.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700">Added Beverages:</h4>
                      {hydration.map((drink, index) => (
                        <div key={index} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                          <div>
                            <span className="font-medium">{drink.time}</span> - 
                            <span className="text-blue-700 ml-1">{drink.type}</span>
                            <div className="text-sm text-gray-600">
                              {drink.amount}ml {drink.caffeineContent ? `(${drink.caffeineContent}mg caffeine)` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeHydration(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      <div className="bg-gradient-to-r from-blue-100 to-green-100 p-4 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-2">Daily Summary:</div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-blue-700 font-semibold">{getTotalWater()}ml</span>
                            <span className="text-gray-600 ml-1">total fluids</span>
                          </div>
                          <div>
                            <span className="text-orange-700 font-semibold">{getTotalCaffeine()}mg</span>
                            <span className="text-gray-600 ml-1">total caffeine</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {(meals.length > 0 || hydration.length > 0) && (
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
                >
                  Save All Entries ({meals.length} meals, {hydration.length} beverages)
                </button>
              )}
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
      description: 'Low intensity, minimal exertion',
      examples: 'Walking, stretching, casual movement'
    },
    { 
      type: 'Medium' as const, 
      emoji: '🏃', 
      description: 'Moderate intensity, sustained effort',
      examples: 'Jogging, cycling, recreational sports'
    },
    { 
      type: 'Intense' as const, 
      emoji: '💪', 
      description: 'High intensity, challenging workout',
      examples: 'HIIT, competitive sports, strength training'
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
                Track Physical Activity
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
                  Exercise Intensity
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
                  Activity Description
                </label>
                <input
                  type="text"
                  value={activityEntry.activity}
                  onChange={(e) => setActivityEntry(prev => ({ ...prev, activity: e.target.value }))}
                  placeholder="e.g., Morning run, Gym workout, Yoga session"
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
                Save Entry
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
  const [sleepEntry, setSleepEntry] = useState<SleepEntryForm>({
    bedTime: '',
    wakeTime: '',
    date: new Date().toISOString().split('T')[0],
    wakingEvents: 0
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(sleepEntry)
    setSleepEntry({ 
      bedTime: '', 
      wakeTime: '', 
      date: new Date().toISOString().split('T')[0],
      wakingEvents: 0
    })
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

  const getSleepQualityPreview = () => {
    if (!sleepEntry.bedTime || !sleepEntry.wakeTime) return null
    
    const bedTime = new Date(`${sleepEntry.date}T${sleepEntry.bedTime}`)
    let wakeTime = new Date(`${sleepEntry.date}T${sleepEntry.wakeTime}`)
    
    if (wakeTime <= bedTime) {
      wakeTime.setDate(wakeTime.getDate() + 1)
    }
    
    const diffMs = wakeTime.getTime() - bedTime.getTime()
    const totalHours = diffMs / (1000 * 60 * 60)
    const wakingEvents = sleepEntry.wakingEvents || 0
    
    const w_dur = 0.7
    const w_wake = 0.3
    const alpha = 0.10
    
    const f_dur = Math.min(totalHours / 7.5, 1.0)
    const f_wake = Math.max(Math.min(1 - alpha * wakingEvents, 1), 0)
    const SQS = Math.round(100 * (w_dur * f_dur + w_wake * f_wake))
    
    const getScoreColor = (score: number) => {
      if (score >= 85) return 'text-green-600 bg-green-50'
      if (score >= 70) return 'text-yellow-600 bg-yellow-50'
      return 'text-red-600 bg-red-50'
    }
    
    return { score: SQS, color: getScoreColor(SQS) }
  }

  const qualityPreview = getSleepQualityPreview()

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
                <Moon className="w-6 h-6" />
                Track Sleep Pattern
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
                  Bedtime
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
                  Wake Time
                </label>
                <input
                  type="time"
                  value={sleepEntry.wakeTime}
                  onChange={(e) => setSleepEntry(prev => ({ ...prev, wakeTime: e.target.value }))}
                  required
                  className="w-full p-3 bg-white/50 backdrop-blur-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Night Waking Events
                </label>
                <div className="bg-blue-50/50 rounded-lg p-4 mb-3">
                  <p className="text-xs text-gray-600 mb-3">
                    Count times you remember waking up during the night (excluding your final wake-up time)
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => setSleepEntry(prev => ({ 
                        ...prev, 
                        wakingEvents: Math.max(0, (prev.wakingEvents || 0) - 1)
                      }))}
                      className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold transition-colors"
                      disabled={(sleepEntry.wakingEvents || 0) <= 0}
                    >
                      -
                    </button>
                    
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {sleepEntry.wakingEvents || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(sleepEntry.wakingEvents || 0) === 0 ? 'No wake events' :
                         (sleepEntry.wakingEvents || 0) === 1 ? '1 wake event' :
                         `${sleepEntry.wakingEvents} wake events`}
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setSleepEntry(prev => ({ 
                        ...prev, 
                        wakingEvents: Math.min(20, (prev.wakingEvents || 0) + 1)
                      }))}
                      className="w-10 h-10 bg-purple-500 hover:bg-purple-600 text-white rounded-full flex items-center justify-center text-xl font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>0-1: Excellent sleep continuity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    <span>2-3: Moderate sleep disruption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span>4+: Significant sleep fragmentation</span>
                  </div>
                </div>
              </div>

              {sleepEntry.bedTime && sleepEntry.wakeTime && (
                <div className="space-y-3">
                  <div className="bg-purple-50/80 rounded-xl p-4 text-center">
                    <div className="text-sm text-gray-600 mb-1">Total Sleep Duration</div>
                    <div className="text-2xl font-bold text-purple-700">{calculateSleepDuration()}</div>
                  </div>
                  
                  {qualityPreview && (
                    <div className={`rounded-xl p-4 text-center border ${qualityPreview.color}`}>
                      <div className="text-sm text-gray-600 mb-1">Estimated Sleep Quality Score</div>
                      <div className="text-2xl font-bold">{qualityPreview.score}/100</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Based on duration and continuity factors
                      </div>
                    </div>
                  )}
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


// Complete mapping function for AboutMe page
// Maps comprehensive survey responses to the format expected by calculateEnhancedSyncScore

const mapSurveyResponsesToQuizFormat = (surveyResponses: Record<string, string>) => {
  // Helper function to map natural wake time
  const mapNaturalWake = (response: string): 'Before 8 AM' | '8–10 AM' | 'After 10 AM' => {
    if (response === 'Before 8 AM') return 'Before 8 AM'
    if (response === '8–10 AM') return '8–10 AM'
    if (response === 'After 10 AM') return 'After 10 AM'
    // Fallback mapping from older survey format
    if (response.includes('Before 6') || response.includes('6–7') || response.includes('6–8')) return 'Before 8 AM'
    if (response.includes('7–8') || response.includes('8–10')) return '8–10 AM'
    return 'After 10 AM'
  }

  // Helper function to map focus time
  const mapFocusTime = (response: string): 'Morning' | 'Afternoon' | 'Evening' => {
    if (response === 'Morning') return 'Morning'
    if (response === 'Afternoon') return 'Afternoon'
    if (response === 'Evening') return 'Evening'
    // Fallback for older survey
    if (response === 'Late Night') return 'Evening'
    return 'Afternoon' // Default
  }

  // Helper function to map test time preference
  const mapTestTime = (response: string): 'Morning' | 'Midday' | 'Evening' => {
    if (response === 'Morning') return 'Morning'
    if (response === 'Midday') return 'Midday'
    if (response === 'Evening') return 'Evening'
    return 'Midday' // Default
  }

  // Helper function to map school start time
  const mapSchoolStart = (response: string): 'Before 7:30 AM' | '7:30–8:00 AM' | 'After 8:00 AM' => {
    if (response === 'Before 7:30 AM' || response.includes('Before 7')) return 'Before 7:30 AM'
    if (response === '7:30–8:00 AM' || response.includes('7:30–8:00') || response.includes('7–8')) return '7:30–8:00 AM'
    if (response === 'After 8:00 AM' || response.includes('After 8') || response.includes('8–9') || response.includes('After 9')) return 'After 8:00 AM'
    return '7:30–8:00 AM' // Default
  }

  // Helper function to map homework time
  const mapHomeworkTime = (response: string): 'Right after school' | 'After dinner' | 'Late at night' | 'Depends' => {
    if (response === 'Right after school') return 'Right after school'
    if (response === 'After dinner') return 'After dinner'
    if (response === 'Late at night') return 'Late at night'
    if (response === 'Depends') return 'Depends'
    
    // Map based on best study time if homework time is missing
    const bestStudyTime = surveyResponses.bestStudyTime
    if (bestStudyTime === 'Early morning' || bestStudyTime === 'Late morning') return 'Right after school'
    if (bestStudyTime === 'Afternoon') return 'Right after school'
    if (bestStudyTime === 'Evening') return 'After dinner'
    
    return 'After dinner' // Default
  }

  // Helper function to map wake school time
  const mapWakeSchool = (response: string): 'Before 6 AM' | '6–6:59 AM' | '7–7:59 AM' | '8 AM or later' => {
    if (response === 'Before 6 AM' || response.includes('Before 6')) return 'Before 6 AM'
    if (response === '6–6:59 AM' || response.includes('6–6:59')) return '6–6:59 AM'
    if (response === '7–7:59 AM' || response.includes('7–7:59')) return '7–7:59 AM'
    if (response === '8 AM or later' || response.includes('8 AM or later')) return '8 AM or later'
    return '7–7:59 AM' // Default
  }

  // Helper function to map morning feeling
  const mapWakeFeel = (response: string): 'Wide awake' | 'A bit slow' | 'Super groggy' => {
    if (response === 'Wide awake' || response === 'Very alert') return 'Wide awake'
    if (response === 'A bit slow' || response === 'Somewhat alert') return 'A bit slow'
    if (response === 'Super groggy' || response === 'Very tired' || response === 'Somewhat sleepy' || response === 'Very sleepy') return 'Super groggy'
    return 'A bit slow' // Default
  }

  // Helper function to map weekend bedtime
  const mapBedWeekend = (response: string): 'Before 10 PM' | '10 PM–Midnight' | 'After Midnight' => {
    if (response === 'Before 10 PM' || response.includes('Before 10')) return 'Before 10 PM'
    if (response === '10 PM–Midnight' || response.includes('10 PM–Midnight') || response.includes('10–11')) return '10 PM–Midnight'
    if (response === 'After Midnight' || response.includes('After Midnight') || response.includes('After 11')) return 'After Midnight'
    return '10 PM–Midnight' // Default
  }

  // Helper function to map home time
  const mapHomeTime = (response: string): 'Before 3:30 PM' | '3:30–4:30 PM' | 'After 4:30 PM' => {
    if (response === 'Before 3:30 PM' || response.includes('Before 3')) return 'Before 3:30 PM'
    if (response === '3:30–4:30 PM' || response.includes('3:30–4:30') || response.includes('3–4')) return '3:30–4:30 PM'
    if (response === 'After 4:30 PM' || response.includes('After 4:30') || response.includes('After 4')) return 'After 4:30 PM'
    return '3:30–4:30 PM' // Default
  }

  // Helper function to map extra time
  const mapExtraTime = (response: string): 'Before 4 PM' | '4–6 PM' | 'After 6 PM' | 'Varies' => {
    if (response === 'Before 4 PM') return 'Before 4 PM'
    if (response === '4–6 PM') return '4–6 PM'
    if (response === 'After 6 PM') return 'After 6 PM'
    if (response === 'Varies') return 'Varies'
    
    // Infer from after-school academic programs
    const afterSchoolAcademics = surveyResponses.afterSchoolAcademics || surveyResponses.extras
    if (afterSchoolAcademics === 'Yes, every day' || afterSchoolAcademics !== 'None') return 'After 6 PM'
    if (afterSchoolAcademics === 'Yes, occasionally') return 'Varies'
    
    return 'Varies' // Default
  }

  // Helper function to map extras
  const mapExtras = (response: string): 'AoPS' | 'RSM' | 'Kumon' | 'Other' | 'None' => {
    if (response === 'AoPS') return 'AoPS'
    if (response === 'RSM') return 'RSM'
    if (response === 'Kumon') return 'Kumon'
    if (response === 'Other') return 'Other'
    if (response === 'None') return 'None'
    
    // Map from afterSchoolAcademics if extras is missing
    const afterSchoolAcademics = surveyResponses.afterSchoolAcademics
    if (afterSchoolAcademics === 'No') return 'None'
    if (afterSchoolAcademics?.includes('Yes')) return 'Other'
    
    return 'None' // Default
  }

  // Return the mapped quiz format responses
  return {
    // Core chronotype questions (required by sync calculator)
    naturalWake: mapNaturalWake(surveyResponses.naturalWake || surveyResponses.idealWakeTime || ''),
    focusTime: mapFocusTime(surveyResponses.focusTime || surveyResponses.alertTime || ''),
    testTime: mapTestTime(surveyResponses.testTime || surveyResponses.bestMentalTime || ''),
    schoolStart: mapSchoolStart(surveyResponses.schoolStart || ''),
    homeworkTime: mapHomeworkTime(surveyResponses.homeworkTime || ''),
    
    // School schedule details (required by sync calculator)
    wakeSchool: mapWakeSchool(surveyResponses.wakeSchool || surveyResponses.schoolWake || ''),
    wakeFeel: mapWakeFeel(surveyResponses.wakeFeel || surveyResponses.morningFeel || surveyResponses.alertnessSchool || ''),
    bedWeekend: mapBedWeekend(surveyResponses.bedWeekend || surveyResponses.weekendSleep || ''),
    homeTime: mapHomeTime(surveyResponses.homeTime || surveyResponses.schoolEnd || ''),
    extraTime: mapExtraTime(surveyResponses.extraTime || ''),
    extras: mapExtras(surveyResponses.extras || ''),
    
    // Additional fields that enhance the calculation
    weekendWake: surveyResponses.weekendWake || 'After 10 AM',
    bestStudyTime: surveyResponses.bestStudyTime || 'Afternoon',
    concentrationTime: surveyResponses.concentrationTime || 'Afternoon (12 PM–5 PM)',
    memoryTime: surveyResponses.memoryTime || 'Morning',
    homeworkDuration: surveyResponses.homeworkDuration || '1–2 hours',
    studyBreaks: surveyResponses.studyBreaks || 'Every 45–60 minutes',
    mealTimes: surveyResponses.mealTimes || '6–7 PM',
    screenTime: surveyResponses.screenTime || '1 hour before bed'
  }
}





// Main Component
export default function AboutMePage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [cognitiveData, setCognitiveData] = useState<CognitiveSession[]>([])
  const [sleepData, setSleepData] = useState<SleepEntry[]>([])
  const [enhancedSyncData, setEnhancedSyncData] = useState<EnhancedSyncData | null>(null)
  const [challengeData, setChallengeData] = useState<UserChallengeData>({
    activeChallenges: [],
    completedChallenges: [],
    totalPoints: 0,
    streaks: {}
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false)
  const [sleepModalOpen, setSleepModalOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const router = useRouter()

  // Fetch functions
  const fetchCognitiveData = async (userId: string) => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const cognitiveQuery = query(
        collection(db, 'users', userId, 'cognitivePerformance'),
        where('timestamp', '>=', sevenDaysAgo),
        orderBy('timestamp', 'desc'),
        limit(200)
      )
      
      const cognitiveSnapshot = await getDocs(cognitiveQuery)
      const sessions: CognitiveSession[] = cognitiveSnapshot.docs.map(doc => doc.data() as CognitiveSession)
      
      setCognitiveData(sessions)
      return sessions
    } catch (error) {
      console.error('Error fetching cognitive data:', error)
      return []
    }
  }

  const fetchChallengeData = async (userId: string) => {
    try {
      const challengeDoc = await getDoc(doc(db, 'users', userId, 'challenges', 'shifting'))
      if (challengeDoc.exists()) {
        setChallengeData(challengeDoc.data() as UserChallengeData)
      }
    } catch (error) {
      console.error('Error fetching challenge data:', error)
    }
  }

  const fetchSleepData = async (userId: string) => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const sleepQuery = query(
        collection(db, 'users', userId, 'sleepEntries'),
        orderBy('date', 'desc'),
        limit(30)
      )
      
      const sleepSnapshot = await getDocs(sleepQuery)
      const entries: SleepEntry[] = sleepSnapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.id
      } as SleepEntry))
      
      setSleepData(entries)
      return entries
    } catch (error) {
      console.error('Error fetching sleep data:', error)
      return []
    }
  }

  // Handle functions
  const handleLogProgress = async (challengeId: string, success: boolean) => {
    if (!auth.currentUser || !challengeData) return

    const challengeIndex = challengeData.activeChallenges.findIndex(c => c.challengeId === challengeId)
    if (challengeIndex === -1) return

    const updatedChallenges = [...challengeData.activeChallenges]
    const challenge = updatedChallenges[challengeIndex]
    const challengeInfo = CHALLENGES.find(c => c.id === challengeId)

    challenge.dailyProgress[challenge.currentDay] = success
    if (success) {
      challenge.completedDays += 1
      challenge.points += challengeInfo?.basePoints || 0
    }

    challenge.currentDay += 1

    if (challenge.currentDay > challenge.totalDays) {
      challenge.isActive = false
      
      const updatedData = {
        ...challengeData,
        activeChallenges: updatedChallenges.filter(c => c.challengeId !== challengeId),
        completedChallenges: [...challengeData.completedChallenges, challenge],
        totalPoints: challengeData.totalPoints + challenge.points
      }
      setChallengeData(updatedData)
    } else {
      const updatedData = {
        ...challengeData,
        activeChallenges: updatedChallenges
      }
      setChallengeData(updatedData)
    }

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'challenges', 'shifting'), 
        challenge.currentDay > challenge.totalDays ? 
        {
          ...challengeData,
          activeChallenges: updatedChallenges.filter(c => c.challengeId !== challengeId),
          completedChallenges: [...challengeData.completedChallenges, challenge],
          totalPoints: challengeData.totalPoints + challenge.points
        } : 
        {
          ...challengeData,
          activeChallenges: updatedChallenges
        }
      )
      
      setSaveSuccess(`Challenge progress logged!`)
      setTimeout(() => setSaveSuccess(''), 2000)
    } catch (error) {
      console.error('Error logging progress:', error)
      setError('Failed to log progress')
    }
  }

  const handleSaveNutrition = async (data: { meals: DietEntry[], hydration: HydrationEntry[], date: string }) => {
    try {
      if (auth.currentUser) {
        const totalCaffeine = data.hydration.reduce((total, entry) => total + (entry.caffeineContent || 0), 0)
        const totalFluids = data.hydration.reduce((total, entry) => total + entry.amount, 0)
        const mealCount = data.meals.length

        const nutritionEntry = {
          ...data,
          timestamp: new Date(),
          totalCaffeine,
          totalFluids,
          mealCount
        }

        await setDoc(doc(db, 'users', auth.currentUser.uid, 'nutritionEntries', data.date), nutritionEntry)
        
        setSaveSuccess(`Nutrition entry saved: ${mealCount} meals, ${data.hydration.length} beverages`)
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving nutrition entry:', error)
      setError('Failed to save nutrition entry')
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
        setSaveSuccess('Activity entry saved successfully')
        setTimeout(() => setSaveSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving activity entry:', error)
      setError('Failed to save activity entry')
    }
  }

  const handleSaveSleep = async (data: SleepEntryForm) => {
    try {
      if (auth.currentUser) {
        const calculateSleepDurationObject = (bedTime: string, wakeTime: string, date: string, wakingEvents?: number) => {
          const bedDateTime = new Date(`${date}T${bedTime}`)
          let wakeDateTime = new Date(`${date}T${wakeTime}`)
          
          if (wakeDateTime <= bedDateTime) {
            wakeDateTime.setDate(wakeDateTime.getDate() + 1)
          }
          
          const diffMs = wakeDateTime.getTime() - bedDateTime.getTime()
          const hours = Math.floor(diffMs / (1000 * 60 * 60))
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          
          return { 
            hours, 
            minutes, 
            totalMinutes: Math.floor(diffMs / (1000 * 60))
          }
        }

        const sleepDuration = calculateSleepDurationObject(data.bedTime, data.wakeTime, data.date, data.wakingEvents)
        
        // Calculate sleep quality score
        const totalHours = sleepDuration.totalMinutes / 60
        const w_dur = 0.7, w_wake = 0.3, alpha = 0.10
        const f_dur = Math.min(totalHours / 7.5, 1.0)
        const f_wake = Math.max(Math.min(1 - alpha * (data.wakingEvents || 0), 1), 0)
        const sleepQualityScore = Math.round(100 * (w_dur * f_dur + w_wake * f_wake))

        await setDoc(doc(db, 'users', auth.currentUser.uid, 'sleepEntries', data.date), {
          ...data,
          timestamp: new Date(),
          sleepDuration,
          sleepQualityScore
        })
        
        setSaveSuccess('Sleep entry saved successfully')
        setTimeout(() => setSaveSuccess(''), 3000)
        
        // Refresh sleep data and recalculate sync score
        const updatedSleepData = await fetchSleepData(auth.currentUser.uid)
        if (userData?.chronotype?.responses) {
  const mappedResponses = mapSurveyResponsesToQuizFormat(userData.chronotype.responses)
  const enhancedData = calculateEnhancedSyncScore(
    mappedResponses,
    cognitiveData,
    updatedSleepData
  )
  setEnhancedSyncData(enhancedData)
}

      }
    } catch (error) {
      console.error('Error saving sleep entry:', error)
      setError('Failed to save sleep entry')
    }
  }

  // Helper functions
  const getChronotypeEmoji = (chronotype: string) => {
    switch (chronotype) {
      case 'Lion': return '🦁'
      case 'Bear': return '🐻'
      case 'Wolf': return '🐺'
      case 'Dolphin': return '🐬'
      default: return '🧠'
    }
  }

  const getSyncScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getAlignmentColor = (score: number) => {
    if (score >= 75) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours % 1) * 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }

  const getChronotypeDescription = (chronotype: string, isYoungerStudent = false) => {
    if (isYoungerStudent) {
      switch (chronotype) {
        case 'Lion': return 'Early risers who are most productive in the morning. Natural leaders who prefer to wake up early and get things done.'
        case 'Bear': return 'Follow the solar cycle and are most productive during the day. They make up about 55% of the population.'
        case 'Wolf': return 'Night owls who are most creative and productive in the evening. They prefer to sleep in and stay up late.'
        case 'Dolphin': return 'Light sleepers with erratic routines who struggle with traditional schedules. Highly intelligent and cautious.'
        default: return 'Your unique sleep and energy patterns that help us understand when you learn best.'
      }
    } else {
      switch (chronotype) {
        case 'Lion': return 'Early chronotypes with peak cognitive performance in morning hours. Natural tendency toward leadership and structured scheduling.'
        case 'Bear': return 'Solar-aligned chronotypes following natural circadian rhythms. Peak productivity during standard daylight hours.'
        case 'Wolf': return 'Evening chronotypes with enhanced creativity during late hours. Optimal performance in afternoon and evening periods.'
        case 'Dolphin': return 'Variable chronotypes with sensitive sleep patterns. Highly analytical with irregular but intense focus periods.'
        default: return 'Individual circadian patterns that influence optimal performance timing.'
      }
    }
  }

// Usage in AboutMe page useEffect:
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData
          setUserData(userData)
          
          const [cognitiveData, sleepData] = await Promise.all([
            fetchCognitiveData(user.uid),
            fetchSleepData(user.uid),
            fetchChallengeData(user.uid)
          ])
          
          // Use chronotype.responses with comprehensive mapping
          if (userData.chronotype?.responses) {
            try {
              const mappedResponses = mapSurveyResponsesToQuizFormat(userData.chronotype.responses)
              
              const enhancedData = calculateEnhancedSyncScore(
                mappedResponses,
                cognitiveData,
                sleepData
              )
              setEnhancedSyncData(enhancedData)
            } catch (error) {
              console.error('Error calculating enhanced sync score:', error)
              // Fallback to stored chronotype data
              setEnhancedSyncData({
                syncScore: userData.chronotype.syncScore || userData.syncScore || 0,
                schoolAlignment: userData.alignmentScores?.school || 0,
                studyAlignment: userData.alignmentScores?.study || 0,
                learningPhase: userData.learningPhase || 12,
                chronotype: { 
                  chronotype: userData.chronotype.chronotype, 
                  outOfSync: userData.chronotype.outOfSync 
                },
                adaptiveComponents: {
                  observedAlignment: { school: 0, study: 0 },
                  predictedAlignment: { school: 0, study: 0 },
                  adaptationLevel: 0,
                  domainReliability: {}
                },
                sleepMetrics: { averageQuality: 0, consistency: 0, duration: 0 },
                learningTimeline: [],
                socialJetlagPenalty: 0
              })
            }
          }
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading your enhanced profile...</p>
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
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
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

  const displayData = enhancedSyncData || {
    syncScore: userData.syncScore || 0,
    schoolAlignment: userData.alignmentScores?.school || 0,
    studyAlignment: userData.alignmentScores?.study || 0,
    learningPhase: userData.learningPhase || 12,
    chronotype: userData.chronotype || { chronotype: 'Bear', outOfSync: 0 },
    adaptiveComponents: {
      observedAlignment: { school: 0, study: 0 },
      predictedAlignment: { school: 0, study: 0 },
      adaptationLevel: 0,
      domainReliability: {}
    },
    sleepMetrics: {
      averageQuality: 0,
      consistency: 0,
      duration: 0
    },
    learningTimeline: []
  }

  const hasReliableData = enhancedSyncData && enhancedSyncData.adaptiveComponents.adaptationLevel > 0.2
  const cognitiveDataPoints = Object.values(enhancedSyncData?.adaptiveComponents.domainReliability || {})
    .reduce((sum, r) => sum + (r > 0 ? 1 : 0), 0)

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Links */}
        <div className="mb-6">
          <div className="flex gap-4 flex-wrap">
            <Link
              href="/Prep/Insights"
              className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
            >
              <span>🔭</span>
              Insights (Shift Plan)
            </Link>
            
            <Link
              href="/sleep-quality"
              className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
            >
              <span>🌙</span>
              Sleep Quality Score
            </Link>
          </div>
        </div>

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

        {/* Active Challenges Strip */}
        {challengeData && challengeData.activeChallenges.length > 0 && (
          <ActiveChallengesStrip
            activeChallenges={challengeData.activeChallenges}
            onLogProgress={handleLogProgress}
            onViewAllChallenges={() => router.push('/shifting-challenges')}
          />
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Hi <span className="text-pink-500">{userData.name}</span> 👋
          </h1>
          <p className="text-lg text-gray-700">Your personalized learning profile</p>
        </motion.div>

{/* Enhanced Main Profile Card */}
<motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, delay: 0.2 }}
  className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
>
  {userData.chronotype?.responses ? (
    <div className="text-center">
      <div className="bg-green-50/80 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-800">Complete Assessment Available</span>
        </div>
        <p className="text-green-700 text-sm">
          Based on {Object.keys(userData.chronotype.responses).length} survey responses including chronotype, 
          schedule, and study preferences.
        </p>
      </div>

      <div className="text-6xl mb-4">
        {getChronotypeEmoji(displayData.chronotype.chronotype)}
      </div>

      {/* Move the Building Profile section here, inside the conditional */}
      {!hasReliableData && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-800">Building Your Personalized Profile</span>
          </div>
          <p className="text-blue-700 text-sm mb-3">
            Using your comprehensive survey responses as baseline. Play cognitive games and track sleep for even more personalized insights.
          </p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-medium text-blue-800 mb-1">Survey Data Available:</div>
              <div className="space-y-1">
                {userData.chronotype.responses.naturalWake && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Natural chronotype</span>
                  </div>
                )}
                {userData.chronotype.responses.schoolStart && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>School schedule</span>
                  </div>
                )}
                {userData.chronotype.responses.homeworkTime && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Study preferences</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-800 mb-1">Additional Data:</div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 ${cognitiveDataPoints > 0 ? 'bg-green-400' : 'bg-gray-300'} rounded-full`}></div>
                  <span>Cognitive games: {cognitiveDataPoints}/5</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 ${sleepData.length > 0 ? 'bg-green-400' : 'bg-gray-300'} rounded-full`}></div>
                  <span>Sleep entries: {sleepData.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 ${hasReliableData ? 'bg-green-400' : 'bg-yellow-400'} rounded-full`}></div>
                  <span>Adaptation: {Math.round((enhancedSyncData?.adaptiveComponents.adaptationLevel || 0) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD OTHER REMAINING PROFILE CONTENT HERE */}
      
    </div>
  ) : (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">🧠</div>
      <h2 className="text-2xl font-bold text-gray-700 mb-4">Complete Assessment Required</h2>
      <p className="text-gray-600 mb-6">Take our comprehensive chronotype and learning assessment to unlock personalized insights</p>
      <button
        onClick={() => router.push('/chronotype-quiz')}
        className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
      >
        Start Complete Assessment
      </button>
    </div>
  )}
</motion.div>

{displayData.syncScore < 70 && userData.chronotype?.responses && (
  <div className="bg-blue-50/80 rounded-lg p-4 text-left">
    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
      <Target className="w-4 h-4" />
      Personalized Recommendations
    </h4>
    <div className="text-sm text-blue-700 space-y-1">
      {displayData.schoolAlignment < 50 && (
        <div>• Focus on evening review sessions to reinforce learning when your natural rhythm conflicts with school hours</div>
      )}
      {displayData.studyAlignment < 50 && (
        <div>• Try shifting homework time closer to {formatTime(displayData.learningPhase)} for better focus</div>
      )}
      {userData.chronotype.responses.wakeFeel === 'Super groggy' && (
        <div>• Consider a gradual wake-up routine with light exposure to ease morning grogginess</div>
      )}
      {userData.chronotype.responses.bedWeekend === 'After Midnight' && userData.chronotype.responses.wakeSchool?.includes('Before 7') && (
        <div>• Large weekend sleep-ins may disrupt your weekday rhythm - try to keep weekend wake times within 1–2 hours of weekdays</div>
      )}
      {userData.chronotype.responses.homeworkTime === 'Late at night' && userData.chronotype.responses.focusTime !== 'Evening' && (
        <div>• Your late-night homework may not match your focus time – consider moving sessions earlier</div>
      )}
      {userData.chronotype.responses.concentrationTime && !userData.chronotype.responses.concentrationTime.includes(userData.chronotype.responses.homeworkTime || '') && (
        <div>• Your study time doesn’t align with when you concentrate best – try scheduling homework during your peak concentration window</div>
      )}
      <div>• Maintain consistent sleep-wake times to strengthen your natural circadian rhythm</div>
      {!hasReliableData && (
        <div>• Play cognitive games throughout the day to build your personalized performance profile</div>
      )}
    </div>
  </div>
)}






              {/* Enhanced Sync Score Display */}
              <div className={`rounded-xl p-6 border-2 mb-6 ${getSyncScoreColor(displayData.syncScore)}`}>
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="w-6 h-6" />
                    <h3 className="text-xl font-bold">
                      {hasReliableData ? 'Adaptive' : 'Predicted'} Sync Score
                    </h3>
                  </div>
                  <div className="text-4xl font-bold mb-2">{displayData.syncScore}/100</div>
                  <div className="text-sm font-medium mb-4">
                    {displayData.syncScore >= 80 ? 'Excellent Schedule Alignment' :
                     displayData.syncScore >= 60 ? 'Good Schedule Alignment' :
                     displayData.syncScore >= 40 ? 'Moderate Schedule Alignment' : 'Schedule Needs Optimization'}
                  </div>
                </div>
                
                {/* Alignment Breakdown */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/50 rounded-lg p-4">
                    <div className={`text-2xl font-bold ${getAlignmentColor(displayData.schoolAlignment)}`}>
                      {displayData.schoolAlignment}%
                    </div>
                    <div className="text-sm text-gray-600">School Schedule Alignment</div>
                    <div className="text-xs text-gray-500">How well your school hours match your natural rhythm</div>
                  </div>
                  <div className="bg-white/50 rounded-lg p-4">
                    <div className={`text-2xl font-bold ${getAlignmentColor(displayData.studyAlignment)}`}>
                      {displayData.studyAlignment}%
                    </div>
                    <div className="text-sm text-gray-600">Study Time Alignment</div>
                    <div className="text-xs text-gray-500">How well your study schedule matches your peak focus</div>
                  </div>
                </div>
                
                {/* Peak Learning Time */}
                <div className="bg-purple-100/80 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-700" />
                    <span className="font-semibold text-purple-700">Peak Learning Time</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-800">
                    {formatTime(displayData.learningPhase)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Based on your {hasReliableData ? 'observed performance' : 'chronotype assessment'}
                  </div>
                </div>

                {/* Sleep Metrics (if available) */}
                {enhancedSyncData && enhancedSyncData.sleepMetrics.averageQuality > 0 && (
                  <div className="bg-indigo-50/80 rounded-lg p-4">
                    <h4 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Sleep Quality Metrics
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-indigo-700">{Math.round(enhancedSyncData.sleepMetrics.averageQuality)}/100</div>
                        <div className="text-xs text-gray-600">Quality</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-indigo-700">{Math.round(enhancedSyncData.sleepMetrics.consistency)}%</div>
                        <div className="text-xs text-gray-600">Consistency</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-indigo-700">{enhancedSyncData.sleepMetrics.duration.toFixed(1)}h</div>
                        <div className="text-xs text-gray-600">Duration</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance vs Prediction Comparison */}
              {hasReliableData && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-100 rounded-xl p-4 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Observed Performance
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>During School:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.observedAlignment.school * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>During Study:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.observedAlignment.study * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-100 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Chronotype Prediction
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>During School:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.predictedAlignment.school * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>During Study:</span>
                        <span className="font-bold">{Math.round(enhancedSyncData.adaptiveComponents.predictedAlignment.study * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

       {/* Enhanced Recomendations */}       
{displayData.syncScore < 70 && userData.chronotype?.responses && (
  <div className="bg-blue-50/80 rounded-lg p-4 text-left">
    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
      <Target className="w-4 h-4" />
      Personalized Recommendations
    </h4>
    <div className="text-sm text-blue-700 space-y-1">
      {displayData.schoolAlignment < 50 && (
        <div>• Focus on evening review sessions to reinforce learning when your natural rhythm conflicts with school hours</div>
      )}
      {displayData.studyAlignment < 50 && (
        <div>• Try shifting homework time closer to {formatTime(displayData.learningPhase)} for better focus</div>
      )}
      {userData.chronotype.responses.wakeFeel === 'Super groggy' && (
        <div>• Consider a gradual wake-up routine with light exposure to ease morning grogginess</div>
      )}
      {userData.chronotype.responses.bedWeekend === 'After Midnight' && userData.chronotype.responses.wakeSchool?.includes('Before 7') && (
        <div>• Large weekend sleep-in periods may be disrupting your weekday rhythm - try to keep weekend wake times within 1-2 hours of weekdays</div>
      )}
      {userData.chronotype.responses.homeworkTime === 'Late at night' && userData.chronotype.responses.focusTime !== 'Evening' && (
        <div>• Your late-night homework schedule may not match your natural focus time - consider moving study sessions earlier</div>
      )}
      {userData.chronotype.responses.concentrationTime && !userData.chronotype.responses.concentrationTime.includes(userData.chronotype.responses.homeworkTime || '') && (
        <div>• Your study time doesn't align with when you concentrate best - try scheduling homework during your peak concentration window</div>
      )}
      <div>• Maintain consistent sleep-wake times to strengthen your natural circadian rhythm</div>
      {!hasReliableData && (
        <div>• Play cognitive games throughout the day to build your personalized performance profile</div>
      )}
    </div>
  </div>
)}

      {/* Update the LearningTimeline component usage condition */}
{userData.chronotype?.responses && displayData && (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.4 }}
    className="mb-8"
  >
    <LearningTimeline
      learningPhase={displayData.learningPhase}
      responses={mapSurveyResponsesToQuizFormat(userData.chronotype.responses)}
      syncScore={displayData.syncScore}
      alignmentScores={{
        school: displayData.schoolAlignment,
        study: displayData.studyAlignment
      }}
    />
  </motion.div>
)}

 {/* Profile Details Grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
     {/* Basic Info */}
        
{/* Survey data summary in profile details */}
<motion.div
  initial={{ opacity: 0, x: -30 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.6, delay: 0.5 }}
  className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg"
>
  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
    📊 Profile Data
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
    {userData.chronotype?.responses && (
      <>
        <div className="flex justify-between">
          <span className="text-gray-600">Survey Questions:</span>
          <span className="font-medium text-sm">{Object.keys(userData.chronotype.responses).length} completed</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Assessment Date:</span>
          <span className="font-medium text-sm">
            {new Date(userData.chronotype.timestamp).toLocaleDateString()}
          </span>
        </div>
      </>
    )}
    <div className="flex justify-between">
      <span className="text-gray-600">Cognitive Sessions:</span>
      <span className="font-medium text-sm">{cognitiveData.length} sessions</span>
    </div>
    <div className="flex justify-between">
      <span className="text-gray-600">Sleep Entries:</span>
      <span className="font-medium text-sm">{sleepData.length} nights</span>
    </div>
  </div>
</motion.div>

        <div className="space-y-3">
  {userData.chronotype?.responses ? (
    <>
      <div className="flex justify-between">
        <span className="text-gray-600">Type:</span>
        <span className="font-medium flex items-center text-sm">
          {getChronotypeEmoji(displayData.chronotype.chronotype)} {displayData.chronotype.chronotype}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Sync Score:</span>
        <span className={`font-medium text-sm ${getSyncScoreColor(displayData.syncScore).split(' ')[0]}`}>
          {displayData.syncScore}/100
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Adaptation:</span>
        <span className="font-medium text-sm">
          {Math.round((enhancedSyncData?.adaptiveComponents.adaptationLevel || 0) * 100)}%
        </span>
      </div>
      <div className="pt-2">
        <button
          onClick={() => router.push('/Prep/MyBrain')}
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
        Start Assessment
      </button>
    </div>
  )}
</div>


          {/* Lifestyle Tracking */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gradient-to-br from-green-50 to-blue-100 rounded-xl p-6 border border-green-200 shadow-lg"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              🌱 Lifestyle Tracking
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setNutritionModalOpen(true)}
                className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
              >
                🍽️ Nutrition & Hydration
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

{/* Domain Reliability Display */}
{hasReliableData && enhancedSyncData?.adaptiveComponents?.domainReliability && (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.8 }}
    className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
  >
    <h3 className="text-2xl font-bold text-purple-700 mb-6 text-center flex items-center justify-center gap-2">
      <Target className="w-6 h-6" />
      Cognitive Domain Reliability
    </h3>
    
    {(() => {
      try {
        const domainReliability = enhancedSyncData?.adaptiveComponents?.domainReliability;
        
        if (!domainReliability || typeof domainReliability !== 'object') {
          return (
            <div className="text-center text-gray-500 py-8">
              <p>Domain reliability data is being calculated...</p>
            </div>
          );
        }
        
        const domains = Object.entries(domainReliability);
        
        if (domains.length === 0) {
          return (
            <div className="text-center text-gray-500 py-8">
              <p>No cognitive domains tracked yet. Play more games to see reliability metrics.</p>
            </div>
          );
        }
        
        // Dynamic grid based on number of domains
        const gridClass = domains.length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 
                         domains.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 
                         'grid-cols-2 md:grid-cols-5';
        
        return (
          <div className={`grid ${gridClass} gap-4`}>
            {domains.map(([domain, reliability]) => (
              <div key={domain} className="text-center bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-2 capitalize font-medium">
                  {domain.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className={`text-2xl font-bold mb-2 ${
                  reliability > 0.5 ? 'text-green-600' : 
                  reliability > 0.2 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {Math.round((reliability || 0) * 100)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      reliability > 0.5 ? 'bg-green-500' : 
                      reliability > 0.2 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.max((reliability || 0) * 100, 5)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {reliability > 0.5 ? 'High confidence' : 
                   reliability > 0.2 ? 'Building data' : 
                   'Need more data'}
                </div>
              </div>
            ))}
          </div>
        );
      } catch (error) {
        console.error('Error rendering domain reliability:', error);
        return (
          <div className="text-center text-red-500 py-8">
            <p>Error loading domain reliability data</p>
          </div>
        );
      }
    })()}
    
    <div className="text-center mt-6">
      <p className="text-sm text-gray-600">
        Reliability indicates how confident we are in your personalized performance patterns for each cognitive domain
      </p>
    </div>
  </motion.div>
)}

        {/* Academic Performance Enhancement Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <h3 className="text-2xl font-bold text-purple-700 mb-6 text-center">
            🎯 Academic Performance Enhancement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cognitive Preparation Card */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📚</div>
                <h4 className="text-xl font-bold text-blue-700 mb-3">Cognitive Preparation</h4>
                <p className="text-blue-600 text-sm mb-4">
                  Optimize your cognitive state before studying with evidence-based techniques
                </p>
                <button 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all"
                  onClick={() => router.push('/Prep/BrainWarmup')}
                >
                  Prepare for Study Session
                </button>
              </div>
            </div>

            {/* Exam Preparation Card */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group">
              <div className="text-center">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📋</div>
                <h4 className="text-xl font-bold text-orange-700 mb-3">Exam Preparation</h4>
                <p className="text-orange-600 text-sm mb-4">
                  Enhance memory consolidation and review strategies for effective preparation
                </p>
                <button className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                  View Study Strategies
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
                  Optimize Performance
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
              📈 Analytics Dashboard
            </button>
            <button
              onClick={() => router.push('/chronotype-quiz')}
              className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-8 py-3 rounded-full font-semibold border border-purple-300 transition-all hover:scale-105"
            >
              🔄 Reassess Profile
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            {hasReliableData 
              ? 'Personalized recommendations based on your unique cognitive performance patterns' 
              : 'Evidence-based recommendations tailored to your circadian preferences and cognitive patterns'
            }
          </p>
        </motion.div>

        {/* Lifestyle Tracking Modals */}
        <NutritionModal
          isOpen={nutritionModalOpen} 
          onClose={() => setNutritionModalOpen(false)} 
          onSave={handleSaveNutrition} 
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