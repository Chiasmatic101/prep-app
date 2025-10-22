import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'

export interface ChronotypeData {
  chronotype: string
  syncScore: number
  outOfSync: number
  schoolAlignment: number
  studyAlignment: number
  learningPhase: number
  lastUpdated: Date
}

export interface ChronotypeHistoryEntry {
  chronotype: string
  syncScore: number
  outOfSync: number
  schoolAlignment: number
  studyAlignment: number
  learningPhase: number
  timestamp: Date
  sleepQuality: number
  dataPoints: number
  sleepEntries: number
}

/**
 * Get current chronotype and sync score for a user
 */
export const getCurrentChronotype = async (userId: string): Promise<ChronotypeData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const data = userDoc.data()
      return {
        chronotype: data.chronotype?.chronotype || 'Unknown',
        syncScore: data.syncScore || 0,
        outOfSync: data.chronotype?.outOfSync || 0,
        schoolAlignment: data.schoolAlignment || 0,
        studyAlignment: data.studyAlignment || 0,
        learningPhase: data.learningPhase || 12,
        lastUpdated: data.lastSyncUpdate?.toDate() || new Date()
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching chronotype:', error)
    return null
  }
}

/**
 * Get chronotype history for tracking changes over time
 */
export const getChronotypeHistory = async (
  userId: string, 
  limitCount: number = 30
): Promise<ChronotypeHistoryEntry[]> => {
  try {
    const historyQuery = query(
      collection(db, 'users', userId, 'chronotypeHistory'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    
    const snapshot = await getDocs(historyQuery)
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    } as ChronotypeHistoryEntry))
  } catch (error) {
    console.error('Error fetching chronotype history:', error)
    return []
  }
}

/**
 * Calculate sync score trend (improving, stable, declining)
 */
export const getSyncScoreTrend = (history: ChronotypeHistoryEntry[]): {
  trend: 'improving' | 'stable' | 'declining'
  change: number
} => {
  if (history.length < 2) {
    return { trend: 'stable', change: 0 }
  }
  
  const recent = history.slice(0, 5)
  const older = history.slice(5, 10)
  
  if (older.length === 0) {
    return { trend: 'stable', change: 0 }
  }
  
  const recentAvg = recent.reduce((sum, entry) => sum + entry.syncScore, 0) / recent.length
  const olderAvg = older.reduce((sum, entry) => sum + entry.syncScore, 0) / older.length
  
  const change = recentAvg - olderAvg
  
  if (change > 5) return { trend: 'improving', change }
  if (change < -5) return { trend: 'declining', change }
  return { trend: 'stable', change }
}