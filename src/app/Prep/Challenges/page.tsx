'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { doc, getDoc, setDoc, collection, query, where, orderBy, getDocs, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { 
  Clock, 
  Sun, 
  Moon, 
  Target, 
  Trophy, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Star,
  TrendingUp,
  Sunrise,
  Award,
  Play,
  Pause,
  RotateCcw,
  Utensils,
  Coffee,
  Apple,
  Droplets
} from 'lucide-react'

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

interface ChallengeProgress {
  challengeId: string
  startDate: string
  isActive: boolean
  currentDay: number
  totalDays: number
  dailyProgress: { [day: number]: boolean }
  targetValue?: string // e.g., "22:30" for bedtime
  weekdayAverage?: string // for Weekend Drift Guard
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

interface SleepEntry {
  bedTime: string
  wakeTime: string
  date: string
  sleepQualityScore?: number
}

interface LightExposureEntry {
  date: string
  timeLogged: string
  duration: number // minutes
  location: string // "outdoor" | "device" | "other"
  withinTarget: boolean // within 60 min of wake
}

const CHALLENGES: Challenge[] = [
  // Shifting Challenges
  {
    id: 'fifteen-minute-shift',
    title: '15-Minute Shift Week',
    goal: 'Nudge bedtime/wake time toward school schedule',
    duration: '7 days',
    rules: [
      'Shift target bedtime by ±15 min/day',
      'Maximum 90 minutes total shift',
      'Sleep onset within ±10 min of target',
      'Achieve target ≥5/7 nights'
    ],
    verification: 'Sleep timestamps within ±10 min of target, ≥5/7 nights',
    basePoints: 50,
    bonusPoints: '10 points per night on target',
    icon: <Clock className="w-6 h-6" />,
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-600'
  },
  {
    id: 'wake-time-anchor',
    title: 'Wake-Time Anchor Streak',
    goal: 'Lock a consistent wake time',
    duration: '10 days',
    rules: [
      'Wake within ±20 min of target time',
      'Success rate: 8/10 days minimum',
      'No weekend exceptions'
    ],
    verification: 'Wearable wake or self-report; 8/10 days success',
    basePoints: 80,
    bonusPoints: 'Streak bonus for consecutive days',
    icon: <Sunrise className="w-6 h-6" />,
    color: 'orange',
    bgGradient: 'from-orange-500 to-yellow-600'
  },
  {
    id: 'weekend-drift-guard',
    title: 'Weekend Drift Guard',
    goal: 'Reduce "social jetlag"',
    duration: '3 weekends',
    rules: [
      'Keep weekend wake within 60 min of weekday average',
      'Compare Sat/Sun wake to Tue–Thu average',
      'Both weekend days must meet target'
    ],
    verification: 'Compare weekend wake times to weekday average',
    basePoints: 60,
    bonusPoints: '10 points if both days within target',
    icon: <Calendar className="w-6 h-6" />,
    color: 'purple',
    bgGradient: 'from-purple-500 to-pink-600'
  },
  {
    id: 'see-the-light',
    title: 'See the Light!',
    goal: 'Strengthen circadian signal',
    duration: '7–14 days',
    rules: [
      '10–20 min outdoor light within 60 min of wake',
      'Walk to school or use natural light device',
      'Daily check-in required'
    ],
    verification: 'Quick check-in + optional light/step spike',
    basePoints: 5,
    bonusPoints: 'Streak bonus at 7 & 14 days',
    icon: <Sun className="w-6 h-6" />,
    color: 'green',
    bgGradient: 'from-green-500 to-emerald-600'
  },
  // Sleep Hygiene Challenges
  {
    id: 'evening-dim-down',
    title: 'Evening Dim-Down 60',
    goal: 'Lower pre-sleep arousal',
    duration: '7 days',
    rules: [
      'Last 60 min: warm/dim lights only',
      'No bright screens or use blue light filter',
      'Enable "no-scroll" timer if needed',
      'Complete nightly check-in'
    ],
    verification: 'In-app toggle + "no-scroll" timer verification',
    basePoints: 10,
    bonusPoints: '10 points per evening completed',
    icon: <Moon className="w-6 h-6" />,
    color: 'indigo',
    bgGradient: 'from-indigo-500 to-purple-600'
  },
  {
    id: 'bedroom-reset',
    title: 'Bedroom Reset',
    goal: 'Optimize room (dark/cool/quiet)',
    duration: '7 days',
    rules: [
      'Complete 5-item setup checklist on Day 1',
      'Maintain 4/5 items nightly',
      'Room temperature 65-68°F (18-20°C)',
      'Minimize light and noise sources'
    ],
    verification: 'Daily checklist completion',
    basePoints: 60,
    bonusPoints: '5 points per night maintained',
    icon: <Target className="w-6 h-6" />,
    color: 'teal',
    bgGradient: 'from-teal-500 to-blue-600'
  },
  {
    id: 'screens-off-30',
    title: 'Screens-Off 30',
    goal: 'Protect last 30 min before sleep',
    duration: '7–14 days',
    rules: [
      'No screens 30 minutes before bedtime',
      'Use app focus mode or manual timer',
      'Alternative activities: reading, stretching, meditation',
      'Emergency exceptions must be logged'
    ],
    verification: 'Timer + focus mode engagement logs',
    basePoints: 10,
    bonusPoints: 'Streak bonus for consecutive days',
    icon: <XCircle className="w-6 h-6" />,
    color: 'red',
    bgGradient: 'from-red-500 to-pink-600'
  },
  {
    id: 'soundscape-snooze',
    title: 'Soundscape Snooze',
    goal: 'Build a wind-down ritual',
    duration: '10 nights',
    rules: [
      'Use calming sounds ≥15 min pre-sleep',
      'Choose consistent soundscape type',
      'No stimulating audio content',
      'Track session start/stop times'
    ],
    verification: 'Audio session logs and duration tracking',
    basePoints: 8,
    bonusPoints: '20 bonus points on completion',
    icon: <Star className="w-6 h-6" />,
    color: 'cyan',
    bgGradient: 'from-cyan-500 to-blue-600'
  },
  {
    id: 'late-night-snack-smart',
    title: 'Late-Night Snack Smart',
    goal: 'Avoid heavy meals before bed',
    duration: '7 days',
    rules: [
      'No heavy meals 2-3 hours before bedtime',
      'Light snacks (under 200 calories) are acceptable',
      'Focus on sleep-promoting foods if needed',
      'Log meal timing relative to bedtime'
    ],
    verification: 'Meal timing check-ins and food diary',
    basePoints: 7,
    bonusPoints: '3 bonus points for perfect nights',
    icon: <Utensils className="w-6 h-6" />,
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-600'
  },
  {
    id: 'consistent-pre-sleep-routine',
    title: 'Consistent Pre-Sleep Routine',
    goal: 'Cue the brain for sleep',
    duration: '14 days',
    rules: [
      'Choose 2 activities: warm shower, stretch, read, breathwork',
      'Perform routine 20-30 min before sleep',
      'Same activities and timing each night',
      'Complete routine before getting into bed'
    ],
    verification: 'Tap-to-confirm routine checklist',
    basePoints: 8,
    bonusPoints: '20 bonus points at 14 days completion',
    icon: <RotateCcw className="w-6 h-6" />,
    color: 'violet',
    bgGradient: 'from-violet-500 to-purple-600'
  },
  // Cognitive Tracking Challenges
  {
    id: 'daily-duo',
    title: 'Daily Duo',
    goal: 'Regular measurement',
    duration: '14 days',
    rules: [
      'Play any two games per day',
      'Mix game types (e.g., Reaction + Memory)',
      'Track performance trends over time',
      'Complete sessions with focus, not speed'
    ],
    verification: 'Game logs showing 2 games per day',
    basePoints: 10,
    bonusPoints: '30 bonus points at 14 days completion',
    icon: <Target className="w-6 h-6" />,
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-green-600'
  },
  {
    id: 'am-vs-pm-compare',
    title: 'AM vs PM Compare',
    goal: 'Discover personal best times',
    duration: '10 days',
    rules: [
      'Play the same game once in AM, once in PM',
      'Complete comparison on ≥5 days',
      'Note timing differences in performance',
      'Build personal circadian performance map'
    ],
    verification: 'Timestamps + scores with delta heatmap',
    basePoints: 12,
    bonusPoints: 'Insight badge for completion',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'sky',
    bgGradient: 'from-sky-500 to-blue-600'
  },
  {
    id: 'consistency-quest',
    title: 'Consistency Quest',
    goal: 'Improve stability (not just speed)',
    duration: '10 sessions',
    rules: [
      'Focus on reducing reaction time variability',
      'Keep standard deviation under baseline by 5-10%',
      'Quality over speed - consistent performance',
      'Track stability improvements over time'
    ],
    verification: 'RT distribution analysis vs baseline',
    basePoints: 15,
    bonusPoints: '15 points per session meeting stability',
    icon: <CheckCircle className="w-6 h-6" />,
    color: 'rose',
    bgGradient: 'from-rose-500 to-pink-600'
  },
  {
    id: 'memory-ladder',
    title: 'Memory Ladder',
    goal: 'Level up memory task difficulty',
    duration: 'Until target level reached',
    rules: [
      'Climb one level every 2 sessions',
      'Auto-scaling difficulty based on performance',
      'Target: reach Level 7-9 (personal goal)',
      'Focus on sustainable progression'
    ],
    verification: 'Level completion tracking',
    basePoints: 10,
    bonusPoints: '10 points per new level achieved',
    icon: <Star className="w-6 h-6" />,
    color: 'lime',
    bgGradient: 'from-lime-500 to-green-600'
  },
  {
    id: 'attention-uptick',
    title: 'Attention Uptick',
    goal: 'Gradual improvement',
    duration: '14 days',
    rules: [
      'Establish 3-day baseline performance',
      'Improve rolling median by small % (+3%)',
      'Sustainable, gradual progress',
      'Focus on consistent attention, not peaks'
    ],
    verification: 'Rolling median vs baseline comparison',
    basePoints: 50,
    bonusPoints: 'Completion bonus for sustained improvement',
    icon: <Trophy className="w-6 h-6" />,
    color: 'yellow',
    bgGradient: 'from-yellow-500 to-amber-600'
  },
  {
    id: 'streak-safe',
    title: 'Streak-Safe',
    goal: 'Healthy routine, no pressure',
    duration: 'Open-ended',
    rules: [
      '1 game per day for 7-day streaks',
      'Built-in rest day options',
      'No pressure to maintain endless streaks',
      'Focus on sustainable gaming habits'
    ],
    verification: 'Daily play logs with rest day tracking',
    basePoints: 5,
    bonusPoints: 'Streak multipliers with rest day bonuses',
    icon: <Award className="w-6 h-6" />,
    color: 'fuchsia',
    bgGradient: 'from-fuchsia-500 to-purple-600'
  },
  // Diet & Caffeine Timing Challenges
  {
    id: 'consistent-meal-windows',
    title: 'Consistent Meal Windows',
    goal: 'Regularity that supports energy',
    duration: '10 days',
    rules: [
      'Log breakfast within ~90 min of wake time',
      'Have lunch during mid-day hours',
      'Eat dinner in the evening window',
      'Focus on timing consistency, not food choices'
    ],
    verification: 'Meal-time check-ins for each meal',
    basePoints: 6,
    bonusPoints: '6 points per meal day completed',
    icon: <Utensils className="w-6 h-6" />,
    color: 'orange',
    bgGradient: 'from-orange-500 to-red-600'
  },
  {
    id: 'early-dinner-window',
    title: 'Early Dinner Window',
    goal: 'Leave a buffer before sleep',
    duration: '7 days',
    rules: [
      'Finish dinner ~3+ hours before intended bedtime',
      'Success on ≥5/7 nights (flexible approach)',
      'Focus on timing awareness, not restriction',
      'Allow flexibility for social situations'
    ],
    verification: 'Dinner time vs bedtime target comparison',
    basePoints: 8,
    bonusPoints: '8 points per night meeting target',
    icon: <Clock className="w-6 h-6" />,
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-600'
  },
  {
    id: 'smart-caffeine-window',
    title: 'Smart Caffeine Window',
    goal: 'Protect sleep and reduce jitters',
    duration: '10 days',
    rules: [
      'If you use caffeine, keep it to morning/early afternoon',
      'Avoid caffeine in late afternoon and evening',
      'Track timing awareness, not elimination',
      'No judgment on caffeine use or non-use'
    ],
    verification: 'Caffeine log with timing (yes/no + time)',
    basePoints: 6,
    bonusPoints: '6 points per day following window',
    icon: <Coffee className="w-6 h-6" />,
    color: 'amber',
    bgGradient: 'from-amber-600 to-yellow-700'
  },
  {
    id: 'study-snack-swap',
    title: 'Study Snack Swap',
    goal: 'Smoother energy during study',
    duration: '7 days',
    rules: [
      'Choose a "steady energy" snack for first study block',
      'Options: fruit + nuts, yogurt, whole grain crackers',
      'Focus on sustained energy rather than quick fixes',
      'Build awareness of how foods affect focus'
    ],
    verification: 'Quick snack selection check-in',
    basePoints: 5,
    bonusPoints: '5 points per day with mindful snack choice',
    icon: <Apple className="w-6 h-6" />,
    color: 'green',
    bgGradient: 'from-green-500 to-emerald-600'
  },
  {
    id: 'hydration-habit',
    title: 'Hydration Habit',
    goal: 'Simple hydration rhythm',
    duration: '10 days',
    rules: [
      'Drink water with each meal',
      'Have water before first study block',
      'Focus on building consistent rhythm',
      'Simple tap-to-confirm tracking'
    ],
    verification: 'Tap-to-confirm hydration check-ins',
    basePoints: 2,
    bonusPoints: '20 bonus points at 10-day completion',
    icon: <Droplets className="w-6 h-6" />,
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-600'
  }
]

const ChallengeCard: React.FC<{
  challenge: Challenge
  progress?: ChallengeProgress
  onStart: (challengeId: string) => void
  onViewDetails: (challengeId: string) => void
  isActive?: boolean
}> = ({ challenge, progress, onStart, onViewDetails, isActive }) => {
  const getProgressPercentage = () => {
    if (!progress) return 0
    return (progress.completedDays / progress.totalDays) * 100
  }

  const getStatusColor = () => {
    if (!progress) return 'text-gray-500'
    if (progress.completedDays === progress.totalDays) return 'text-green-600'
    if (isActive) return `text-${challenge.color}-600`
    return 'text-gray-500'
  }

  const getStatusText = () => {
    if (!progress) return 'Not Started'
    if (progress.completedDays === progress.totalDays) return 'Completed!'
    if (isActive) return `Day ${progress.currentDay}/${progress.totalDays}`
    return 'Paused'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg hover:shadow-xl transition-all hover:scale-105"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-r ${challenge.bgGradient} text-white`}>
          {challenge.icon}
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {progress && (
            <div className="text-lg font-bold text-gray-800">
              {progress.points} pts
            </div>
          )}
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-800 mb-2">{challenge.title}</h3>
      <p className="text-gray-600 text-sm mb-3">{challenge.goal}</p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{challenge.duration}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Trophy className="w-4 h-4" />
          <span>{challenge.basePoints} base points</span>
        </div>
      </div>

      {progress && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progress.completedDays}/{progress.totalDays} days</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full bg-gradient-to-r ${challenge.bgGradient}`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!progress && (
          <button
            onClick={() => onStart(challenge.id)}
            className={`flex-1 bg-gradient-to-r ${challenge.bgGradient} hover:opacity-90 text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2`}
          >
            <Play className="w-4 h-4" />
            Start Challenge
          </button>
        )}
        
        <button
          onClick={() => onViewDetails(challenge.id)}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all"
        >
          View Details
        </button>
      </div>
    </motion.div>
  )
}

const ChallengeDetailsModal: React.FC<{
  challenge: Challenge | null
  progress?: ChallengeProgress
  onClose: () => void
  onLogProgress: (challengeId: string, success: boolean, notes?: string) => void
  onStartChallenge: (challengeId: string, targetValue?: string) => void
  recentSleepData?: SleepEntry[]
}> = ({ challenge, progress, onClose, onLogProgress, onStartChallenge, recentSleepData }) => {
  const [logSuccess, setLogSuccess] = useState(true)
  const [logNotes, setLogNotes] = useState('')
  const [targetTime, setTargetTime] = useState('')

  if (!challenge) return null

  const handleStartWithTarget = () => {
    onStartChallenge(challenge.id, targetTime)
    onClose()
  }

  const handleLogSubmit = () => {
    onLogProgress(challenge.id, logSuccess, logNotes)
    setLogNotes('')
    onClose()
  }

  const getDailyTargetTime = () => {
    if (!progress || !progress.targetValue) return 'Not set'
    
    if (challenge.id === 'fifteen-minute-shift') {
      const baseTime = new Date(`2024-01-01T${progress.targetValue}`)
      const shiftMinutes = (progress.currentDay - 1) * 15
      const targetTime = new Date(baseTime.getTime() + shiftMinutes * 60000)
      return targetTime.toTimeString().slice(0, 5)
    }
    
    return progress.targetValue
  }

  return (
    <AnimatePresence>
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-gradient-to-r ${challenge.bgGradient} text-white`}>
                {challenge.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{challenge.title}</h2>
                <p className="text-gray-600">{challenge.goal}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Challenge Details */}
            <div className="bg-gray-50/80 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Challenge Rules</h3>
              <ul className="space-y-2">
                {challenge.rules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Current Progress */}
            {progress && (
              <div className="bg-blue-50/80 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Current Progress
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-700">{progress.currentDay}</div>
                    <div className="text-sm text-gray-600">Current Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-700">{progress.completedDays}</div>
                    <div className="text-sm text-gray-600">Successful Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-700">{progress.points}</div>
                    <div className="text-sm text-gray-600">Points Earned</div>
                  </div>
                </div>
                
                {progress.targetValue && (
                  <div className="bg-white/50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Today's Target:</div>
                    <div className="text-lg font-bold text-gray-800">{getDailyTargetTime()}</div>
                  </div>
                )}
              </div>
            )}

            {/* Start Challenge Section */}
            {!progress && (
              <div className="bg-green-50/80 rounded-xl p-4">
                <h3 className="font-semibold text-green-800 mb-3">Start Challenge</h3>
                {(challenge.id === 'fifteen-minute-shift' || challenge.id === 'wake-time-anchor') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target {challenge.id === 'fifteen-minute-shift' ? 'Bedtime' : 'Wake Time'}
                    </label>
                    <input
                      type="time"
                      value={targetTime}
                      onChange={(e) => setTargetTime(e.target.value)}
                      className="w-full p-3 bg-white/50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}
                <button
                  onClick={handleStartWithTarget}
                  disabled={((challenge.id === 'fifteen-minute-shift' || challenge.id === 'wake-time-anchor') && !targetTime)}
                  className={`w-full bg-gradient-to-r ${challenge.bgGradient} hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all`}
                >
                  Start {challenge.title}
                </button>
              </div>
            )}

            {/* Log Today's Progress */}
            {progress && progress.isActive && (
              <div className="bg-yellow-50/80 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-800 mb-3">Log Today's Progress</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Did you meet today's target?
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setLogSuccess(true)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                          logSuccess 
                            ? 'bg-green-200 text-green-800 border-2 border-green-400' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        ✓ Yes
                      </button>
                      <button
                        onClick={() => setLogSuccess(false)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                          !logSuccess 
                            ? 'bg-red-200 text-red-800 border-2 border-red-400' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        ✗ No
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (optional)
                    </label>
                    <textarea
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      placeholder="How did it go? Any challenges or observations?"
                      rows={3}
                      className="w-full p-3 bg-white/50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    />
                  </div>
                  
                  <button
                    onClick={handleLogSubmit}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-xl font-semibold transition-all"
                  >
                    Log Progress
                  </button>
                </div>
              </div>
            )}

            {/* Daily Progress Grid */}
            {progress && (
              <div className="bg-purple-50/80 rounded-xl p-4">
                <h3 className="font-semibold text-purple-800 mb-3">Daily Progress</h3>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: progress.totalDays }, (_, i) => i + 1).map(day => (
                    <div
                      key={day}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium ${
                        progress.dailyProgress[day] === true
                          ? 'bg-green-200 text-green-800'
                          : progress.dailyProgress[day] === false
                          ? 'bg-red-200 text-red-800'
                          : day <= progress.currentDay
                          ? 'bg-yellow-200 text-yellow-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function ShiftingChallengesPage() {
  const [userData, setUserData] = useState<any>(null)
  const [challengeData, setChallengeData] = useState<UserChallengeData>({
    activeChallenges: [],
    completedChallenges: [],
    totalPoints: 0,
    streaks: {}
  })
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [selectedProgress, setSelectedProgress] = useState<ChallengeProgress | undefined>()
  const [recentSleepData, setRecentSleepData] = useState<SleepEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  // Fetch user's sleep data for verification
  const fetchRecentSleepData = async (userId: string) => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const sleepQuery = query(
        collection(db, 'users', userId, 'sleepEntries'),
        orderBy('date', 'desc')
      )
      
      const sleepSnapshot = await getDocs(sleepQuery)
      const entries: SleepEntry[] = sleepSnapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.id
      } as SleepEntry))
      
      setRecentSleepData(entries)
    } catch (error) {
      console.error('Error fetching sleep data:', error)
    }
  }

  // Fetch challenge data
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data())
            await Promise.all([
              fetchChallengeData(user.uid),
              fetchRecentSleepData(user.uid)
            ])
          } else {
            setError('User profile not found')
          }
        } catch (err) {
          console.error('Error fetching user data:', err)
          setError('Failed to load data')
        }
      } else {
        router.push('/auth')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleStartChallenge = async (challengeId: string, targetValue?: string) => {
    if (!auth.currentUser) {
      setError('User not authenticated')
      return
    }

    const challenge = CHALLENGES.find(c => c.id === challengeId)
    if (!challenge) {
      setError('Challenge not found')
      return
    }

    // Check if challenge is already active
    const existingChallenge = challengeData.activeChallenges.find(c => c.challengeId === challengeId)
    if (existingChallenge) {
      setError('Challenge is already active')
      return
    }

    const totalDays = challengeId === 'wake-time-anchor' ? 10 : 
                      challengeId === 'weekend-drift-guard' ? 21 : // 3 weeks to cover 3 weekends
                      challengeId === 'see-the-light' ? 14 : 
                      challengeId === 'consistent-meal-windows' ? 10 :
                      challengeId === 'smart-caffeine-window' ? 10 :
                      challengeId === 'hydration-habit' ? 10 : 7

    const newProgress: ChallengeProgress = {
      challengeId,
      startDate: new Date().toISOString(),
      isActive: true,
      currentDay: 1,
      totalDays,
      dailyProgress: {},
      points: 0,
      completedDays: 0,
      ...(targetValue && { targetValue }) // Only include targetValue if it's not undefined
    }

    const updatedData = {
      activeChallenges: [...(challengeData.activeChallenges || []), newProgress],
      completedChallenges: challengeData.completedChallenges || [],
      totalPoints: challengeData.totalPoints || 0,
      streaks: challengeData.streaks || {}
    }

    try {
      console.log('Starting challenge:', challengeId)
      console.log('User ID:', auth.currentUser.uid)
      console.log('Updated data:', updatedData)
      
      // First ensure the challenges subcollection exists by creating the document
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'challenges', 'shifting'), updatedData, { merge: true })
      
      setChallengeData(updatedData)
      setError('') // Clear any previous errors
      
      console.log('Challenge started successfully')
    } catch (error) {
      console.error('Detailed error starting challenge:', error)
      setError(`Failed to start challenge: ${error.message || 'Unknown error'}`)
    }
  }

  const handleLogProgress = async (challengeId: string, success: boolean, notes?: string) => {
    if (!auth.currentUser) return

    const challengeIndex = challengeData.activeChallenges.findIndex(c => c.challengeId === challengeId)
    if (challengeIndex === -1) return

    const updatedChallenges = [...challengeData.activeChallenges]
    const challenge = updatedChallenges[challengeIndex]
    const challengeInfo = CHALLENGES.find(c => c.id === challengeId)

    // Update daily progress
    challenge.dailyProgress[challenge.currentDay] = success
    if (success) {
      challenge.completedDays += 1
      challenge.points += challengeInfo?.basePoints || 0
    }

    if (notes) {
      if (!challenge.notes) challenge.notes = []
      challenge.notes.push(`Day ${challenge.currentDay}: ${notes}`)
    }

    // Move to next day
    challenge.currentDay += 1

    // Check if challenge is complete
    if (challenge.currentDay > challenge.totalDays) {
      challenge.isActive = false
      
      // Move to completed challenges
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
    } catch (error) {
      console.error('Error logging progress:', error)
      setError('Failed to log progress')
    }
  }

  const handleViewDetails = (challengeId: string) => {
    
const challenge = CHALLENGES.find(c => c.id === challengeId)
    const progress = [...challengeData.activeChallenges, ...challengeData.completedChallenges]
      .find(p => p.challengeId === challengeId)
    
    setSelectedChallenge(challenge || null)
    setSelectedProgress(progress)
  }

  const getActiveProgress = (challengeId: string) => {
    return challengeData.activeChallenges.find(p => p.challengeId === challengeId)
  }

  const isActive = (challengeId: string) => {
    return challengeData.activeChallenges.some(p => p.challengeId === challengeId)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading challenges...</p>
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
            onClick={() => router.push('/Prep/AboutMePage')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full font-medium transition"
          >
            Back to Profile
          </button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Shifting Challenges
            </span>
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Train your circadian rhythm to align with your schedule through evidence-based challenges
          </p>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 border border-white/40 shadow-lg mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700 mb-2">
                {challengeData.activeChallenges.length}
              </div>
              <div className="text-sm text-gray-600">Active Challenges</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {challengeData.completedChallenges.length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {challengeData.totalPoints}
              </div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {Math.max(...Object.values(challengeData.streaks), 0)}
              </div>
              <div className="text-sm text-gray-600">Best Streak</div>
            </div>
          </div>
        </motion.div>

      {/* Active Challenges */}
{challengeData.activeChallenges.length > 0 && (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="mb-12"
  >
    <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
      <Play className="w-8 h-8 text-green-600" />
      Active Challenges
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {challengeData.activeChallenges.map((progress) => {
        const challenge = CHALLENGES.find(c => c.id === progress.challengeId)
        return challenge ? (
          <div key={progress.challengeId} className="flex flex-col h-full">
            <ChallengeCard
              challenge={challenge}
              progress={progress}
              onStart={handleStartChallenge}
              onViewDetails={handleViewDetails}
              isActive={true}
            />

            {/* 👇 View Details link */}
            <div className="mt-2 text-right">
              <button
                onClick={() => handleViewDetails(challenge.id)}
                className="text-sm text-purple-600 hover:text-purple-800 underline"
              >
                View Details →
              </button>
            </div>
          </div>
        ) : null
      })}
    </div>
  </motion.div>
)}


        {/* Available Challenges - Organized by Category */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-12"
        >
          {/* Shifting Challenges Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              Shifting Challenges
            </h2>
            <p className="text-gray-600 mb-6">
              Train your circadian rhythm to align with your schedule
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CHALLENGES.filter(challenge => 
                ['fifteen-minute-shift', 'wake-time-anchor', 'weekend-drift-guard', 'see-the-light'].includes(challenge.id) && 
                !isActive(challenge.id)
              ).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onStart={handleStartChallenge}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </div>

          {/* Sleep Hygiene Challenges Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <Moon className="w-8 h-8 text-indigo-600" />
              Sleep Hygiene Challenges
            </h2>
            <p className="text-gray-600 mb-6">
              Build healthy sleep habits and optimize your sleep environment
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CHALLENGES.filter(challenge => 
                ['evening-dim-down', 'bedroom-reset', 'screens-off-30', 'soundscape-snooze', 'late-night-snack-smart', 'consistent-pre-sleep-routine'].includes(challenge.id)
              ).filter(challenge => !isActive(challenge.id)).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onStart={handleStartChallenge}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </div>

          {/* Cognitive Tracking Challenges Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <Target className="w-8 h-8 text-emerald-600" />
              Cognitive Tracking Challenges
            </h2>
            <p className="text-gray-600 mb-6">
              Play our cognitive games regularly to build healthy habits and track your performance patterns
            </p>
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-amber-800">Healthy Gaming Guidelines</span>
              </div>
              <p className="text-amber-700 text-sm">
                These challenges encourage sustainable gaming habits with built-in rest periods and focus on quality over quantity. 
                Remember: the goal is consistent measurement and insight, not excessive play time.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CHALLENGES.filter(challenge => 
                ['daily-duo', 'am-vs-pm-compare', 'consistency-quest', 'memory-ladder', 'attention-uptick', 'streak-safe'].includes(challenge.id)
              ).filter(challenge => !isActive(challenge.id)).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onStart={handleStartChallenge}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </div>

          {/* Diet & Caffeine Timing Challenges Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <Utensils className="w-8 h-8 text-orange-600" />
              Diet & Caffeine Timing Challenges
            </h2>
            <p className="text-gray-600 mb-6">
              Build awareness around meal timing and energy optimization - focused on timing, not restriction
            </p>
            <div className="bg-green-50/80 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Positive Nutrition Focus</span>
              </div>
              <p className="text-green-700 text-sm">
                These challenges emphasize timing awareness and energy optimization rather than restriction. 
                The goal is building sustainable habits that support your natural rhythms and academic performance.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CHALLENGES.filter(challenge => 
                ['consistent-meal-windows', 'early-dinner-window', 'smart-caffeine-window', 'study-snack-swap', 'hydration-habit'].includes(challenge.id)
              ).filter(challenge => !isActive(challenge.id)).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onStart={handleStartChallenge}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Completed Challenges */}
        {challengeData.completedChallenges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-600" />
              Completed Challenges
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challengeData.completedChallenges.map((progress) => {
                const challenge = CHALLENGES.find(c => c.id === progress.challengeId)
                return challenge ? (
                  <ChallengeCard
                    key={`completed-${progress.challengeId}-${progress.startDate}`}
                    challenge={challenge}
                    progress={progress}
                    onStart={handleStartChallenge}
                    onViewDetails={handleViewDetails}
                  />
                ) : null
              })}
            </div>
          </motion.div>
        )}

        {/* Tips and Guidelines */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-[2rem] p-8 border border-blue-200 shadow-lg mb-8"
        >
          <h3 className="text-2xl font-bold text-blue-800 mb-6 text-center flex items-center justify-center gap-2">
            <Star className="w-6 h-6" />
            Challenge Guidelines & Tips
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Best Practices
              </h4>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Start with one challenge at a time to build sustainable habits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Track your sleep patterns consistently for accurate progress monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Small, gradual changes are more sustainable than dramatic shifts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Be patient - circadian rhythm changes take time to establish</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Safety Reminders
              </h4>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Maintain adequate sleep duration while adjusting timing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Listen to your body and adjust targets if experiencing fatigue</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Consult healthcare providers for persistent sleep issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Don't sacrifice sleep quality for challenge completion</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Navigation Links */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center space-y-4"
        >
          <div className="space-x-4">
            <button
              onClick={() => router.push('/Prep/AboutMePage')}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
            >
              Back to Profile
            </button>
            <button
              onClick={() => router.push('/Prep/AboutMePage')}
              className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-8 py-3 rounded-full font-semibold border border-purple-300 transition-all hover:scale-105"
            >
              View Analytics
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            Track your progress and build sustainable circadian rhythm habits
          </p>
        </motion.div>

        {/* Challenge Details Modal */}
        <ChallengeDetailsModal
          challenge={selectedChallenge}
          progress={selectedProgress}
          onClose={() => {
            setSelectedChallenge(null)
            setSelectedProgress(undefined)
          }}
          onLogProgress={handleLogProgress}
          onStartChallenge={handleStartChallenge}
          recentSleepData={recentSleepData}
        />
      </div>
    </main>
  )
}