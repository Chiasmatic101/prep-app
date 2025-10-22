// components/MealTimingTracker.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Utensils, Coffee, Clock, CheckCircle, TrendingUp, Apple } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, getDoc, setDoc } from 'firebase/firestore'

interface MealWindow {
  type: 'breakfast' | 'lunch' | 'dinner'
  targetTime: string
  tolerance: number // minutes
  logged: boolean
  actualTime?: string
}

export const ConsistentMealWindowsTracker: React.FC<{
  challengeId: string
  onComplete: () => void
}> = ({ challengeId, onComplete }) => {
  const [mealWindows, setMealWindows] = useState<MealWindow[]>([
    { type: 'breakfast', targetTime: '07:30', tolerance: 90, logged: false },
    { type: 'lunch', targetTime: '12:30', tolerance: 60, logged: false },
    { type: 'dinner', targetTime: '18:30', tolerance: 60, logged: false }
  ])
  const [wakeTime, setWakeTime] = useState('')
  const [completed, setCompleted] = useState(false)
  const [todayNutrition, setTodayNutrition] = useState<any>(null)

  useEffect(() => {
    loadTodayNutrition()
    loadWakeTime()
  }, [])

  const loadWakeTime = async () => {
    if (!auth.currentUser) return
    
    try {
      const today = new Date().toISOString().split('T')[0]
      const sleepDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'sleepEntries', today))
      
      if (sleepDoc.exists()) {
        setWakeTime(sleepDoc.data().wakeTime)
      }
    } catch (error) {
      console.error('Error loading wake time:', error)
    }
  }

  const loadTodayNutrition = async () => {
    if (!auth.currentUser) return
    
    try {
      const today = new Date().toISOString().split('T')[0]
      const nutritionDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'nutritionEntries', today))
      
      if (nutritionDoc.exists()) {
        const data = nutritionDoc.data()
        setTodayNutrition(data)
        
        // Auto-fill from existing data
        if (data.meals) {
          const updatedWindows = mealWindows.map(window => {
            const meal = data.meals.find((m: any) => 
              m.description?.toLowerCase().includes(window.type) || 
              m.type === window.type
            )
            if (meal) {
              return { ...window, logged: true, actualTime: meal.time }
            }
            return window
          })
          setMealWindows(updatedWindows)
        }
      }
    } catch (error) {
      console.error('Error loading nutrition data:', error)
    }
  }

  const calculateBreakfastWindow = () => {
    if (!wakeTime) return 'Log wake time first'
    
    const wake = new Date(`2024-01-01T${wakeTime}`)
    const earliest = new Date(wake.getTime() + 15 * 60 * 1000) // 15 min after wake
    const latest = new Date(wake.getTime() + 90 * 60 * 1000) // 90 min after wake
    
    return `${earliest.toTimeString().slice(0, 5)} - ${latest.toTimeString().slice(0, 5)}`
  }

  const isWithinWindow = (mealType: string, actualTime: string) => {
    const window = mealWindows.find(w => w.type === mealType)
    if (!window) return false
    
    const target = new Date(`2024-01-01T${window.targetTime}`)
    const actual = new Date(`2024-01-01T${actualTime}`)
    const diffMinutes = Math.abs((actual.getTime() - target.getTime()) / (1000 * 60))
    
    return diffMinutes <= window.tolerance
  }

  const logMeal = (mealType: 'breakfast' | 'lunch' | 'dinner', time: string) => {
    setMealWindows(prev => prev.map(window => 
      window.type === mealType 
        ? { ...window, logged: true, actualTime: time }
        : window
    ))
  }

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    const allLogged = mealWindows.every(w => w.logged)
    const allWithinWindow = mealWindows.every(w => 
      w.actualTime && isWithinWindow(w.type, w.actualTime)
    )
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'mealTiming', today), {
        windows: mealWindows,
        allLogged,
        allWithinWindow,
        wakeTime,
        timestamp: new Date(),
        challengeId
      })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging meal timing:', error)
    }
  }

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast': return '🌅'
      case 'lunch': return '☀️'
      case 'dinner': return '🌙'
      default: return '🍽️'
    }
  }

  const allMealsLogged = mealWindows.every(w => w.logged)

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-orange-600 text-white">
          <Utensils className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Consistent Meal Windows</h3>
          <p className="text-sm text-gray-600">Track your meal timing consistency</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          {/* Wake Time Context */}
          {wakeTime && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Your Schedule Today</span>
              </div>
              <div className="text-sm text-blue-700">
                <div>Wake time: <span className="font-medium">{wakeTime}</span></div>
                <div>Breakfast window: <span className="font-medium">{calculateBreakfastWindow()}</span></div>
              </div>
            </div>
          )}

          {/* Meal Windows */}
          <div className="space-y-4">
            {mealWindows.map((window) => (
              <div key={window.type} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMealIcon(window.type)}</span>
                    <div>
                      <h4 className="font-semibold text-gray-800 capitalize">{window.type}</h4>
                      <p className="text-sm text-gray-600">
                        Target: {window.targetTime} (±{window.tolerance} min)
                      </p>
                    </div>
                  </div>
                  {window.logged && (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  )}
                </div>

                {!window.logged ? (
                  <div className="flex gap-2">
                    <input
                      type="time"
                      onChange={(e) => logMeal(window.type, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                ) : (
                  <div className={`rounded-lg p-3 ${
                    window.actualTime && isWithinWindow(window.type, window.actualTime)
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        Logged at: <span className="font-medium">{window.actualTime}</span>
                      </span>
                      {window.actualTime && isWithinWindow(window.type, window.actualTime) ? (
                        <span className="text-xs text-green-700 font-medium">✓ Within window</span>
                      ) : (
                        <span className="text-xs text-yellow-700 font-medium">⚠ Outside window</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Progress Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-orange-700">
                {mealWindows.filter(w => w.logged).length}/3 meals logged
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(mealWindows.filter(w => w.logged).length / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Educational Content */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Why Meal Timing Matters</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Consistent meal times help regulate your circadian rhythm</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Eating within 90 min of waking helps signal daytime to your body</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Regular meal patterns support stable energy throughout the day</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleComplete}
            disabled={!allMealsLogged}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Complete Meal Timing Log
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
          <p className="text-gray-600 mb-4">All meals logged for today</p>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-800">
              Keep this consistency for the next {10 - 1} days to complete the challenge!
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export const SmartCaffeineWindowTracker: React.FC<{
  challengeId: string
  onComplete: () => void
}> = ({ challengeId, onComplete }) => {
  const [caffeineLog, setCaffeineLog] = useState<Array<{
    type: string
    time: string
    amount: number
  }>>([])
  const [noCaffeine, setNoCaffeine] = useState(false)
  const [completed, setCompleted] = useState(false)

  const caffeineTypes = [
    { id: 'coffee', label: 'Coffee', icon: '☕', caffeine: 95 },
    { id: 'tea', label: 'Tea', icon: '🍵', caffeine: 47 },
    { id: 'energy-drink', label: 'Energy Drink', icon: '🥤', caffeine: 80 },
    { id: 'soda', label: 'Soda', icon: '🥤', caffeine: 35 }
  ]

  const addCaffeine = (type: string, time: string) => {
    const caffeineType = caffeineTypes.find(c => c.id === type)
    if (!caffeineType) return

    setCaffeineLog(prev => [...prev, {
      type: caffeineType.label,
      time,
      amount: caffeineType.caffeine
    }])
  }

  const isWithinWindow = (time: string) => {
    const caffeineTime = new Date(`2024-01-01T${time}`)
    const cutoff = new Date(`2024-01-01T14:00:00`)
    return caffeineTime <= cutoff
  }

  const totalCaffeine = caffeineLog.reduce((sum, item) => sum + item.amount, 0)
  const allWithinWindow = caffeineLog.length === 0 || caffeineLog.every(item => isWithinWindow(item.time))

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    const success = noCaffeine || allWithinWindow
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'caffeineTracking', today), {
        caffeineLog,
        noCaffeine,
        totalCaffeine,
        allWithinWindow,
        success,
        timestamp: new Date(),
        challengeId
      })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging caffeine:', error)
    }
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-amber-600 text-white">
          <Coffee className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Smart Caffeine Window</h3>
          <p className="text-sm text-gray-600">Track caffeine timing for better sleep</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          {/* No Caffeine Option */}
          <div>
            <button
              onClick={() => setNoCaffeine(!noCaffeine)}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                noCaffeine
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  noCaffeine ? 'border-green-600 bg-green-600' : 'border-gray-300'
                }`}>
                  {noCaffeine && <CheckCircle className="w-5 h-5 text-white" />}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-800">No caffeine today</div>
                  <div className="text-sm text-gray-600">Skip if you didn't consume any caffeine</div>
                </div>
              </div>
            </button>
          </div>

          {!noCaffeine && (
            <>
              {/* Caffeine Window Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">Target Window</span>
                </div>
                <p className="text-sm text-blue-700">
                  Keep caffeine intake to <span className="font-semibold">before 2:00 PM</span> to avoid 
                  interfering with sleep (caffeine has a 6-hour half-life)
                </p>
              </div>

              {/* Add Caffeine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Log your caffeine intake:
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {caffeineTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        const time = prompt(`What time did you have ${type.label}? (HH:MM format)`)
                        if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                          addCaffeine(type.id, time)
                        }
                      }}
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-amber-300 transition-all text-left"
                    >
                      <div className="text-2xl mb-2">{type.icon}</div>
                      <div className="text-sm font-medium text-gray-800">{type.label}</div>
                      <div className="text-xs text-gray-600">~{type.caffeine}mg</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caffeine Log */}
              {caffeineLog.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-3">Today's Caffeine Log</h4>
                  <div className="space-y-2">
                    {caffeineLog.map((item, index) => (
                      <div 
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isWithinWindow(item.time)
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-800">{item.type}</span>
                          <span className="text-sm text-gray-600">{item.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {item.amount}mg
                          </span>
                          {isWithinWindow(item.time) ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <span className="text-xs text-red-600 font-medium">After 2 PM</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Caffeine:</span>
                      <span className="font-bold text-gray-800">{totalCaffeine}mg</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Educational Content */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 mb-2">💡 Caffeine & Sleep</h4>
            <ul className="space-y-1 text-sm text-amber-700">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Caffeine blocks adenosine (sleep pressure chemical)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Takes 6 hours for half the caffeine to leave your system</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Late caffeine can delay sleep onset and reduce sleep quality</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleComplete}
            disabled={!noCaffeine && caffeineLog.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Complete Caffeine Log
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
          <p className="text-gray-600 mb-4">
            {noCaffeine 
              ? '🎉 No caffeine today - great for sleep!' 
              : allWithinWindow
                ? '✅ All caffeine within healthy window!'
                : '⚠️ Some caffeine after 2 PM - try earlier tomorrow'}
          </p>
          {!noCaffeine && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Total caffeine: <span className="font-semibold">{totalCaffeine}mg</span>
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export const StudySnackSwapTracker: React.FC<{
  challengeId: string
  onComplete: () => void
}> = ({ challengeId, onComplete }) => {
  const [selectedSnack, setSelectedSnack] = useState('')
  const [snackTime, setSnackTime] = useState('')
  const [energyRating, setEnergyRating] = useState<number | null>(null)
  const [focusRating, setFocusRating] = useState<number | null>(null)
  const [completed, setCompleted] = useState(false)

  const steadyEnergySnacks = [
    { 
      id: 'fruit-nuts', 
      label: 'Fruit + Nuts', 
      icon: '🍎🥜',
      description: 'Apple/banana with almonds or peanuts',
      benefits: ['Fiber', 'Protein', 'Healthy fats']
    },
    { 
      id: 'yogurt', 
      label: 'Greek Yogurt', 
      icon: '🥣',
      description: 'With berries or granola',
      benefits: ['Protein', 'Probiotics', 'Calcium']
    },
    { 
      id: 'whole-grain', 
      label: 'Whole Grain Crackers', 
      icon: '🍘',
      description: 'With cheese or hummus',
      benefits: ['Complex carbs', 'Protein', 'Fiber']
    },
    { 
      id: 'trail-mix', 
      label: 'Trail Mix', 
      icon: '🥜',
      description: 'Nuts, seeds, and dried fruit',
      benefits: ['Energy', 'Protein', 'Minerals']
    },
    { 
      id: 'veggies-dip', 
      label: 'Veggies + Dip', 
      icon: '🥕',
      description: 'Carrots, celery with hummus',
      benefits: ['Vitamins', 'Fiber', 'Protein']
    },
    { 
      id: 'oatmeal', 
      label: 'Instant Oatmeal', 
      icon: '🥣',
      description: 'With fruit or honey',
      benefits: ['Complex carbs', 'Fiber', 'Sustained energy']
    }
  ]

  const handleComplete = async () => {
    if (!auth.currentUser || energyRating === null || focusRating === null) return
    
    const today = new Date().toISOString().split('T')[0]
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'studySnacks', today), {
        selectedSnack,
        snackTime,
        energyRating,
        focusRating,
        timestamp: new Date(),
        challengeId
      })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging study snack:', error)
    }
  }

  const selectedSnackInfo = steadyEnergySnacks.find(s => s.id === selectedSnack)

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-green-600 text-white">
          <Apple className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Study Snack Swap</h3>
          <p className="text-sm text-gray-600">Choose steady-energy snacks</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          {/* Educational intro */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Why This Matters</h4>
            <p className="text-sm text-blue-700">
              Quick-energy snacks (candy, chips) cause energy crashes. Steady-energy snacks 
              combine protein, fiber, and healthy fats for sustained focus during study sessions.
            </p>
          </div>

          {/* Snack Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
            Choose your study snack:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {steadyEnergySnacks.map((snack) => (
                <button
                  key={snack.id}
                  onClick={() => setSelectedSnack(snack.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedSnack === snack.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{snack.icon}</div>
                  <div className="text-sm font-medium text-gray-800 mb-1">
                    {snack.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    {snack.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedSnack && selectedSnackInfo && (
            <>
              {/* Selected Snack Details */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{selectedSnackInfo.icon}</span>
                  <div>
                    <h4 className="font-semibold text-green-900">{selectedSnackInfo.label}</h4>
                    <p className="text-sm text-green-700">{selectedSnackInfo.description}</p>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-green-800 mb-1">Benefits:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSnackInfo.benefits.map((benefit, index) => (
                      <span 
                        key={index}
                        className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What time did you have this snack?
                </label>
                <input
                  type="time"
                  value={snackTime}
                  onChange={(e) => setSnackTime(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-600 mt-1">
                  💡 Best timing: Before starting a study session
                </p>
              </div>

              {/* Energy Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How's your energy 30 minutes after eating? (Rate after studying a bit)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setEnergyRating(rating)}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        energyRating === rating
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {rating === 1 ? '😴' : rating === 2 ? '😐' : rating === 3 ? '🙂' : rating === 4 ? '😊' : '🤩'}
                      </div>
                      <div className="text-xs text-gray-600">{rating}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>Very low</span>
                  <span>Great!</span>
                </div>
              </div>

              {/* Focus Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How's your focus/concentration?
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setFocusRating(rating)}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        focusRating === rating
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {rating === 1 ? '😵' : rating === 2 ? '😕' : rating === 3 ? '😌' : rating === 4 ? '🎯' : '🧠'}
                      </div>
                      <div className="text-xs text-gray-600">{rating}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>Can't focus</span>
                  <span>Laser focused!</span>
                </div>
              </div>
            </>
          )}

          {/* Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">🎯 Pro Tips</h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Avoid high-sugar snacks that cause energy crashes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Pair carbs with protein for steady energy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Stay hydrated - drink water with your snack</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleComplete}
            disabled={!selectedSnack || !snackTime || energyRating === null || focusRating === null}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Log Study Snack
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800 mb-2">Snack Logged!</h4>
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <div className="text-3xl mb-2">{selectedSnackInfo?.icon}</div>
            <div className="font-semibold text-gray-800 mb-1">{selectedSnackInfo?.label}</div>
            <div className="text-sm text-gray-600 mb-3">at {snackTime}</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Energy</div>
                <div className="text-2xl">{energyRating}/5</div>
              </div>
              <div>
                <div className="text-gray-600">Focus</div>
                <div className="text-2xl">{focusRating}/5</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {(energyRating || 0) >= 4 && (focusRating || 0) >= 4
              ? '🎉 This snack works great for you! Keep choosing it.'
              : '📝 Try different snacks to find what works best for your focus.'}
          </p>
        </motion.div>
      )}
    </div>
  )
}

export const HydrationHabitTracker: React.FC<{
  challengeId: string
  onComplete: () => void
}> = ({ challengeId, onComplete }) => {
  const [hydrationLog, setHydrationLog] = useState({
    withBreakfast: false,
    withLunch: false,
    withDinner: false,
    beforeStudy: false
  })
  const [completed, setCompleted] = useState(false)

  const checkpoints = [
    { id: 'withBreakfast', label: 'With Breakfast', icon: '🌅', time: 'Morning' },
    { id: 'withLunch', label: 'With Lunch', icon: '☀️', time: 'Midday' },
    { id: 'withDinner', label: 'With Dinner', icon: '🌙', time: 'Evening' },
    { id: 'beforeStudy', label: 'Before First Study Block', icon: '📚', time: 'Study time' }
  ]

  const toggleCheckpoint = (id: keyof typeof hydrationLog) => {
    setHydrationLog(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const completedCount = Object.values(hydrationLog).filter(Boolean).length

  const handleComplete = async () => {
    if (!auth.currentUser) return
    
    const today = new Date().toISOString().split('T')[0]
    
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'hydrationTracking', today), {
        ...hydrationLog,
        completedCount,
        totalCheckpoints: checkpoints.length,
        timestamp: new Date(),
        challengeId
      })
      
      setCompleted(true)
      onComplete()
    } catch (error) {
      console.error('Error logging hydration:', error)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-blue-600 text-white">
          <Coffee className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Hydration Habit</h3>
          <p className="text-sm text-gray-600">Build a consistent water-drinking rhythm</p>
        </div>
      </div>

      {!completed ? (
        <div className="space-y-6">
          {/* Educational Context */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">💧 Why Hydration Matters</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Even mild dehydration (2%) affects focus and memory</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Regular hydration supports alertness and energy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Linking water to meals creates an easy habit</span>
              </li>
            </ul>
          </div>

          {/* Hydration Checkpoints */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tap to confirm when you drink water:
            </label>
            <div className="space-y-3">
              {checkpoints.map((checkpoint) => (
                <button
                  key={checkpoint.id}
                  onClick={() => toggleCheckpoint(checkpoint.id as keyof typeof hydrationLog)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    hydrationLog[checkpoint.id as keyof typeof hydrationLog]
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      hydrationLog[checkpoint.id as keyof typeof hydrationLog]
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {hydrationLog[checkpoint.id as keyof typeof hydrationLog] && (
                        <CheckCircle className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{checkpoint.icon}</span>
                        <span className="font-semibold text-gray-800">{checkpoint.label}</span>
                      </div>
                      <div className="text-sm text-gray-600">{checkpoint.time}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Today's Progress</span>
              <span className="text-sm font-semibold text-blue-700">
                {completedCount}/{checkpoints.length} checkpoints
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${(completedCount / checkpoints.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Hydration Tips */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <h4 className="font-semibold text-cyan-800 mb-2">💡 Hydration Tips</h4>
            <ul className="space-y-1 text-sm text-cyan-700">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Keep a water bottle visible while studying</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Add fruit slices for flavor if plain water is boring</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Drink water, not just when thirsty (thirst = already dehydrated)</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleComplete}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Complete Hydration Log
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800 mb-2">Hydration Logged!</h4>
          <p className="text-gray-600 mb-4">
            You hit {completedCount}/{checkpoints.length} hydration checkpoints today
          </p>
          <div className="bg-blue-50 rounded-lg p-4">
            {completedCount === checkpoints.length ? (
              <p className="text-sm text-blue-800">
                🎉 Perfect! You hit all checkpoints - great hydration habit!
              </p>
            ) : completedCount >= 3 ? (
              <p className="text-sm text-blue-800">
                ✅ Good job! You're building a solid hydration routine.
              </p>
            ) : (
              <p className="text-sm text-blue-800">
                📝 Try to hit more checkpoints tomorrow for better focus.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}