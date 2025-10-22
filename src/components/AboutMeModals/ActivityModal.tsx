'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Dumbbell } from 'lucide-react'

interface ActivityEntry {
  time: string
  type: 'Light' | 'Medium' | 'Intense'
  activity: string
  duration: number
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ActivityEntry) => void
}

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

export default ActivityModal