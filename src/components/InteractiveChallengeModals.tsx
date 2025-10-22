// components/InteractiveChallengeModals.tsx
'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DimDownTracker, BedroomEnvironmentSetup, SleepCoolDownRoutine } from './SleepHygieneTracking'
import { ScreensOff30Tracker, SoundscapeTracker } from './ScreenTimeTracker'
import { ConsistentMealWindowsTracker, SmartCaffeineWindowTracker, StudySnackSwapTracker, HydrationHabitTracker } from './MealTimingTracker'
import { CognitiveProgressDashboard } from './CognitiveGameTracker'
import { ShiftingChallengeSetup } from './ChallengeSetupWizard'

interface InteractiveChallengeModalProps {
  challengeId: string
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  userId: string
}

export const InteractiveChallengeModal: React.FC<InteractiveChallengeModalProps> = ({
  challengeId,
  isOpen,
  onClose,
  onComplete,
  userId
}) => {
  if (!isOpen) return null

  const getChallengeComponent = () => {
    switch (challengeId) {
      // Sleep Hygiene
      case 'evening-dim-down':
        return <DimDownTracker challengeId={challengeId} onComplete={onComplete} />
      case 'bedroom-reset':
        return <BedroomEnvironmentSetup challengeId={challengeId} onComplete={onComplete} />
      case 'consistent-pre-sleep-routine':
        return <SleepCoolDownRoutine challengeId={challengeId} onComplete={onComplete} />
      case 'screens-off-30':
        return <ScreensOff30Tracker challengeId={challengeId} onComplete={onComplete} />
      case 'soundscape-snooze':
        return <SoundscapeTracker challengeId={challengeId} onComplete={onComplete} />
      
      // Diet & Caffeine
      case 'consistent-meal-windows':
        return <ConsistentMealWindowsTracker challengeId={challengeId} onComplete={onComplete} />
      case 'smart-caffeine-window':
        return <SmartCaffeineWindowTracker challengeId={challengeId} onComplete={onComplete} />
      case 'study-snack-swap':
        return <StudySnackSwapTracker challengeId={challengeId} onComplete={onComplete} />
      case 'hydration-habit':
        return <HydrationHabitTracker challengeId={challengeId} onComplete={onComplete} />
      
      // Cognitive
      case 'daily-duo':
      case 'am-vs-pm-compare':
      case 'consistency-quest':
      case 'streak-safe':
        return <CognitiveProgressDashboard challengeId={challengeId} userId={userId} />
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">No interactive tracker for this challenge yet.</p>
          </div>
        )
    }
  }

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
            {getChallengeComponent()}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}