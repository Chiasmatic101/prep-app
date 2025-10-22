'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Moon } from 'lucide-react'

interface SleepEntryForm {
  bedTime: string
  wakeTime: string
  date: string
  wakingEvents?: number
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SleepEntryForm) => void
}

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

export default SleepModal