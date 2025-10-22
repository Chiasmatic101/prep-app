// Firebase Integration for Lifestyle-Cognitive Feedback Engine
// Integrates with existing Firebase structure and data patterns
// Patch E: Multivariate feature importance (ridge-style) added to rank recommendations

import React from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { LifestyleCognitiveFeedbackEngine, type FeedbackAnalysis } from '../utils/feedbackEngine'

interface FirebaseLifestyleData {
  sleepEntries: any[]
  nutritionEntries: any[]
  activityEntries: any[]
  cognitivePerformance: any[]
  challengeData: any
  userData: any
}

export class FeedbackDataService {
  private static instance: FeedbackDataService
  private cache: Map<string, { data: FeedbackAnalysis; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

  static getInstance(): FeedbackDataService {
    if (!FeedbackDataService.instance) {
      FeedbackDataService.instance = new FeedbackDataService()
    }
    return FeedbackDataService.instance
  }

  /**
   * Main function to generate feedback analysis for a user
   * Patch E: after generating analysis, compute multivariate feature importances and
   * reorder recommendations so the highest-influence factors appear first.
   */
  async generateFeedbackAnalysis(userId: string): Promise<FeedbackAnalysis | null> {
    try {
      // Check cache first
      const cached = this.cache.get(userId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data
      }

      // Fetch all required data from Firebase
      const lifestyleData = await this.fetchAllLifestyleData(userId)

      // Check if we have enough data for meaningful analysis
      if (!this.hasMinimumDataForAnalysis(lifestyleData)) {
        return null
      }

      // Transform Firebase data to engine format
      const engineData = this.transformDataForEngine(lifestyleData)

      // Initialize and run feedback engine
      const feedbackEngine = new LifestyleCognitiveFeedbackEngine(lifestyleData.userData)
      const analysis = await feedbackEngine.analyzeFeedbackPatterns(
        engineData.lifestyleFactors,
        engineData.cognitiveOutcomes,
        lifestyleData.challengeData
      )

      // ---- Patch E: Multivariate feature importance (ridge-like) ----
      // Build daily matrices of lifestyle features X and domain outcomes y,
      // compute feature importances per domain, and derive a category weight map.
      const categoryWeights = this.computeCategoryWeights(engineData)

      // Reorder recommendations by their category's learned weight (descending)
      const sortedRecs = [...(analysis.recommendations || [])].sort((a, b) => {
        const wa = categoryWeights[a.category] ?? 0
        const wb = categoryWeights[b.category] ?? 0
        return wb - wa
      })

      const patchedAnalysis: FeedbackAnalysis = {
        ...analysis,
        // keep insights as-is; only reorder recs to surface the most impactful first
        recommendations: sortedRecs
      }

      // Cache the results
      this.cache.set(userId, { data: patchedAnalysis, timestamp: Date.now() })

      return patchedAnalysis
    } catch (error) {
      console.error('Error generating feedback analysis:', error)
      return null
    }
  }

  /**
   * Fetch all lifestyle and cognitive data from Firebase
   */
  private async fetchAllLifestyleData(userId: string): Promise<FirebaseLifestyleData> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo)

    const [
      sleepEntries,
      nutritionEntries,
      activityEntries,
      cognitivePerformance,
      challengeData,
      userData
    ] = await Promise.all([
      this.fetchSleepData(userId, thirtyDaysAgoTimestamp),
      this.fetchNutritionData(userId, thirtyDaysAgoTimestamp),
      this.fetchActivityData(userId, thirtyDaysAgoTimestamp),
      this.fetchCognitiveData(userId, thirtyDaysAgoTimestamp),
      this.fetchChallengeData(userId),
      this.fetchUserData(userId)
    ])

