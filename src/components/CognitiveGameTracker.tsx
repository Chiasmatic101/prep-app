// components/CognitiveGameTracker.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Target, TrendingUp, Award, Calendar, BarChart3 } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'

interface GameSession {
  gameType: string
  timestamp: number
  score: number
  hourOfDay: number
  domain: string
}

export const CognitiveProgressDashboard: React.FC<{
  challengeId: string
  userId: string
}> = ({ challengeId, userId }) => {
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [stats, setStats] = useState({
    todayCount: 0,
    amCount: 0,
    pmCount: 0,
    consistency: 0,
    weekStreak: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGameSessions()
  }, [userId])

  const fetchGameSessions = async () => {
    if (!userId) return
    
    const today = new Date().setHours(0, 0, 0, 0)
    const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000)
    
    const gameCollections = [
      'brainBattleSessions',
      'memoryMatchSessions',
      'soundMatchSessions',
      'ultimateTTTSessions',
      'gameSessionsDetailed'
    ]
    
    const allSessions: GameSession[] = []
    
    for (const collectionName of gameCollections) {
      const q = query(
        collection(db, 'users', userId, collectionName),
        where('timestamp', '>=', sevenDaysAgo),
        orderBy('timestamp', 'desc')
      )
      
      const snapshot = await getDocs(q)
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        allSessions.push({
          gameType: data.gameType || collectionName,
          timestamp: data.timestamp,
          score: data.normalizedScore || data.score || 0,
          hourOfDay: new Date(data.timestamp).getHours(),
          domain: data.domain || 'general'
        })
      })
    }
    
    setSessions(allSessions)
    calculateStats(allSessions)
    setLoading(false)
  }

  const calculateStats = (sessions: GameSession[]) => {
    const today = new Date().setHours(0, 0, 0, 0)
    const todaySessions = sessions.filter(s => s.timestamp >= today)
    
    const amSessions = todaySessions.filter(s => s.hourOfDay < 12)
    const pmSessions = todaySessions.filter(s => s.hourOfDay >= 12)
    
    // Calculate consistency (standard deviation of scores)
    const scores = sessions.slice(0, 10).map(s => s.score)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    const stdDev = Math.sqrt(variance)
    const consistency = scores.length > 0 ? Math.round((1 - (stdDev / mean)) * 100) : 0
    
    // Calculate streak
    let streak = 0
    const sortedDays = [...new Set(sessions.map(s => 
      new Date(s.timestamp).toISOString().split('T')[0]
    ))].sort().reverse()
    
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0 || 
          new Date(sortedDays[i-1]).getTime() - new Date(sortedDays[i]).getTime() === 24 * 60 * 60 * 1000) {
        streak++
      } else {
        break
      }
    }
    
    setStats({
      todayCount: todaySessions.length,
      amCount: amSessions.length,
      pmCount: pmSessions.length,
      consistency,
      weekStreak: streak
    })
  }

  const getChallengeSpecificContent = () => {
    switch (challengeId) {
      case 'daily-duo':
        return {
          title: 'Daily Duo Progress',
          target: '2 games per day',
          progress: `${stats.todayCount}/2 games today`,
          status: stats.todayCount >= 2 ? 'complete' : 'in-progress'
        }
      
      case 'am-vs-pm-compare':
        return {
          title: 'AM vs PM Compare',
          target: '1 AM + 1 PM session',
          progress: `AM: ${stats.amCount} | PM: ${stats.pmCount}`,
          status: stats.amCount > 0 && stats.pmCount > 0 ? 'complete' : 'in-progress'
        }
      
      case 'consistency-quest':
        return {
          title: 'Consistency Quest',
          target: '85%+ consistency',
          progress: `${stats.consistency}% consistency`,
          status: stats.consistency >= 85 ? 'complete' : 'in-progress'
        }
      
      case 'streak-safe':
        return {
          title: 'Streak Safe',
          target: '7-day streak',
          progress: `${stats.weekStreak} day streak`,
          status: stats.weekStreak >= 7 ? 'complete' : 'in-progress'
        }
      
      default:
        return {
          title: 'Game Progress',
          target: 'Keep playing!',
          progress: `${sessions.length} total sessions`,
          status: 'in-progress'
        }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const content = getChallengeSpecificContent()

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-emerald-600 text-white">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">{content.title}</h3>
          <p className="text-sm text-gray-600">{content.target}</p>
        </div>
      </div>

      {/* Status Card */}
      <div className={`rounded-lg p-4 mb-6 border-2 ${
        content.status === 'complete'
          ? 'bg-green-50 border-green-200'
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">Today's Progress</div>
            <div className="text-xl font-bold text-gray-800">{content.progress}</div>
          </div>
          {content.status === 'complete' && (
            <Award className="w-8 h-8 text-green-600" />
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-600">Streak</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{stats.weekStreak}</div>
          <div className="text-xs text-gray-500">days</div>
        </div>

        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-600">Consistency</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{stats.consistency}%</div>
          <div className="text-xs text-gray-500">score variance</div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
         <TrendingUp className="w-4 h-4 text-emerald-600" />
          Recent Sessions
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sessions.slice(0, 10).map((session, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  session.hourOfDay < 12 ? 'bg-orange-400' : 'bg-indigo-400'
                }`} />
                <span className="text-gray-700 font-medium truncate max-w-[120px]">
                  {session.gameType}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs">
                  {new Date(session.timestamp).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </span>
                <span className="font-semibold text-emerald-600 min-w-[40px] text-right">
                  {session.score.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-6">
        <button
          onClick={() => window.open('/Prep/PrepGames/GameSelection', '_blank')}
          className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
        >
          <Target className="w-5 h-5" />
          Play Brain Games
        </button>
      </div>

      {/* Tips Section */}
      {content.status !== 'complete' && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            {challengeId === 'daily-duo' && '💡 Play one game now and another later today!'}
            {challengeId === 'am-vs-pm-compare' && '💡 Compare your performance: Play once before noon and once after!'}
            {challengeId === 'consistency-quest' && '💡 Focus on steady performance rather than high scores!'}
            {challengeId === 'streak-safe' && '💡 Just one game per day keeps your streak alive!'}
          </p>
        </div>
      )}
    </div>
  )
}