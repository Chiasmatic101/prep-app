// components/ChallengeSetupWizard.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Target, TrendingUp, AlertCircle } from 'lucide-react'
import { JET_LAG_STRATEGIES, calculateShiftingPlan } from '@/utils/shiftingChallengeLogic'

interface SetupWizardProps {
  challengeId: string
  onComplete: (setupData: any) => void
  onCancel: () => void
  userData: any
}

export const ShiftingChallengeSetup: React.FC<SetupWizardProps> = ({
  challengeId,
  onComplete,
  onCancel,
  userData
}) => {
  const [step, setStep] = useState(1)
  const [setupData, setSetupData] = useState({
    currentSleepTime: '',
    currentWakeTime: '',
    targetWakeTime: '',
    syncImprovement: 0,
    selectedStrategy: JET_LAG_STRATEGIES[0]
  })
  const [plan, setPlan] = useState<any>(null)

  const handleCalculatePlan = () => {
    const calculatedPlan = calculateShiftingPlan(
      setupData.currentSleepTime,
      setupData.currentWakeTime,
      setupData.targetWakeTime,
      setupData.syncImprovement,
      setupData.selectedStrategy
    )
    setPlan(calculatedPlan)
    setStep(3)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold mb-6">Setup Your Shifting Challenge</h2>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Sleep Time
                </label>
                <input
                  type="time"
                  value={setupData.currentSleepTime}
                  onChange={(e) => setSetupData({ ...setupData, currentSleepTime: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">When do you typically fall asleep?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Wake Time
                </label>
                <input
                  type="time"
                  value={setupData.currentWakeTime}
                  onChange={(e) => setSetupData({ ...setupData, currentWakeTime: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">When do you typically wake up?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Wake Time
                </label>
                <input
                  type="time"
                  value={setupData.targetWakeTime}
                  onChange={(e) => setSetupData({ ...setupData, targetWakeTime: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">What time do you need to wake up for school?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sync Improvement Needed: {setupData.syncImprovement}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={setupData.syncImprovement}
                  onChange={(e) => setSetupData({ ...setupData, syncImprovement: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Minor adjustment</span>
                  <span>Major shift needed</span>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!setupData.currentSleepTime || !setupData.currentWakeTime || !setupData.targetWakeTime}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-all"
              >
                Continue to Strategy Selection
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold mb-4">Choose Your Shifting Strategy</h3>
              
              <div className="space-y-3">
                {JET_LAG_STRATEGIES.map((strategy, index) => (
                  <button
                    key={index}
                    onClick={() => setSetupData({ ...setupData, selectedStrategy: strategy })}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      setupData.selectedStrategy.name === strategy.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{strategy.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{strategy.description}</div>
                    <div className="flex gap-2 mt-2 text-xs">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Max {strategy.maxShiftPerDay}min/day
                      </span>
                      {strategy.lightExposureRecommended && (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                          Light exposure
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCalculatePlan}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-semibold transition-all"
                >
                  Generate Plan
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && plan && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Your Personalized Plan</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm text-gray-600">Total Shift</div>
                    <div className="text-xl font-bold text-gray-800">
                      {Math.abs(plan.totalShiftMinutes)} min
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm text-gray-600">Daily Adjustment</div>
                    <div className="text-xl font-bold text-gray-800">
                      {plan.dailyShiftMinutes} min
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm text-gray-600">Estimated Duration</div>
                    <div className="text-xl font-bold text-gray-800">
                      {plan.estimatedDays} days
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm text-gray-600">Direction</div>
                    <div className="text-xl font-bold text-gray-800 capitalize">
                      {plan.direction}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Daily Milestones</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {plan.milestones.slice(0, 7).map((milestone: any, index: number) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Day {milestone.day}</span>
                        <span className="font-medium text-gray-800">{milestone.targetTime}</span>
                        <span className="text-gray-500 text-xs">±{milestone.toleranceWindow}min</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Important Reminders:</p>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li>Maintain consistent sleep duration (7-9 hours)</li>
                      <li>Use bright light exposure in the morning</li>
                      <li>Avoid caffeine 6+ hours before bedtime</li>
                      <li>Be patient - your body needs time to adjust</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => onComplete({ ...setupData, plan })}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-lg font-semibold transition-all"
                >
                  Start Challenge
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}