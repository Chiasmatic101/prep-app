// components/ChallengeOverviewDashboard.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Calendar, Star, Award, Target } from 'lucide-react'

interface ChallengeOverviewProps {
  challengeData: any
  userId: string
}

export const ChallengeOverviewDashboard: React.FC<ChallengeOverviewProps> = ({
  challengeData,
  userId
}) => {
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalPoints: 0,
    currentStreak: 0,
    categoriesCompleted: {
      shifting: 0,
      sleepHygiene: 0,
      cognitive: 0,
      dietCaffeine: 0
    }
  })

  useEffect(() => {
    calculateStats()
  }, [challengeData])

  const calculateStats = () => {
    const completed = challengeData.completedChallenges?.length || 0
    const points = challengeData.totalPoints || 0
    
    // Calculate current streak (consecutive days with challenge activity)
    let streak = 0
    const today = new Date().setHours(0, 0, 0, 0)
    
    // This is simplified - you'd want to check actual daily progress
 if (challengeData.activeChallenges?.length > 0) {
  const streakValues = Object.values(challengeData.streaks || {}).filter((v): v is number => typeof v === 'number')
  streak = streakValues.length > 0 ? Math.max(...streakValues) : 0
}

    // Count by category
    const categories = {
      shifting: 0,
      sleepHygiene: 0,
      cognitive: 0,
      dietCaffeine: 0
    }

    challengeData.completedChallenges?.forEach((challenge: any) => {
      if (['fifteen-minute-shift', 'wake-time-anchor', 'weekend-drift-guard', 'see-the-light'].includes(challenge.challengeId)) {
        categories.shifting++
      } else if (['evening-dim-down', 'bedroom-reset', 'screens-off-30', 'soundscape-snooze', 'late-night-snack-smart', 'consistent-pre-sleep-routine'].includes(challenge.challengeId)) {
        categories.sleepHygiene++
      } else if (['daily-duo', 'am-vs-pm-compare', 'consistency-quest', 'memory-ladder', 'attention-uptick', 'streak-safe'].includes(challenge.challengeId)) {
        categories.cognitive++
      } else if (['consistent-meal-windows', 'early-dinner-window', 'smart-caffeine-window', 'study-snack-swap', 'hydration-habit'].includes(challenge.challengeId)) {
        categories.dietCaffeine++
      }
    })

    setStats({
      totalCompleted: completed,
      totalPoints: points,
      currentStreak: streak,
      categoriesCompleted: categories
    })
  }

  const achievements = [
    { 
      id: 'first-challenge', 
      title: 'First Steps', 
      description: 'Complete your first challenge',
      unlocked: stats.totalCompleted >= 1,
      icon: '🎯'
    },
    { 
      id: 'point-master', 
      title: 'Point Master', 
      description: 'Earn 500 points',
      unlocked: stats.totalPoints >= 500,
      icon: '💎'
    },
    { 
      id: 'week-warrior', 
      title: 'Week Warrior', 
      description: 'Maintain a 7-day streak',
      unlocked: stats.currentStreak >= 7,
      icon: '🔥'
    },
    { 
      id: 'category-expert', 
      title: 'Category Expert', 
      description: 'Complete 3 challenges in one category',
      unlocked: Object.values(stats.categoriesCompleted).some(count => count >= 3),
      icon: '⭐'
    },
    { 
      id: 'challenger', 
      title: 'The Challenger', 
      description: 'Complete 10 total challenges',
      unlocked: stats.totalCompleted >= 10,
      icon: '🏆'
    }
  ]

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-4 text-white"
        >
          <Trophy className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{stats.totalCompleted}</div>
          <div className="text-sm opacity-90">Completed</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 text-white"
        >
          <Star className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{stats.totalPoints}</div>
          <div className="text-sm opacity-90">Total Points</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 text-white"
        >
          <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{stats.currentStreak}</div>
          <div className="text-sm opacity-90">Day Streak</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white"
        >
          <Calendar className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{challengeData.activeChallenges?.length || 0}</div>
          <div className="text-sm opacity-90">Active Now</div>
        </motion.div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Challenges by Category
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.categoriesCompleted.shifting}</div>
            <div className="text-sm text-gray-600">Shifting</div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-indigo-700">{stats.categoriesCompleted.sleepHygiene}</div>
            <div className="text-sm text-gray-600">Sleep Hygiene</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-emerald-700">{stats.categoriesCompleted.cognitive}</div>
            <div className="text-sm text-gray-600">Cognitive</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-700">{stats.categoriesCompleted.dietCaffeine}</div>
            <div className="text-sm text-gray-600">Diet & Caffeine</div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Achievements
          </h3>
          <span className="text-sm text-gray-600">
            {unlockedCount}/{achievements.length} unlocked
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border-2 transition-all ${
                achievement.unlocked
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{achievement.title}</div>
                  <div className="text-sm text-gray-600">{achievement.description}</div>
                  {achievement.unlocked && (
                    <div className="text-xs text-yellow-700 mt-1 font-medium">✓ Unlocked!</div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Progress Insights */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Your Progress Insights</h3>
        <div className="space-y-3">
          {stats.totalCompleted === 0 ? (
            <p className="text-gray-700">
              🎯 Start your first challenge to begin tracking your progress!
            </p>
          ) : (
            <>
              <p className="text-gray-700">
                🎉 You've completed <span className="font-bold text-purple-700">{stats.totalCompleted}</span> challenge{stats.totalCompleted !== 1 ? 's' : ''}!
              </p>
              
              {stats.currentStreak >= 3 && (
                <p className="text-gray-700">
                  🔥 Amazing! You're on a <span className="font-bold text-orange-600">{stats.currentStreak}-day streak</span>. Keep it going!
                </p>
              )}

              {stats.totalPoints >= 100 && (
                <p className="text-gray-700">
                  💎 You've earned <span className="font-bold text-blue-700">{stats.totalPoints} points</span> - great dedication!
                </p>
              )}

              {Object.values(stats.categoriesCompleted).filter(count => count > 0).length >= 3 && (
                <p className="text-gray-700">
                  🌟 You're exploring multiple categories - excellent balanced approach!
                </p>
              )}

              {challengeData.activeChallenges?.length > 2 && (
                <p className="text-gray-700">
                  ⚠️ You have {challengeData.activeChallenges.length} active challenges. Consider focusing on 1-2 at a time for better results.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
