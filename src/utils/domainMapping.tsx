// src/utils/domainMapping.ts
import { EnhancedGameSession } from '@/types/gameSession'

// Map game types to cognitive domains
export const GAME_DOMAIN_MAP: Record<string, string> = {
  'colorQuick': 'attention',
  'reactionTime': 'attention',
  'memorySequence': 'memory',
  'memoryTest': 'memory',
  'longTermMemory': 'recall',
  'patternMemory': 'recall',
  'colorSort': 'problemSolving',
  'survivalGame': 'creativity',
  'colorRunner': 'problemSolving',
  'racingReaction': 'attention'
}

// Extract primary performance metric for each game type
export const extractRawPerformance = (gameType: string, sessionData: any): number => {
  switch (gameType) {
    case 'colorQuick':
      // For attention games: composite of speed and accuracy
      if (sessionData.accuracy && sessionData.avgReactionTime) {
        return (1000 / sessionData.avgReactionTime) * (sessionData.accuracy / 100)
      }
      return sessionData.score || 0
    
    case 'reactionTime':
    case 'racingReaction':
      // Speed games: inverse reaction time
      return sessionData.avgReactionTime ? (1000 / sessionData.avgReactionTime) : 0
    
    case 'memorySequence':
    case 'memoryTest':
      // Memory games: accuracy
      return sessionData.accuracy || 0
    
    case 'longTermMemory':
    case 'patternMemory':
      // Recall games: accuracy
      return sessionData.accuracy || (sessionData.correctAnswers / sessionData.totalRounds * 100) || 0
    
    case 'colorSort':
      // Problem solving: efficiency (accuracy per unit time)
      if (sessionData.accuracy && sessionData.totalGameDuration) {
        return (sessionData.accuracy * 1000) / sessionData.totalGameDuration
      }
      return sessionData.accuracy || 0
    
    case 'survivalGame':
      // Creativity: exploration or survival score
      return sessionData.explorationScore || sessionData.score || 0
    
    default:
      return sessionData.score || 0
  }
}

// Convert session data to enhanced format
export const convertToEnhancedSession = (
  userId: string,
  gameType: string,
  sessionData: any,
  sessionIndex: number,
  contextualData?: {
    sleepQuality?: number
    hoursAwake?: number
  }
): EnhancedGameSession => {
  const sessionStart = sessionData.timestamp || Date.now()
  const sessionEnd = sessionStart + (sessionData.totalGameDuration || 0)
  const localClockTime = (new Date(sessionStart).getHours()) + 
                        (new Date(sessionStart).getMinutes() / 60)
  
  return {
    // Core game data
    gameType,
    score: sessionData.score || 0,
    accuracy: sessionData.accuracy || 0,
    avgReactionTime: sessionData.avgReactionTime || 0,
    totalRounds: sessionData.totalRounds || 0,
    
    // Enhanced fields
    sessionStart,
    sessionEnd,
    localClockTime,
    domain: GAME_DOMAIN_MAP[gameType] as any || 'attention',
    rawPerformance: extractRawPerformance(gameType, sessionData),
    sessionIndex,
    userId,
    
    // Context data
    hoursAwake: contextualData?.hoursAwake,
    sleepQuality: contextualData?.sleepQuality,
    isWeekend: [0, 6].includes(new Date(sessionStart).getDay()),
    deviceType: detectDeviceType()
  }
}

// Helper function to detect device type
const detectDeviceType = (): 'mobile' | 'desktop' | 'tablet' => {
  if (typeof window === 'undefined') return 'desktop'
  
  const userAgent = navigator.userAgent
  if (/tablet|ipad/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}