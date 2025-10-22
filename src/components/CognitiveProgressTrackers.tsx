// components/CognitiveProgressTrackers.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, TrendingUp, Trophy, Target } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'

interface MemoryLadderTrackerProps {
  challengeId: string
  userId: string
}

export const MemoryLadderTracker: React.FC<MemoryLadderTrackerProps> = ({
  challengeId,
  userId
}) => {
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionCount, setSessionCount] = useState(0)
  const [targetLevel, setTargetLevel] = useState(7)
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMemoryProgress()
  }, [userId])

  const fetchMemoryProgress = async () => {
    if (!userId) return

    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      
      const q = query(
        collection(db, 'users', userId, 'memoryMatchSessions'),
        where('timestamp', '>=', sevenDaysAgo),
        orderBy('timestamp', 'desc')
      )
      
      const snapshot = await getDocs(q)
      const sessions = snapshot.docs.map(doc => doc.data())
      
      setRecentSessions(sessions)
      setSessionCount(sessions.length)
      
      // Calculate current level based on recent performance
      if (sessions.length > 0) {
        const avgScore = sessions.slice(0, 5).reduce((sum, s) => sum + (s.score || 0), 0) / Math.min(5, sessions.length)
        const estimatedLevel = Math.min(9, Math.max(1, Math.round(avgScore / 10)))
        setCurrentLevel(estimatedLevel)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching memory progress:', error)
      setLoading(false)
    }
  }

  const getLevelInfo = (level: number) => {
    const levels = [
      { level: 1, pairs: 3, description: 'Beginner', color: 'blue' },
      { level: 2, pairs: 4, description: 'Getting Started', color: 'cyan' },
      { level: 3, pairs: 5, description: 'Building Skills', color: 'green' },
      { level: 4, pairs: 6, description: 'Intermediate', color: 'lime' },
      { level: 5, pairs: 7, description: 'Skilled', color: 'yellow' },
      { level: 6, pairs: 8, description: 'Advanced', color: 'orange' },
      { level: 7, pairs: 9, description: 'Expert', color: 'red' },
      { level: 8, pairs: 10, description: 'Master', color: 'purple' },
      { level: 9, pairs: 12, description: 'Grandmaster', color: 'pink' }
    ]
    return levels[level - 1]
  }

  const sessionsToNextLevel = Math.max(0, 2 - (sessionCount % 2))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  const currentLevelInfo = getLevelInfo(currentLevel)
  const nextLevelInfo = currentLevel < 9 ? getLevelInfo(currentLevel + 1) : null

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-purple-600 text-white">
          <Star className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Memory Ladder Progress</h3>
          <p className="text-sm text-gray-600">Climb to Level {targetLevel}!</p>
        </div>
      </div>

      {/* Current Level Display */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm opacity-90 mb-1">Current Level</div>
            <div className="text-4xl font-bold">{currentLevel}</div>
          </div>
          <Trophy className="w-12 h-12 opacity-80" />
        </div>
        <div className="text-sm opacity-90">
          {currentLevelInfo.description} • {currentLevelInfo.pairs} pairs
        </div>
      </div>

      {/* Progress to Next Level */}
      {nextLevelInfo && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-800">Next Level: {nextLevelInfo.level}</span>
            <span className="text-sm text-gray-600">{nextLevelInfo.description}</span>
          </div>
          
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{2 - sessionsToNextLevel}/2 sessions</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${((2 - sessionsToNextLevel) / 2) * 100}%` }}
              />
            </div>
          </div>
          
          <p className="text-sm text-gray-600">
            {sessionsToNextLevel === 0 
              ? '🎉 Ready to advance! Play one more session at current level.'
              : `Play ${sessionsToNextLevel} more session${sessionsToNextLevel > 1 ? 's' : ''} to unlock next level.`}
          </p>
        </div>
      )}

      {/* Level Ladder Visualization */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-gray-800 mb-3">Level Ladder</h4>
        <div className="space-y-2">
          {[9, 8, 7, 6, 5, 4, 3, 2, 1].map(level => {
            const info = getLevelInfo(level)
            const isComplete = currentLevel >= level
            const isTarget = level === targetLevel
            const isCurrent = level === currentLevel
            
            return (
              <div
                key={level}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  isCurrent 
                    ? 'border-purple-500 bg-purple-50 scale-105'
                    : isComplete 
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  isComplete ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {level}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{info.description}</div>
                  <div className="text-xs text-gray-600">{info.pairs} pairs</div>
                </div>
                {isCurrent && (
                  <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full">
                    Current
                  </span>
                )}
                {isTarget && !isCurrent && (
                  <Target className="w-5 h-5 text-orange-500" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">Recent Sessions</h4>
          <div className="space-y-2">
            {recentSessions.slice(0, 5).map((session, index) => (
              <div 
                key={index}
                className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
              >
                <span className="text-gray-700">
                  {new Date(session.timestamp).toLocaleDateString()}
                </span>
                <span className="font-semibold text-purple-600">
                  Score: {session.score || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => window.open('/Prep/PrepGames/MemoryMatch', '_blank')}
        className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
      >
        <Star className="w-5 h-5" />
        Play Memory Match
      </button>
    </div>
  )
}

export const AttentionUptickTracker: React.FC<{ challengeId: string; userId: string }> = ({
  challengeId,
  userId
}) => {
  const [baseline, setBaseline] = useState<number | null>(null)
  const [currentMedian, setCurrentMedian] = useState<number | null>(null)
  const [improvement, setImprovement] = useState<number>(0)
  const [sessionsThisWeek, setSessionsThisWeek] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttentionProgress()
  }, [userId])

  const fetchAttentionProgress = async () => {
    if (!userId) return

    try {
      const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
      
      const gameCollections = ['brainBattleSessions', 'ultimateTTTSessions', 'gameSessionsDetailed']
      const allSessions: any[] = []
      
      for (const collectionName of gameCollections) {
        const q = query(
          collection(db, 'users', userId, collectionName),
          where('timestamp', '>=', fourteenDaysAgo),
          where('domain', '==', 'attention'),
          orderBy('timestamp', 'desc')
        )
        
        const snapshot = await getDocs(q)
        snapshot.docs.forEach(doc => allSessions.push(doc.data()))
      }
      
      if (allSessions.length >= 3) {
        // First 3 sessions are baseline
        const baselineSessions = allSessions.slice(-3)
        const baselineScores = baselineSessions.map(s => s.normalizedScore || s.score || 0)
        const baselineMedian = calculateMedian(baselineScores)
        setBaseline(baselineMedian)
        
        // Last 3 sessions are current
        const currentSessions = allSessions.slice(0, 3)
        const currentScores = currentSessions.map(s => s.normalizedScore || s.score || 0)
        const currentMed = calculateMedian(currentScores)
        setCurrentMedian(currentMed)
        
        // Calculate improvement
        const improvementPercent = ((currentMed - baselineMedian) / baselineMedian) * 100
        setImprovement(improvementPercent)
      }
      
      setSessionsThisWeek(allSessions)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching attention progress:', error)
      setLoading(false)
    }
  }

  const calculateMedian = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const targetImprovement = 3 // 3% improvement goal
  const progressToTarget = Math.min(100, (improvement / targetImprovement) * 100)

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-blue-600 text-white">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Attention Uptick Tracker</h3>
          <p className="text-sm text-gray-600">Gradual +3% improvement goal</p>
        </div>
      </div>

      {baseline && currentMedian ? (
        <>
          {/* Improvement Display */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl p-6 text-white mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm opacity-90 mb-1">Current Improvement</div>
                <div className="text-4xl font-bold">
                  {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}%
                </div>
              </div>
              <TrendingUp className={`w-12 h-12 ${improvement >= 0 ? 'opacity-100' : 'opacity-50'}`} />
            </div>
            <div className="text-sm opacity-90">
              {improvement >= targetImprovement 
                ? '🎉 Target achieved!' 
                : `Target: +${targetImprovement}% improvement`}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress to Target</span>
              <span>{Math.round(progressToTarget)}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  improvement >= targetImprovement 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}
                style={{ width: `${Math.min(100, progressToTarget)}%` }}
              />
            </div>
          </div>

          {/* Baseline vs Current */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Baseline (First 3)</div>
              <div className="text-2xl font-bold text-gray-800">{baseline.toFixed(0)}</div>
              <div className="text-xs text-gray-500 mt-1">Median score</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">Current (Last 3)</div>
              <div className="text-2xl font-bold text-blue-800">{currentMedian.toFixed(0)}</div>
              <div className="text-xs text-blue-600 mt-1">Rolling median</div>
            </div>
          </div>

          {/* Session History */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
            <h4 className="font-semibold text-gray-800 mb-3">Recent Sessions</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
{sessionsThisWeek.slice(0, 10).map((session, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(session.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <span className="font-semibold text-blue-600">
                    {(session.normalizedScore || session.score || 0).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-yellow-800 mb-2">💡 Tips for Consistent Improvement</h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Focus on steady performance, not speed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Play during your peak alertness times</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Small, gradual gains are sustainable and effective</span>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📊</div>
          <h4 className="text-lg font-bold text-gray-800 mb-2">Establishing Baseline</h4>
          <p className="text-gray-600 mb-4">
            Play at least 3 attention-focused games to establish your baseline
          </p>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Current sessions: {sessionsThisWeek.length}/3
            </p>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => window.open('/Prep/PrepGames/GameSelection', '_blank')}
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
      >
        <Target className="w-5 h-5" />
        Play Attention Games
      </button>
    </div>
  )
}