    return {
      sleepEntries,
      nutritionEntries,
      activityEntries,
      cognitivePerformance,
      challengeData,
      userData
    }
  }

  /**
   * Fetch sleep data from Firebase
   */
  private async fetchSleepData(userId: string, since: Timestamp): Promise<any[]> {
    try {
      const sleepQuery = query(
        collection(db, 'users', userId, 'sleepEntries'),
        orderBy('date', 'desc'),
        limit(30)
      )

      const snapshot = await getDocs(sleepQuery)
      return snapshot.docs
        .map(doc => ({
          id: doc.id,
          date: doc.id, // date is stored as document ID
          ...doc.data(),
          timestamp: this.dateStringToTimestamp(doc.id)
        }))
        .filter(entry => entry.timestamp >= since.toMillis())
    } catch (error) {
      console.error('Error fetching sleep data:', error)
      return []
    }
  }

  /**
   * Fetch nutrition data from Firebase
   */
  private async fetchNutritionData(userId: string, since: Timestamp): Promise<any[]> {
    try {
      const nutritionQuery = query(
        collection(db, 'users', userId, 'nutritionEntries'),
        where('timestamp', '>=', since),
        orderBy('timestamp', 'desc'),
        limit(100)
      )

      const snapshot = await getDocs(nutritionQuery)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toMillis() || Date.now()
      }))
    } catch (error) {
      console.error('Error fetching nutrition data:', error)
      return []
    }
  }

  /**
   * Fetch activity data from Firebase
   */
  private async fetchActivityData(userId: string, since: Timestamp): Promise<any[]> {
    try {
      const activityQuery = query(
        collection(db, 'users', userId, 'activityEntries'),
        where('timestamp', '>=', since),
        orderBy('timestamp', 'desc'),
        limit(100)
      )

      const snapshot = await getDocs(activityQuery)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toMillis() || Date.now()
      }))
    } catch (error) {
      console.error('Error fetching activity data:', error)
      return []
    }
  }

  /**
   * Fetch cognitive performance data from Firebase
   */
  private async fetchCognitiveData(userId: string, since: Timestamp): Promise<any[]> {
    try {
      // Fetch from both old format (cognitivePerformance) and new format (dailyCognitiveScores)
      const [performanceData, dailyScores] = await Promise.all([
        this.fetchCognitivePerformanceData(userId, since),
        this.fetchDailyCognitiveScores(userId)
      ])

      // Combine and deduplicate
      const allData = [...performanceData, ...dailyScores]
      return this.deduplicateCognitiveData(allData)
    } catch (error) {
      console.error('Error fetching cognitive data:', error)
      return []
    }
  }

  private async fetchCognitivePerformanceData(userId: string, since: Timestamp): Promise<any[]> {
    try {
      const cognitiveQuery = query(
        collection(db, 'users', userId, 'cognitivePerformance'),
        where('timestamp', '>=', since),
        orderBy('timestamp', 'desc'),
        limit(200)
      )

      const snapshot = await getDocs(cognitiveQuery)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toMillis() || Date.now(),
        source: 'cognitivePerformance'
      }))
    } catch (error) {
      console.error('Error fetching cognitive performance data:', error)
      return []
    }
  }

  private async fetchDailyCognitiveScores(userId: string): Promise<any[]> {
    try {
      const scoresQuery = query(
        collection(db, 'users', userId, 'dailyCognitiveScores'),
        orderBy('__name__', 'desc'),
        limit(30)
      )

      const snapshot = await getDocs(scoresQuery)
      const results: any[] = []

      snapshot.forEach(doc => {
        const date = doc.id // YYYY-MM-DD format
        const data = doc.data()

        // Convert daily scores to individual domain entries
        const domains = ['memory', 'attention', 'recall', 'problemSolving', 'creativity']
        domains.forEach(domain => {
          if (data[domain] !== undefined) {
            results.push({
              id: `${doc.id}-${domain}`,
              domain,
              score: data[domain],
              timestamp: this.dateStringToTimestamp(date),
              date,
              source: 'dailyCognitiveScores'
            })
          }
        })
      })

      return results
    } catch (error) {
      console.error('Error fetching daily cognitive scores:', error)
      return []
    }
  }

  /**
   * Fetch challenge data from Firebase
   */
  private async fetchChallengeData(userId: string): Promise<any> {
    try {
      const challengeDoc = await getDoc(doc(db, 'users', userId, 'challenges', 'shifting'))
      return challengeDoc.exists() ? challengeDoc.data() : null
    } catch (error) {
      console.error('Error fetching challenge data:', error)
      return null
    }
  }

  /**
   * Fetch user profile data from Firebase
   */
  private async fetchUserData(userId: string): Promise<any> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      return userDoc.exists() ? userDoc.data() : null
    } catch (error) {
      console.error('Error fetching user data:', error)
      return null
    }
  }

  /**
   * Transform Firebase data to the format expected by the feedback engine
   */
  private transformDataForEngine(data: FirebaseLifestyleData) {
    const lifestyleFactors: any[] = []
    const cognitiveOutcomes: any[] = []

    // Transform sleep data
    data.sleepEntries.forEach(entry => {
      lifestyleFactors.push({
        type: 'sleep',
        timestamp: entry.timestamp,
        value: {
          sleepQualityScore: entry.sleepQualityScore || 0,
          sleepDuration: entry.sleepDuration || { totalMinutes: 0 },
          bedTime: entry.bedTime,
          wakeTime: entry.wakeTime,
          wakingEvents: entry.wakingEvents || 0
        },
        metadata: {
          date: entry.date
        }
      })
    })

    // Transform nutrition data
    data.nutritionEntries.forEach(entry => {
      lifestyleFactors.push({
        type: 'nutrition',
        timestamp: entry.timestamp,
        value: {
          meals: entry.meals || [],
          hydration: entry.hydration || [],
          totalCaffeine: entry.totalCaffeine || 0,
          totalFluids: entry.totalFluids || 0,
          mealCount: entry.mealCount || 0
        },
        metadata: {
          date: entry.date
        }
      })
    })

    // Transform activity data
    data.activityEntries.forEach(entry => {
      lifestyleFactors.push({
        type: 'activity',
        timestamp: entry.timestamp,
        value: {
          type: entry.type,
          activity: entry.activity,
          duration: entry.duration,
          intensity: this.mapActivityTypeToIntensity(entry.type)
        },
        metadata: {
          date: entry.date
        }
      })
    })

    // Transform cognitive data
    data.cognitivePerformance.forEach(entry => {
      if (entry.domain && entry.score !== undefined) {
        cognitiveOutcomes.push({
          timestamp: entry.timestamp,
          domain: entry.domain,
          score: entry.score,
          sessionMetadata: {
            timeOfDay: new Date(entry.timestamp).getHours(),
            difficulty: entry.difficulty,
            duration: entry.duration
          }
        })
      }
    })

    return {
      lifestyleFactors,
      cognitiveOutcomes
    }
  }

  /**
   * Check if we have minimum data required for meaningful analysis
   */
  private hasMinimumDataForAnalysis(data: FirebaseLifestyleData): boolean {
    const minSleepEntries = 5
    const minCognitiveEntries = 10

    return (
      data.sleepEntries.length >= minSleepEntries &&
      data.cognitivePerformance.length >= minCognitiveEntries
    )
  }

  /**
   * Helper functions
   */
  private dateStringToTimestamp(dateString: string): number {
    return new Date(dateString).getTime()
  }

  private mapActivityTypeToIntensity(type: string): number {
    const intensityMap: { [key: string]: number } = {
      'Light': 1,
      'Medium': 2,
      'Intense': 3
    }
    return intensityMap[type] || 1
  }

  private deduplicateCognitiveData(data: any[]): any[] {
    const seen = new Set()
    return data.filter(item => {
      const key = `${item.domain}-${Math.floor(item.timestamp / (24 * 60 * 60 * 1000))}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * Patch E: Multivariate feature importances (ridge-style)
   * Compute daily feature matrices and derive category weights to rank recommendations.
   */
  private computeCategoryWeights(engineData: { lifestyleFactors: any[]; cognitiveOutcomes: any[] }) {
    // Build per-day aggregates
    const dayKey = (t: number) => new Date(new Date(t).toDateString()).getTime()

    type DayRow = {
      sleepQuality: number   // 0..1
      totalCaffeine: number  // normalized 0..1
      activityMinutes: number// normalized 0..1
      mealCount: number      // normalized 0..1
    }

    const dayFeatures = new Map<number, DayRow>()

    // Initialize rows
    const getRow = (ts: number) => {
      const k = dayKey(ts)
      if (!dayFeatures.has(k)) {
        dayFeatures.set(k, { sleepQuality: 0, totalCaffeine: 0, activityMinutes: 0, mealCount: 0 })
      }
      return { k, row: dayFeatures.get(k)! }
    }

    // Fill lifestyle features
    for (const lf of engineData.lifestyleFactors) {
      const { k, row } = getRow(lf.timestamp)
      if (lf.type === 'sleep') {
        const q = Number(lf.value?.sleepQualityScore ?? 0) // 0..100
        row.sleepQuality = Math.max(row.sleepQuality, q / 100)
      } else if (lf.type === 'nutrition') {
        const caf = Number(lf.value?.totalCaffeine ?? 0)   // mg/day (rough)
        const meals = Number(lf.value?.mealCount ?? 0)
        // normalize with soft caps
        row.totalCaffeine = Math.min(1, caf / 300)         // 0..1, 300mg cap
        row.mealCount = Math.min(1, meals / 4)             // 0..1, 4 meals cap
      } else if (lf.type === 'activity') {
        const mins = Number(lf.value?.duration ?? 0)
        row.activityMinutes = Math.min(1, mins / 60)       // 0..1, 60 min cap
      }
    }

    // Build daily domain scores (y per domain)
    const domainDays = new Map<string, Map<number, number[]>>() // domain -> date -> scores[]
    for (const co of engineData.cognitiveOutcomes) {
      const k = dayKey(co.timestamp)
      const d = String(co.domain || 'attention')
      if (!domainDays.has(d)) domainDays.set(d, new Map())
      const map = domainDays.get(d)!
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(Number(co.score ?? 0))
    }

    // Aggregate to means 0..1
    const domainDaily = new Map<string, Array<{ k: number; y: number; x: number[] }>>()
    const featureKeys = ['sleepQuality', 'totalCaffeine', 'activityMinutes', 'mealCount'] as const

    for (const [domain, dayMap] of domainDays.entries()) {
      const rows: Array<{ k: number; y: number; x: number[] }> = []
      for (const [k, scores] of dayMap.entries()) {
        const row = dayFeatures.get(k)
        if (!row) continue
        const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length // expected 0..100 or similar
        const y = Math.max(0, Math.min(1, meanScore / 100)) // normalize
        const x = featureKeys.map(f => row[f])
        rows.push({ k, y, x })
      }
      if (rows.length) domainDaily.set(domain, rows)
    }

    // For each domain, compute importances using ridge-ish solver and then average across domains
    const accum: number[] = [0, 0, 0, 0]
    let domainsCount = 0

    for (const [, rows] of domainDaily.entries()) {
      const X = rows.map(r => r.x)
      const y = rows.map(r => r.y)
      if (X.length && X[0]?.length) {
        const w = this.featureImportances(X, y, 0.5) // lambda=0.5
        for (let i = 0; i < accum.length; i++) accum[i] += (w[i] || 0)
        domainsCount++
      }
    }

    const avg = domainsCount ? accum.map(v => v / domainsCount) : [0, 0, 0, 0]

    // Map features -> recommendation categories
    // sleepQuality -> 'sleep'
    // totalCaffeine, mealCount -> 'nutrition'
    // activityMinutes -> 'activity'
    // (timing category weight set from nutrition & sleep proxies for now)
    const sleepW = avg[0]
    const nutritionW = avg[1] + avg[3]
    const activityW = avg[2]
    const timingW = (avg[0] + avg[1]) / 2 // proxy until explicit timing features are stored

    // Normalize to 0..1
    const sumAbs = Math.abs(sleepW) + Math.abs(nutritionW) + Math.abs(activityW) + Math.abs(timingW) || 1
    return {
      sleep: Math.abs(sleepW) / sumAbs,
      nutrition: Math.abs(nutritionW) / sumAbs,
      activity: Math.abs(activityW) / sumAbs,
      timing: Math.abs(timingW) / sumAbs
    }
  }

  /**
   * Patch E utility: tiny ridge-ish linear solver to get relative feature importances.
   * Returns weights normalized so sum(|w|) = 1 for easy comparison/ranking.
   */
  private featureImportances(X: number[][], y: number[], lambda = 0.5): number[] {
    const nFeat = X[0]?.length || 0
    if (!nFeat || X.length < nFeat) return Array(nFeat).fill(0)

    // Build X^T X and X^T y
    const XTX = Array.from({ length: nFeat }, () => Array(nFeat).fill(0))
    const XTy = Array(nFeat).fill(0)

    for (let i = 0; i < X.length; i++) {
      const row = X[i]
      for (let a = 0; a < nFeat; a++) {
        XTy[a] += row[a] * y[i]
        for (let b = 0; b < nFeat; b++) {
          XTX[a][b] += row[a] * row[b]
        }
      }
    }

    // Ridge diagonal
    for (let d = 0; d < nFeat; d++) XTX[d][d] += lambda

    // Solve (XTX | XTy) via Gauss-Jordan
    const A = XTX.map((row, i) => [...row, XTy[i]])

    for (let col = 0; col < nFeat; col++) {
      // pivot
      let piv = col
      for (let r = col + 1; r < nFeat; r++) {
        if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
      }
      const pivotVal = A[piv][col]
      if (Math.abs(pivotVal) < 1e-8) continue
      ;[A[col], A[piv]] = [A[piv], A[col]]

      const div = A[col][col]
      for (let c = col; c <= nFeat; c++) A[col][c] /= div

      // eliminate
      for (let r = 0; r < nFeat; r++) {
        if (r === col) continue
        const factor = A[r][col]
        for (let c = col; c <= nFeat; c++) A[r][c] -= factor * A[col][c]
      }
    }

    const w = A.map(row => row[nFeat] || 0)
    const s = w.reduce((acc, v) => acc + Math.abs(v), 0) || 1
    return w.map(v => v / s)
  }

  /**
   * Clear cache for a specific user (call after new data is added)
   */
  clearUserCache(userId: string): void {
    this.cache.delete(userId)
  }

  /**
   * Clear all cache (call periodically or on app restart)
   */
  clearAllCache(): void {
    this.cache.clear()
  }
}

/**
 * React Hook for using feedback analysis
 */
export function useFeedbackAnalysis(userId: string | null) {
  const [feedbackData, setFeedbackData] = React.useState<FeedbackAnalysis | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const feedbackService = FeedbackDataService.getInstance()

  const refreshFeedback = React.useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const analysis = await feedbackService.generateFeedbackAnalysis(userId)
      setFeedbackData(analysis)
    } catch (err) {
      console.error('Error loading feedback analysis:', err)
      setError(err instanceof Error ? err.message : 'Failed to load feedback analysis')
    } finally {
      setLoading(false)
    }
  }, [userId, feedbackService])

  // Auto-refresh on userId change
  React.useEffect(() => {
    refreshFeedback()
  }, [refreshFeedback])

  return {
    feedbackData,
    loading,
    error,
    refreshFeedback
  }
}
