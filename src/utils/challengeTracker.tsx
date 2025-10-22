// utils/challengeTracker.ts
import { db } from '@/firebase/config'
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore'

export const trackChallengeProgress = async (
  userId: string,
  challengeId: string,
  challengeType: string
) => {
  const today = new Date().toISOString().split('T')[0]
  
  switch (challengeType) {
    case 'shifting':
      return await trackShiftingProgress(userId, challengeId, today)
    case 'sleep-hygiene':
      return await trackSleepHygieneProgress(userId, challengeId, today)
    case 'diet-caffeine':
      return await trackDietProgress(userId, challengeId, today)
    case 'cognitive':
      return await trackCognitiveProgress(userId, challengeId, today)
    default:
      return null
  }
}

const trackShiftingProgress = async (userId: string, challengeId: string, date: string) => {
  // Get challenge progress
  const challengeDoc = await getDoc(doc(db, 'users', userId, 'challenges', 'shifting'))
  if (!challengeDoc.exists()) return null
  
  const challengeData = challengeDoc.data()
  const activeChallenge = challengeData.activeChallenges.find((c: any) => c.challengeId === challengeId)
  if (!activeChallenge) return null
  
  // Get sleep entry for today
  const sleepDoc = await getDoc(doc(db, 'users', userId, 'sleepEntries', date))
  if (!sleepDoc.exists()) return { success: false, reason: 'No sleep data for today' }
  
  const sleepData = sleepDoc.data()
  const plan = activeChallenge.plan
  const currentMilestone = plan.milestones[activeChallenge.currentDay - 1]
  
  // Check if within tolerance
  const actualTime = new Date(`2024-01-01T${sleepData.bedTime}`)
  const targetTime = new Date(`2024-01-01T${currentMilestone.targetTime}`)
  const diffMinutes = Math.abs((actualTime.getTime() - targetTime.getTime()) / (1000 * 60))
  
  const success = diffMinutes <= currentMilestone.toleranceWindow
  
  return {
    success,
    actualTime: sleepData.bedTime,
    targetTime: currentMilestone.targetTime,
    differenceMinutes: diffMinutes,
    toleranceWindow: currentMilestone.toleranceWindow
  }
}

const trackSleepHygieneProgress = async (userId: string, challengeId: string, date: string) => {
  const sleepDoc = await getDoc(doc(db, 'users', userId, 'sleepEntries', date))
  if (!sleepDoc.exists()) return { success: false, reason: 'No sleep data' }
  
  const sleepData = sleepDoc.data()
  
  // Different tracking logic based on challenge
  switch (challengeId) {
    case 'evening-dim-down':
      // Check if user logged dim-down activity
      const dimDownDoc = await getDoc(doc(db, 'users', userId, 'sleepRoutine', date))
      return {
        success: dimDownDoc.exists() && dimDownDoc.data()?.dimDownCompleted,
        details: dimDownDoc.data()
      }
      
    case 'screens-off-30':
      const screenTimeDoc = await getDoc(doc(db, 'users', userId, 'screenTime', date))
      if (!screenTimeDoc.exists()) return { success: false }
      
      const lastScreenTime = new Date(`${date}T${screenTimeDoc.data().lastScreenTime}`)
      const bedTime = new Date(`${date}T${sleepData.bedTime}`)
      const minutesDiff = (bedTime.getTime() - lastScreenTime.getTime()) / (1000 * 60)
      
      return {
        success: minutesDiff >= 30,
        minutesBeforeSleep: minutesDiff
      }
      
    default:
      return null
  }
}

