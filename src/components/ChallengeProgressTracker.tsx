// components/ChallengeProgressTracker.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { trackChallengeProgress } from '@/utils/challengeTracker'

interface ProgressTrackerProps {
  challenge: any
  progress: any
  userId: string
}

export const ChallengeProgressTracker: React.FC<ProgressTrackerProps> = ({
  challenge,
  progress,
  userId
}) => {
  const [todayStatus, setTodayStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [autoTracked, setAutoTracked] = useState(false)

  useEffect(() => {
    const checkTodayProgress = async () => {
      setLoading(true)
      const result = await trackChallengeProgress(
        userId,
        challenge.id,
        challenge.category
      )
      
      if (result) {
        setTodayStatus(result)
        setAutoTracked(true)
      }
      setLoading(false)
    }

    checkTodayProgress()
    
    // Refresh every 5 minutes
    const interval = setInterval(checkTodayProgress, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [userId, challenge.id, challenge.category])

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">Today's Progress</h3>
        {autoTracked && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Auto-tracked
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : todayStatus ? (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            todayStatus.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {todayStatus.success ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
            <div className="flex-1">
              <div className={`font-semibold ${
                todayStatus.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {todayStatus.success ? 'Target Met!' : 'Target Missed'}
              </div>
             <div className="text-sm text-gray-600 mt-1">
                {todayStatus.reason || renderProgressDetails(challenge.id, todayStatus)}
              </div>
            </div>
          </div>

          {/* Detailed Progress Information */}
          {renderDetailedProgress(challenge.id, todayStatus)}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          <div>
            <div className="font-semibold text-yellow-800">No Data Yet</div>
            <div className="text-sm text-gray-600 mt-1">
              {getWaitingMessage(challenge.id)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const renderProgressDetails = (challengeId: string, status: any) => {
  switch (challengeId) {
    case 'fifteen-minute-shift':
    case 'wake-time-anchor':
      return `Target: ${status.targetTime} | Actual: ${status.actualTime} | Difference: ${Math.round(status.differenceMinutes)} min`
    
    case 'consistent-meal-windows':
      return `${status.mealsLogged}/3 main meals logged today`
    
    case 'early-dinner-window':
      return `${status.hoursBeforeSleep?.toFixed(1)} hours between dinner and bedtime (target: 3+)`
    
    case 'smart-caffeine-window':
      return status.noCaffeine 
        ? 'No caffeine consumed today' 
        : `Last caffeine: ${status.lastCaffeineTime} (${status.withinWindow ? 'within' : 'outside'} target window)`
    
    case 'daily-duo':
      return `${status.sessionsCompleted}/2 game sessions completed`
    
    case 'am-vs-pm-compare':
      return `AM sessions: ${status.amCount} | PM sessions: ${status.pmCount}`
    
    case 'consistency-quest':
      return `Consistency: ${status.consistency?.toFixed(1)}% | Std Dev: ${status.standardDeviation?.toFixed(0)}ms`
    
    default:
      return 'Progress tracked'
  }
}

const renderDetailedProgress = (challengeId: string, status: any) => {
  if (challengeId === 'fifteen-minute-shift' || challengeId === 'wake-time-anchor') {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 mb-3">Timeline View</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Target Time:</span>
            <span className="font-medium">{status.targetTime}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Actual Time:</span>
            <span className="font-medium">{status.actualTime}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tolerance Window:</span>
            <span className="font-medium">±{status.toleranceWindow} min</span>
          </div>
          <div className="mt-3">
            <div className="relative h-2 bg-gray-200 rounded-full">
              <div 
                className={`absolute h-2 rounded-full ${
                  status.success ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: '100%',
                  opacity: Math.max(0.3, 1 - (status.differenceMinutes / status.toleranceWindow))
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (challengeId === 'daily-duo' || challengeId === 'am-vs-pm-compare') {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 mb-3">Today's Sessions</h4>
        <div className="space-y-2">
          {status.sessions?.map((session: any, index: number) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{session.gameType}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">
                  {new Date(session.timestamp).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
                <span className="font-medium text-blue-600">
                  {session.score?.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

const getWaitingMessage = (challengeId: string) => {
  const messages: Record<string, string> = {
    'fifteen-minute-shift': 'Log your sleep time to track progress',
    'wake-time-anchor': 'Log your wake time to track progress',
    'consistent-meal-windows': 'Log your meals to track progress',
    'early-dinner-window': 'Log dinner time and bedtime to track progress',
    'smart-caffeine-window': 'Log your drinks to track caffeine timing',
    'daily-duo': 'Play 2 brain games today to track progress',
    'am-vs-pm-compare': 'Play games in both AM and PM to track progress',
    'screens-off-30': 'Log your last screen time and bedtime',
    'evening-dim-down': 'Complete your dim-down routine to track progress'
  }
  
  return messages[challengeId] || 'Log your activities to track progress'
}