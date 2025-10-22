// src/types/gameSession.ts

export interface EnhancedGameSession {
  // Core game data (keep existing structure)
  gameType: string
  score: number
  accuracy: number
  avgReactionTime: number
  totalRounds: number
  
  // Enhanced cognitive analysis fields
  sessionStart: number // Unix timestamp
  sessionEnd: number
  localClockTime: number // Hour of day [0, 24)
  domain: 'attention' | 'memory' | 'problemSolving' | 'recall' | 'creativity'
  rawPerformance: number // Main performance metric for this domain
  sessionIndex: number // 1, 2, 3... for practice effect tracking
  
  // Context data
  hoursAwake?: number
  sleepQuality?: number // 0-100 from sleep tracking
  isWeekend: boolean
  deviceType?: 'mobile' | 'desktop' | 'tablet'
  
  // Calculated fields (added during processing)
  normalizedScore?: number
  userId: string
}

export interface DomainPerformanceData {
  domain: string
  sessions: EnhancedGameSession[]
  amplitude: number // From cosinor fitting
  phase: number // Peak time in hours [0, 24)
  reliability: number // 0-0.8, confidence in the rhythm
  rSquared: number // Model fit quality
  sessionCount: number
  daysCovered: number
}

export interface CognitiveRhythmProfile {
  userId: string
  lastUpdated: number
  domainData: DomainPerformanceData[]
  overallReliability: number
  totalSessions: number
  uniqueDays: number
  
  // Fused learning curve for timeline
  fusedCurve?: Array<{
    hour: number
    readiness: number // 0-100
    confidence: number // 0-1
    dataPoints: number
  }>
}