const trackDietProgress = async (userId: string, challengeId: string, date: string) => {
  const nutritionDoc = await getDoc(doc(db, 'users', userId, 'nutritionEntries', date))
  if (!nutritionDoc.exists()) return { success: false, reason: 'No nutrition data' }
  
  const nutritionData = nutritionDoc.data()
  
  switch (challengeId) {
    case 'consistent-meal-windows':
      const meals = nutritionData.meals || []
      const hasBreakfast = meals.some((m: any) => m.type === 'breakfast')
      const hasLunch = meals.some((m: any) => m.type === 'lunch')
      const hasDinner = meals.some((m: any) => m.type === 'dinner')
      
      return {
        success: hasBreakfast && hasLunch && hasDinner,
        mealsLogged: [hasBreakfast, hasLunch, hasDinner].filter(Boolean).length
      }
      
    case 'early-dinner-window':
      const sleepDoc = await getDoc(doc(db, 'users', userId, 'sleepEntries', date))
      if (!sleepDoc.exists()) return { success: false }
      
      const dinner = meals.find((m: any) => m.type === 'dinner')
      if (!dinner) return { success: false }
      
      const dinnerTime = new Date(`${date}T${dinner.time}`)
      const bedTime = new Date(`${date}T${sleepDoc.data().bedTime}`)
      const hoursDiff = (bedTime.getTime() - dinnerTime.getTime()) / (1000 * 60 * 60)
      
      return {
        success: hoursDiff >= 3,
        hoursBeforeSleep: hoursDiff
      }
      
    case 'smart-caffeine-window':
      const hydration = nutritionData.hydration || []
      const caffeineIntake = hydration.filter((h: any) => 
        ['Coffee', 'Tea', 'Energy Drink'].includes(h.type)
      )
      
      if (caffeineIntake.length === 0) return { success: true, noCaffeine: true }
      
      const latestCaffeine = caffeineIntake[caffeineIntake.length - 1]
      const caffeineTime = new Date(`${date}T${latestCaffeine.time}`)
      const cutoffTime = new Date(`${date}T14:00:00`) // 2 PM cutoff
      
      return {
        success: caffeineTime <= cutoffTime,
        lastCaffeineTime: latestCaffeine.time,
        withinWindow: caffeineTime <= cutoffTime
      }
      
    default:
      return null
  }
}

const trackCognitiveProgress = async (userId: string, challengeId: string, date: string) => {
  const today = new Date().setHours(0, 0, 0, 0)
  const tomorrow = new Date(today + 24 * 60 * 60 * 1000)
  
  // Query all game sessions from today
  const gameCollections = [
    'brainBattleSessions',
    'memoryMatchSessions',
    'soundMatchSessions',
    'ultimateTTTSessions',
    'gameSessionsDetailed'
  ]
  
  let totalSessions = 0
  const sessionDetails = []
  
  for (const collectionName of gameCollections) {
    const q = query(
      collection(db, 'users', userId, collectionName),
      where('timestamp', '>=', today),
      where('timestamp', '<', tomorrow.getTime())
    )
    
    const snapshot = await getDocs(q)
    totalSessions += snapshot.size
    
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      sessionDetails.push({
        gameType: data.gameType,
        timestamp: data.timestamp,
        score: data.normalizedScore || data.score,
        hourOfDay: new Date(data.timestamp).getHours()
      })
    })
  }
  
  switch (challengeId) {
    case 'daily-duo':
      return {
        success: totalSessions >= 2,
        sessionsCompleted: totalSessions,
        sessions: sessionDetails
      }
      
    case 'am-vs-pm-compare':
      const amSessions = sessionDetails.filter(s => s.hourOfDay < 12)
      const pmSessions = sessionDetails.filter(s => s.hourOfDay >= 12)
      
      return {
        success: amSessions.length > 0 && pmSessions.length > 0,
        amCount: amSessions.length,
        pmCount: pmSessions.length,
        sessions: sessionDetails
      }
      
    case 'consistency-quest':
      // Need at least 1 session to track
      if (totalSessions === 0) return { success: false, reason: 'No sessions today' }
      
      // Calculate reaction time variability
      const reactionTimes = sessionDetails
        .filter(s => s.reactionTime)
        .map(s => s.reactionTime)
      
      if (reactionTimes.length < 5) {
        return { success: false, reason: 'Need more data points' }
      }
      
      const mean = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
      const variance = reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / reactionTimes.length
      const stdDev = Math.sqrt(variance)
      
      // Success if standard deviation is low (consistent performance)
      return {
        success: stdDev < mean * 0.15, // Within 15% of mean
        standardDeviation: stdDev,
        meanReactionTime: mean,
        consistency: (1 - (stdDev / mean)) * 100
      }
      
    default:
      return null
  }
}