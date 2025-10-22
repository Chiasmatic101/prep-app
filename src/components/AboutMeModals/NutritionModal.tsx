'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Utensils } from 'lucide-react'

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

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { meals: DietEntry[], hydration: HydrationEntry[], date: string }) => void
}

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

export default NutritionModal