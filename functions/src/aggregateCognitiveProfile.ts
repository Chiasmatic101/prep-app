// functions/src/aggregateCognitiveProfile.ts

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import cors from 'cors';

import {
  UnifiedCognitiveProfile,
  DomainScore,
  GameContribution,
  TrendData,
  DataQualityMetrics,
  DomainConfig
} from './types/cognitiveProfile';

const db = admin.firestore();
const corsHandler = cors({ origin: true });

// ============================================================================
// DOMAIN MAPPINGS - Define how games contribute to cognitive domains
// ============================================================================

const DOMAIN_MAPPINGS: { [domain: string]: DomainConfig[] } = {
  memory: [
    { game: 'memoryMatchSessions', metric: 'performance.accuracy', weight: 0.3 },
    { game: 'soundMatchSessions', metric: 'performance.accuracy', weight: 0.2 },
    { game: 'patternMemoryGame', metric: 'cognitiveMetrics.visualMemorySpan', weight: 0.3, normalize: [0, 12] },
    { game: 'memoryTest', metric: 'performance.quizAccuracy', weight: 0.2 }
  ],
  
  attention: [
    { game: 'colorQuickGame', metric: 'stroopDetails.stroopEffect', weight: 0.35, inverse: true, normalize: [0, 1000] },
    { game: 'reactionTimeGame', metric: 'performance.averageReactionTime', weight: 0.25, inverse: true, normalize: [200, 1000] },
    { game: 'colorRunnerGame', metric: 'cognitiveMetrics.attentionalFlexibility', weight: 0.25 },
    { game: 'brainBattleSessions', metric: 'attention.focusScore', weight: 0.15 }
  ],
  
  recall: [
    { game: 'patternMemoryGame', metric: 'performance.accuracy', weight: 0.4 },
    { game: 'memoryTest', metric: 'performance.quizAccuracy', weight: 0.3 },
    { game: 'memoryMatchSessions', metric: 'performance.accuracy', weight: 0.3 }
  ],
  
  executiveFunction: [
    { game: 'ultimateTTTSessions', metric: 'executiveFunction.strategicConsistency', weight: 0.35 },
    { game: 'ultimateTTTSessions', metric: 'executiveFunction.planningDepth', weight: 0.25, normalize: [0, 10] },
    { game: 'colorSortSessions', metric: 'cognitive.planningPauses', weight: 0.25, inverse: true, normalize: [0, 10] },
    { game: 'brainBattleSessions', metric: 'executiveFunction.planningScore', weight: 0.15 }
  ],
  
  inhibitionControl: [
    { game: 'ultimateTTTSessions', metric: 'inhibitionControl.inhibitionScore', weight: 0.5 },
    { game: 'colorRunnerGame', metric: 'cognitiveMetrics.impulseControl', weight: 0.3 },
    { game: 'colorQuickGame', metric: 'inhibitionControl.accuracy', weight: 0.2 }
  ],
  
  cognitiveFlexibility: [
    { game: 'ultimateTTTSessions', metric: 'cognitiveFlexibility.adaptationEfficiency', weight: 0.4 },
    { game: 'colorSortSessions', metric: 'cognitive.focusChanges', weight: 0.3, normalize: [0, 20] },
    { game: 'colorRunnerGame', metric: 'cognitiveMetrics.adaptationSpeed', weight: 0.2 },
    { game: 'brainBattleSessions', metric: 'flexibility.switchingCost', weight: 0.1, inverse: true, normalize: [0, 500] }
  ],
  
  problemSolving: [
    { game: 'colorSortSessions', metric: 'cognitive.planningPauses', weight: 0.3, inverse: true, normalize: [0, 10] },
    { game: 'colorSortSessions', metric: 'performance.efficiency', weight: 0.3 },
    { game: 'ultimateTTTSessions', metric: 'decisionMaking.decisionQuality', weight: 0.25 },
    { game: 'colorRunnerGame', metric: 'cognitiveMetrics.adaptationSpeed', weight: 0.15 }
  ],
  
  workingMemory: [
    { game: 'ultimateTTTSessions', metric: 'workingMemory.memoryEfficiency', weight: 0.4 },
    { game: 'ultimateTTTSessions', metric: 'workingMemory.maxMemoryLoad', weight: 0.25, normalize: [0, 30] },
    { game: 'colorSortSessions', metric: 'cognitive.avgCognitiveLoad', weight: 0.2 },
    { game: 'brainBattleSessions', metric: 'workingMemory.capacity', weight: 0.15, normalize: [0, 10] }
  ],
  
  creativity: [
    { game: 'colorRunnerGame', metric: 'cognitiveMetrics.riskTaking', weight: 0.4 },
    { game: 'survivalGame', metric: 'explorationScore', weight: 0.3 },
    { game: 'colorSortSessions', metric: 'cognitive.focusChanges', weight: 0.2, normalize: [0, 20] },
    { game: 'brainBattleSessions', metric: 'creativity.noveltyScore', weight: 0.1 }
  ]
};

// Game collection names - add new games here
const GAME_COLLECTIONS = [
  'ultimateTTTSessions',
  'colorSortSessions',
  'memoryMatchSessions',
  'soundMatchSessions',
  'brainBattleSessions',
  'nutritionEntries',
  'patternMemoryGame',
  'memoryTest',
  'colorQuickGame',
  'reactionTimeGame',
  'colorRunnerGame',
  'survivalGame'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract nested metric value from object using dot notation
 */
const getNestedValue = (obj: any, path: string): number => {
  try {
    const value = path.split('.').reduce((curr, prop) => {
      if (curr === null || curr === undefined) return 0;
      return curr[prop];
    }, obj);
    
    // Handle percentage strings like "85.5%"
    if (typeof value === 'string' && value.endsWith('%')) {
      return parseFloat(value.replace('%', ''));
    }
    
    return typeof value === 'number' ? value : 0;
  } catch (error) {
    return 0;
  }
};

/**
 * Normalize value to 0-100 scale
 */
const normalize = (val: number, min: number, max: number): number => {
  if (max === min) return 50; // neutral
  const normalized = ((val - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, normalized));
};

/**
 * Inverse normalize (lower is better)
 */
const inverseNormalize = (val: number, min: number, max: number): number => {
  if (max === min) return 50; // neutral
  const normalized = (1 - (val - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, normalized));
};

/**
 * Calculate standard deviation
 */
const calculateStdDev = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};

/**
 * Calculate coefficient of variation (consistency metric)
 */
const calculateCV = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg === 0) return 0;
  const stdDev = calculateStdDev(values);
  return (stdDev / avg);
};

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch sessions from a specific game collection within a time window
 */
const fetchGameSessions = async (
  userId: string, 
  gameCollection: string, 
  daysBack: number = 30
): Promise<any[]> => {
  const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
  
  try {
    const snapshot = await db
      .collection(`users/${userId}/${gameCollection}`)
      .where('createdAt', '>=', new Date(cutoffTime))
      .orderBy('createdAt', 'desc')
      .limit(100) // Limit to prevent excessive reads
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.log(`No sessions found for ${gameCollection}:`, error);
    return [];
  }
};

/**
 * Fetch all game sessions for a user
 */
const fetchAllGameSessions = async (
  userId: string,
  daysBack: number = 30
): Promise<{ [game: string]: any[] }> => {
  const allSessions: { [game: string]: any[] } = {};
  
  const fetchPromises = GAME_COLLECTIONS.map(async (collection) => {
    const sessions = await fetchGameSessions(userId, collection, daysBack);
    allSessions[collection] = sessions;
  });
  
  await Promise.all(fetchPromises);
  return allSessions;
};

/**
 * Fetch previous cognitive profile for trend calculation
 */
const fetchPreviousProfile = async (userId: string): Promise<UnifiedCognitiveProfile | null> => {
  try {
    const snapshot = await db.doc(`users/${userId}/cognitiveProfile/current`).get();
    return snapshot.exists ? snapshot.data() as UnifiedCognitiveProfile : null;
  } catch (error) {
    return null;
  }
};

// ============================================================================
// DOMAIN SCORE CALCULATION
// ============================================================================

/**
 * Calculate a single domain score from multiple game sources
 */
const calculateDomainScore = async (
  userId: string,
  domain: string,
  domainConfig: DomainConfig[],
  allGameSessions: { [game: string]: any[] },
  timeWindow: '7d' | '30d' | 'current'
): Promise<DomainScore | number> => {
  let totalWeight = 0;
  let weightedSum = 0;
  const contributions: GameContribution[] = [];
  const allScores: number[] = [];

  // Filter sessions based on time window
  const filterByTimeWindow = (sessions: any[]) => {
    const now = Date.now();
    const cutoff = timeWindow === '7d' ? 7 * 24 * 60 * 60 * 1000 : 
                   timeWindow === '30d' ? 30 * 24 * 60 * 60 * 1000 : 
                   Infinity;
    
    return sessions.filter(s => {
      const timestamp = s.createdAt?.toMillis?.() || s.sessionOverview?.sessionStart || 0;
      return (now - timestamp) <= cutoff;
    });
  };

  for (const config of domainConfig) {
    const allSessionsForGame = allGameSessions[config.game] || [];
    const sessions = filterByTimeWindow(allSessionsForGame);
    
    if (sessions.length === 0) continue;

    // Extract metric values from sessions
    const values = sessions
      .map(s => getNestedValue(s, config.metric))
      .filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);

    if (values.length === 0) continue;

    // Calculate average
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Calculate consistency (lower CV = more consistent)
    const consistency = Math.max(0, 100 - (calculateCV(values) * 100));

    // Normalize if specified
    let normalizedValue = avgValue;
    if (config.normalize) {
      const [min, max] = config.normalize;
      normalizedValue = config.inverse 
        ? inverseNormalize(avgValue, min, max)
        : normalize(avgValue, min, max);
    } else if (config.inverse) {
      // If inverse but no normalization range, assume percentage
      normalizedValue = 100 - avgValue;
    }

    // Apply weight and add to sum
    const contribution = normalizedValue * config.weight;
    weightedSum += contribution;
    totalWeight += config.weight;
    allScores.push(normalizedValue);

    // Track contribution for transparency
    if (timeWindow === 'current') {
      contributions.push({
        gameType: config.game,
        weight: config.weight,
        lastUpdated: Date.now(),
        sessionCount: values.length,
        avgScore: Math.round(normalizedValue),
        reliability: config.reliability || consistency / 100
      });
    }
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  
  // Calculate confidence based on sample size and consistency
  const sampleSize = allScores.length;
  const sampleConfidence = Math.min(1, sampleSize / 10); // Full confidence at 10+ samples
  const consistencyScore = allScores.length > 1 ? (100 - calculateStdDev(allScores)) / 100 : 0.5;
  const confidence = (sampleConfidence * 0.6 + consistencyScore * 0.4);

  if (timeWindow === 'current') {
    return {
      current: finalScore,
      average7d: 0, // Will be filled separately
      average30d: 0, // Will be filled separately
      personalBest: finalScore,
      personalBestDate: Date.now(),
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }
  
  return finalScore;
};

/**
 * Calculate all domain scores with time windows
 */
const calculateAllDomainScores = async (
  userId: string,
  allGameSessions: { [game: string]: any[] }
): Promise<UnifiedCognitiveProfile['domains']> => {
  const domainScores: any = {};

  for (const [domain, config] of Object.entries(DOMAIN_MAPPINGS)) {
    // Calculate current, 7d, and 30d scores
    const currentScore = await calculateDomainScore(userId, domain, config, allGameSessions, 'current') as DomainScore;
    const score7d = await calculateDomainScore(userId, domain, config, allGameSessions, '7d') as number;
    const score30d = await calculateDomainScore(userId, domain, config, allGameSessions, '30d') as number;
    
    currentScore.average7d = score7d;
    currentScore.average30d = score30d;
    
    // Get personal best from previous profile
    const prevProfile = await fetchPreviousProfile(userId);
    if (prevProfile?.domains?.[domain]) {
      const prevBest = prevProfile.domains[domain].personalBest || 0;
      const prevBestDate = prevProfile.domains[domain].personalBestDate || Date.now();
      
      if (currentScore.current > prevBest) {
        currentScore.personalBest = currentScore.current;
        currentScore.personalBestDate = Date.now();
      } else {
        currentScore.personalBest = prevBest;
        currentScore.personalBestDate = prevBestDate;
      }
    }
    
    domainScores[domain] = currentScore;
  }

  return domainScores as UnifiedCognitiveProfile['domains'];
};

/**
 * Calculate trends for all domains
 */
const calculateTrends = async (
  userId: string,
  currentDomains: { [domain: string]: DomainScore },
  allGameSessions: { [game: string]: any[] }
): Promise<UnifiedCognitiveProfile['trends']> => {
  const trends: any = {};
  const prevProfile = await fetchPreviousProfile(userId);

  for (const domain of Object.keys(currentDomains)) {
    const current = currentDomains[domain].current;
    const avg7d = currentDomains[domain].average7d;
    const avg30d = currentDomains[domain].average30d;
    
    // Get historical data
    const prev7d = prevProfile?.domains?.[domain]?.average7d || avg7d;
    const prev30d = prevProfile?.domains?.[domain]?.average30d || avg30d;
    
    // Calculate changes
    const weeklyChange = ((avg7d - prev7d) / Math.max(prev7d, 1)) * 100;
    const monthlyChange = ((avg30d - prev30d) / Math.max(prev30d, 1)) * 100;
    const yearlyChange = monthlyChange * 12; // Extrapolated
    
    // Determine trajectory
    let trajectory: 'improving' | 'declining' | 'stable' = 'stable';
    if (weeklyChange > 5) trajectory = 'improving';
    else if (weeklyChange < -5) trajectory = 'declining';
    
    // Calculate volatility (standard deviation of recent scores)
    const recentScores = [current, avg7d, avg30d].filter(s => s > 0);
    const volatility = calculateStdDev(recentScores);
    
    // Consistency score (inverse of volatility)
    const consistencyScore = Math.max(0, 100 - volatility);
    
    // Momentum (rate of change)
    const momentum = weeklyChange - monthlyChange;
    
    trends[domain] = {
      weeklyChange: Math.round(weeklyChange * 10) / 10,
      monthlyChange: Math.round(monthlyChange * 10) / 10,
      yearlyChange: Math.round(yearlyChange * 10) / 10,
      trajectory,
      volatility: Math.round(volatility * 10) / 10,
      consistencyScore: Math.round(consistencyScore),
      momentum: Math.round(momentum * 10) / 10
    };
  }

  return trends as UnifiedCognitiveProfile['trends'];

};

// ============================================================================
// PERCENTILE CALCULATION
// ============================================================================

/**
 * Calculate user percentiles compared to all users
 */
const calculatePercentiles = async (
  userId: string,
  currentDomains: { [domain: string]: DomainScore }
): Promise<UnifiedCognitiveProfile['percentiles']> => {
  const percentiles: any = {};

  try {
    // Fetch all users' cognitive profiles
    const allProfilesSnapshot = await db
      .collectionGroup('cognitiveProfile')
      .get();

    const allProfiles = allProfilesSnapshot.docs
      .map(doc => doc.data())
      .filter(data => data.domains); // Only include profiles with domain data

    for (const domain of Object.keys(currentDomains)) {
      const userScore = currentDomains[domain].current;
      
      // Extract all scores for this domain
      const allScores = allProfiles
        .map(profile => profile.domains?.[domain]?.current || 0)
        .filter(score => score > 0)
        .sort((a, b) => a - b);

      if (allScores.length === 0) {
        percentiles[domain] = 50; // Default to median if no data
        continue;
      }

      // Calculate percentile
      const rank = allScores.filter(score => score < userScore).length;
      percentiles[domain] = Math.round((rank / allScores.length) * 100);
    }
  } catch (error) {
    console.error('Error calculating percentiles:', error);
    // Default all to 50th percentile on error
    for (const domain of Object.keys(currentDomains)) {
      percentiles[domain] = 50;
    }
  }

  return percentiles as UnifiedCognitiveProfile['percentiles'];
};

// ============================================================================
// PEAK PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Analyze peak performance patterns
 */
const analyzePeakPerformance = async (
  userId: string,
  allGameSessions: { [game: string]: any[] }
): Promise<UnifiedCognitiveProfile['peakPerformance']> => {
  const allSessions = Object.values(allGameSessions).flat();
  
  if (allSessions.length === 0) {
    return {
      bestTimeOfDay: 10, // Default to 10 AM
      bestDayOfWeek: 2, // Default to Tuesday
      optimalSessionDuration: 30,
      fatigueThreshold: 5
    };
  }

  // Analyze time of day performance
  const hourlyPerformance: { [hour: number]: number[] } = {};
  const dailyPerformance: { [day: number]: number[] } = {};
  const sessionDurations: number[] = [];
  
  allSessions.forEach(session => {
    const timestamp = session.createdAt?.toMillis?.() || session.sessionOverview?.sessionStart || 0;
    if (!timestamp) return;
    
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    // Extract performance score (game-specific)
    let performanceScore = 0;
    if (session.performance?.accuracy) performanceScore = session.performance.accuracy;
    else if (session.performance?.winRate) performanceScore = session.performance.winRate;
    else if (session.cognitiveMetrics?.overallScore) performanceScore = session.cognitiveMetrics.overallScore;
    
    if (performanceScore > 0) {
      if (!hourlyPerformance[hour]) hourlyPerformance[hour] = [];
      hourlyPerformance[hour].push(performanceScore);
      
      if (!dailyPerformance[day]) dailyPerformance[day] = [];
      dailyPerformance[day].push(performanceScore);
    }
    
    // Track session duration
    const duration = session.sessionOverview?.totalSessionDuration || 0;
    if (duration > 0) sessionDurations.push(duration / 60000); // Convert to minutes
  });

  // Find best time of day
  let bestHour = 10;
  let bestHourScore = 0;
  for (const [hour, scores] of Object.entries(hourlyPerformance)) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avgScore > bestHourScore) {
      bestHourScore = avgScore;
      bestHour = parseInt(hour);
    }
  }

  // Find best day of week
  let bestDay = 2;
  let bestDayScore = 0;
  for (const [day, scores] of Object.entries(dailyPerformance)) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avgScore > bestDayScore) {
      bestDayScore = avgScore;
      bestDay = parseInt(day);
    }
  }

  // Calculate optimal session duration (median)
  sessionDurations.sort((a, b) => a - b);
  const optimalDuration = sessionDurations.length > 0 
    ? sessionDurations[Math.floor(sessionDurations.length / 2)]
    : 30;

  // Estimate fatigue threshold (sessions before performance drops)
  const fatigueThreshold = Math.min(10, Math.max(3, Math.floor(allSessions.length / 5)));

  return {
    bestTimeOfDay: bestHour + (Math.random() * 0.99), // Add fractional part
    bestDayOfWeek: bestDay,
    optimalSessionDuration: Math.round(optimalDuration),
    fatigueThreshold
  };
};

// ============================================================================
// DATA QUALITY ASSESSMENT
// ============================================================================

/**
 * Assess data quality
 */
const assessDataQuality = (
  allGameSessions: { [game: string]: any[] },
  currentDomains: { [domain: string]: DomainScore }
): DataQualityMetrics => {
  const allSessions = Object.values(allGameSessions).flat();
  const sampleSize = allSessions.length;
  
  // Calculate recency (days since last session)
  const timestamps = allSessions
    .map(s => s.createdAt?.toMillis?.() || s.sessionOverview?.sessionStart || 0)
    .filter(t => t > 0);
  
  const mostRecent = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  const recency = Math.floor((Date.now() - mostRecent) / (24 * 60 * 60 * 1000));
  
  // Calculate coverage (percentage of domains with data)
  const domainsWithData = Object.values(currentDomains).filter(d => d.current > 0).length;
  const coverage = (domainsWithData / Object.keys(currentDomains).length) * 100;
  
  // Calculate consistency (average confidence across domains)
  const avgConfidence = Object.values(currentDomains)
    .map(d => d.confidence)
    .reduce((a, b) => a + b, 0) / domainsWithData;
  const consistency = avgConfidence * 100;
  
  // Calculate overall reliability
  const reliabilityFactors = [
    Math.min(1, sampleSize / 50), // Sample size factor
    Math.max(0, 1 - recency / 30), // Recency factor (penalize if > 30 days)
    coverage / 100, // Coverage factor
    avgConfidence // Confidence factor
  ];
  const reliability = (reliabilityFactors.reduce((a, b) => a + b, 0) / reliabilityFactors.length) * 100;
  
  return {
    sampleSize,
    recency,
    coverage: Math.round(coverage),
    consistency: Math.round(consistency),
    reliability: Math.round(reliability)
  };
};

// ============================================================================
// CROSS-GAME METRICS CALCULATION
// ============================================================================

/**
 * Calculate granular cross-game metrics
 */
const calculateCrossGameMetrics = (
  allGameSessions: { [game: string]: any[] }
): UnifiedCognitiveProfile['metrics'] => {
  const allSessions = Object.values(allGameSessions).flat();
  
  // Extract decision times across all games
  const decisionTimes: number[] = [];
  allSessions.forEach(s => {
    const dt = getNestedValue(s,'decisionMaking.averageDecisionTime') || 
             getNestedValue(s, 'cognitive.avgHesitationTime') ||
             getNestedValue(s, 'performance.averageReactionTime');
    if (dt > 0) decisionTimes.push(dt);
  });
  
  // Extract strategic consistency across all games
  const strategicScores: number[] = [];
  allSessions.forEach(s => {
    const sc = getNestedValue(s, 'executiveFunction.strategicConsistency') ||
               getNestedValue(s, 'performance.consistency') ||
               getNestedValue(s, 'cognitive.strategicMoveRatio') * 100;
    if (sc > 0) strategicScores.push(sc);
  });
  
  // Extract error rates
  const errorRates: number[] = [];
  allSessions.forEach(s => {
    const er = getNestedValue(s, 'decisionMaking.errorRate') ||
               getNestedValue(s, 'performance.errorRate') ||
               (100 - (getNestedValue(s, 'performance.accuracy') || 0));
    if (er >= 0) errorRates.push(er);
  });
  
  // Extract adaptation speeds
  const adaptationSpeeds: number[] = [];
  allSessions.forEach(s => {
    const as = getNestedValue(s, 'cognitiveMetrics.adaptationSpeed') ||
               getNestedValue(s, 'cognitiveFlexibility.adaptationEfficiency');
    if (as > 0) adaptationSpeeds.push(as);
  });
  
  // Extract planning depths
  const planningDepths: number[] = [];
  allSessions.forEach(s => {
    const pd = getNestedValue(s, 'executiveFunction.planningDepth') ||
               getNestedValue(s, 'cognitive.planningPauses');
    if (pd > 0) planningDepths.push(pd);
  });
  
  // Extract impulse control scores
  const impulseControls: number[] = [];
  allSessions.forEach(s => {
    const ic = getNestedValue(s, 'inhibitionControl.inhibitionScore') ||
               getNestedValue(s, 'cognitiveMetrics.impulseControl');
    if (ic > 0) impulseControls.push(ic);
  });
  
  // Extract focus stability
  const focusScores: number[] = [];
  allSessions.forEach(s => {
    const fs = 100 - (getNestedValue(s, 'cognitive.focusChanges') || 0);
    if (fs > 0) focusScores.push(fs);
  });
  
  // Calculate learning rate (improvement over time)
  let learningRate = 0;
  if (allSessions.length >= 5) {
    const sortedByTime = allSessions
      .filter(s => (s.createdAt?.toMillis?.() || s.sessionOverview?.sessionStart || 0) > 0)
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || a.sessionOverview?.sessionStart || 0;
        const timeB = b.createdAt?.toMillis?.() || b.sessionOverview?.sessionStart || 0;
        return timeA - timeB;
      });
    
    const firstFive = sortedByTime.slice(0, 5);
    const lastFive = sortedByTime.slice(-5);
    
    const firstAvg = firstFive.reduce((sum, s) => {
      const score = getNestedValue(s, 'performance.accuracy') || 
                    getNestedValue(s, 'performance.winRate') || 0;
      return sum + score;
    }, 0) / firstFive.length;
    
    const lastAvg = lastFive.reduce((sum, s) => {
      const score = getNestedValue(s, 'performance.accuracy') || 
                    getNestedValue(s, 'performance.winRate') || 0;
      return sum + score;
    }, 0) / lastFive.length;
    
    learningRate = ((lastAvg - firstAvg) / Math.max(firstAvg, 1)) * 100;
  }
  
  return {
    averageDecisionTime: decisionTimes.length > 0 
      ? Math.round(decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length)
      : 0,
    strategicConsistency: strategicScores.length > 0
      ? Math.round(strategicScores.reduce((a, b) => a + b, 0) / strategicScores.length)
      : 0,
    errorRate: errorRates.length > 0
      ? Math.round(errorRates.reduce((a, b) => a + b, 0) / errorRates.length)
      : 0,
    adaptationSpeed: adaptationSpeeds.length > 0
      ? Math.round(adaptationSpeeds.reduce((a, b) => a + b, 0) / adaptationSpeeds.length)
      : 0,
    planningDepth: planningDepths.length > 0
      ? Math.round((planningDepths.reduce((a, b) => a + b, 0) / planningDepths.length) * 10) / 10
      : 0,
    impulseControl: impulseControls.length > 0
      ? Math.round(impulseControls.reduce((a, b) => a + b, 0) / impulseControls.length)
      : 0,
    focusStability: focusScores.length > 0
      ? Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length)
      : 0,
    learningRate: Math.round(learningRate * 10) / 10
  };
};

// ============================================================================
// GAME CONTRIBUTIONS TRACKING
// ============================================================================

/**
 * Build game contributions map
 */
const buildGameContributions = (
  allGameSessions: { [game: string]: any[] },
  currentDomains: { [domain: string]: DomainScore }
): UnifiedCognitiveProfile['contributions'] => {
  const contributions: UnifiedCognitiveProfile['contributions'] = {};
  
  for (const [domain, config] of Object.entries(DOMAIN_MAPPINGS)) {
    contributions[domain] = [];
    
    for (const gameConfig of config) {
      const sessions = allGameSessions[gameConfig.game] || [];
      if (sessions.length === 0) continue;
      
      // Extract values for this metric
      const values = sessions
        .map(s => getNestedValue(s, gameConfig.metric))
        .filter(v => v > 0);
      
      if (values.length === 0) continue;
      
      const avgScore = values.reduce((a, b) => a + b, 0) / values.length;
      const consistency = Math.max(0, 100 - (calculateCV(values) * 100));
      
      contributions[domain].push({
        gameType: gameConfig.game.replace('Sessions', ''),
        weight: gameConfig.weight,
        lastUpdated: Date.now(),
        sessionCount: values.length,
        avgScore: Math.round(avgScore),
        reliability: consistency / 100
      });
    }
    
    // Sort by weight (most influential first)
    contributions[domain].sort((a, b) => b.weight - a.weight);
  }
  
  return contributions;
};

// ============================================================================
// MAIN AGGREGATION FUNCTION
// ============================================================================

/**
 * Main function to aggregate cognitive profile for a user
 */
const aggregateUserCognitiveProfile = async (userId: string): Promise<UnifiedCognitiveProfile> => {
  console.log(`🧠 Aggregating cognitive profile for user: ${userId}`);
  
  // Step 1: Fetch all game sessions
  const allGameSessions = await fetchAllGameSessions(userId, 30);
  const totalSessions = Object.values(allGameSessions).flat().length;
  
  console.log(`📊 Found ${totalSessions} sessions across ${Object.keys(allGameSessions).length} games`);
  
  if (totalSessions === 0) {
    console.log(`⚠️ No sessions found for user ${userId}`);
    // Return minimal profile
    return createEmptyProfile();
  }
  
  // Step 2: Calculate domain scores
  const domains = await calculateAllDomainScores(userId, allGameSessions);
  console.log(`✅ Calculated ${Object.keys(domains).length} domain scores`);
  
  // Step 3: Calculate trends
  const trends = await calculateTrends(userId, domains, allGameSessions);
  console.log(`📈 Calculated trends for all domains`);
  
  // Step 4: Calculate percentiles
  const percentiles = await calculatePercentiles(userId, domains);
  console.log(`📊 Calculated percentiles vs all users`);
  
  // Step 5: Analyze peak performance
  const peakPerformance = await analyzePeakPerformance(userId, allGameSessions);
  console.log(`⏰ Analyzed peak performance patterns`);
  
  // Step 6: Calculate cross-game metrics
  const metrics = calculateCrossGameMetrics(allGameSessions);
  console.log(`🎯 Calculated cross-game metrics`);
  
  // Step 7: Build game contributions
  const contributions = buildGameContributions(allGameSessions, domains);
  console.log(`🎮 Built game contributions map`);
  
  // Step 8: Assess data quality
  const dataQuality = assessDataQuality(allGameSessions, domains);
  console.log(`✅ Assessed data quality: ${dataQuality.reliability}/100`);
  
  // Step 9: Calculate account age
  const allTimestamps = Object.values(allGameSessions)
    .flat()
    .map(s => s.createdAt?.toMillis?.() || s.sessionOverview?.sessionStart || 0)
    .filter(t => t > 0);
  
  const firstSession = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now();
  const accountAge = Math.floor((Date.now() - firstSession) / (24 * 60 * 60 * 1000));
  
  // Step 10: Build final profile
  const profile: UnifiedCognitiveProfile = {
    domains,
    metrics,
    contributions,
    trends,
    percentiles,
    peakPerformance,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    totalSessions,
    totalGamesPlayed: Object.keys(allGameSessions).filter(g => allGameSessions[g].length > 0).length,
    accountAge,
    dataQuality
  };
  
  console.log(`✅ Profile aggregation complete for user ${userId}`);
  return profile;
};

/**
 * Create empty profile for users with no data
 */
const createEmptyProfile = (): UnifiedCognitiveProfile => {
  const emptyDomainScore: DomainScore = {
    current: 0,
    average7d: 0,
    average30d: 0,
    personalBest: 0,
    personalBestDate: Date.now(),
    confidence: 0
  };
  
  const emptyTrend: TrendData = {
    weeklyChange: 0,
    monthlyChange: 0,
    yearlyChange: 0,
    trajectory: 'stable',
    volatility: 0,
    consistencyScore: 0,
    momentum: 0
  };
  
  return {
    domains: {
      memory: { ...emptyDomainScore },
      attention: { ...emptyDomainScore },
      recall: { ...emptyDomainScore },
      problemSolving: { ...emptyDomainScore },
      creativity: { ...emptyDomainScore },
      executiveFunction: { ...emptyDomainScore },
      inhibitionControl: { ...emptyDomainScore },
      cognitiveFlexibility: { ...emptyDomainScore },
      workingMemory: { ...emptyDomainScore }
    },
    metrics: {
      averageDecisionTime: 0,
      strategicConsistency: 0,
      errorRate: 0,
      adaptationSpeed: 0,
      planningDepth: 0,
      impulseControl: 0,
      focusStability: 0,
      learningRate: 0
    },
    contributions: {},
    trends: {
      memory: { ...emptyTrend },
      attention: { ...emptyTrend },
      recall: { ...emptyTrend },
      problemSolving: { ...emptyTrend },
      creativity: { ...emptyTrend },
      executiveFunction: { ...emptyTrend },
      inhibitionControl: { ...emptyTrend },
      cognitiveFlexibility: { ...emptyTrend },
      workingMemory: { ...emptyTrend }
    },
    percentiles: {
      memory: 50,
      attention: 50,
      recall: 50,
      problemSolving: 50,
      creativity: 50,
      executiveFunction: 50,
      inhibitionControl: 50,
      cognitiveFlexibility: 50,
      workingMemory: 50
    },
    peakPerformance: {
      bestTimeOfDay: 10,
      bestDayOfWeek: 2,
      optimalSessionDuration: 30,
      fatigueThreshold: 5
    },
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    totalSessions: 0,
    totalGamesPlayed: 0,
    accountAge: 0,
    dataQuality: {
      sampleSize: 0,
      recency: 999,
      coverage: 0,
      consistency: 0,
      reliability: 0
    }
  };
};

// ============================================================================
// CLOUD FUNCTIONS
// ============================================================================

/**
 * Scheduled function: Run every 6 hours to update all users
 */
export const aggregateCognitiveProfiles = functions.pubsub
  .schedule('every 6 hours')
  .timeZone('UTC')
  .onRun(async () => {
    console.log('🚀 Starting scheduled cognitive profile aggregation');
    
    try {
      const usersSnapshot = await db.collection('users').get();
      console.log(`👥 Found ${usersSnapshot.size} users to process`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        try {
          const profile = await aggregateUserCognitiveProfile(userId);
          
          await db.doc(`users/${userId}/cognitiveProfile/current`).set(profile, { merge: true });
          
          successCount++;
          console.log(`✅ [${successCount}/${usersSnapshot.size}] Updated profile for ${userId}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing user ${userId}:`, error);
        }
      }
      
      console.log(`🎉 Aggregation complete: ${successCount} successful, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Fatal error in scheduled aggregation:', error);
    }
  });

/**
 * HTTP endpoint: Test aggregation for a specific user
 */
export const testCognitiveAggregation = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ 
        error: 'Missing userId parameter',
        usage: '/testCognitiveAggregation?userId=YOUR_USER_ID'
      });
      return;
    }

    try {
      console.log(`🧪 Testing aggregation for user: ${userId}`);
      
      const profile = await aggregateUserCognitiveProfile(userId);
      
      await db.doc(`users/${userId}/cognitiveProfile/current`).set(profile, { merge: true });
      
      res.status(200).json({
        success: true,
        message: `✅ Profile aggregated and saved for user: ${userId}`,
        profile: {
          domains: profile.domains,
          metrics: profile.metrics,
          dataQuality: profile.dataQuality,
          totalSessions: profile.totalSessions,
          totalGamesPlayed: profile.totalGamesPlayed
        }
      });
    } catch (error) {
      console.error('❌ Error in test aggregation:', error);
      res.status(500).json({
        error: 'Failed to aggregate cognitive profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

/**
 * HTTP endpoint: Get user's cognitive profile
 */
export const getCognitiveProfile = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ 
        error: 'Missing userId parameter',
        usage: '/getCognitiveProfile?userId=YOUR_USER_ID'
      });
      return;
    }

    try {
      const profileDoc = await db.doc(`users/${userId}/cognitiveProfile/current`).get();
      
      if (!profileDoc.exists) {
        res.status(404).json({
          error: 'No cognitive profile found for this user',
          suggestion: 'Run testCognitiveAggregation first to generate profile'
        });
        return;
      }
      
      const profile = profileDoc.data();
      
      res.status(200).json({
        success: true,
        profile
      });
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      res.status(500).json({
        error: 'Failed to fetch cognitive profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

/**
 * HTTP endpoint: Get leaderboard for a specific domain
 */
export const getDomainLeaderboard = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const domain = req.query.domain as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!domain) {
      res.status(400).json({ 
        error: 'Missing domain parameter',
        usage: '/getDomainLeaderboard?domain=memory&limit=10',
        validDomains: Object.keys(DOMAIN_MAPPINGS)
      });
      return;
    }
    
    if (!DOMAIN_MAPPINGS[domain]) {
      res.status(400).json({
        error: `Invalid domain: ${domain}`,
        validDomains: Object.keys(DOMAIN_MAPPINGS)
      });
      return;
    }

    try {
      const allProfilesSnapshot = await db
        .collectionGroup('cognitiveProfile')
        .get();
      
      const leaderboard = allProfilesSnapshot.docs
        .map(doc => ({
          userId: doc.ref.parent.parent?.id || 'unknown',
          score: doc.data().domains?.[domain]?.current || 0,
          percentile: doc.data().percentiles?.[domain] || 0,
          confidence: doc.data().domains?.[domain]?.confidence || 0
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      res.status(200).json({
        success: true,
        domain,
        leaderboard,
        totalUsers: allProfilesSnapshot.size
      });
    } catch (error) {
      console.error('❌ Error fetching leaderboard:', error);
      res.status(500).json({
        error: 'Failed to fetch leaderboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

/**
 * HTTP endpoint: Force refresh for a specific user
 */
export const refreshCognitiveProfile = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ 
        error: 'Missing userId parameter',
        usage: '/refreshCognitiveProfile?userId=YOUR_USER_ID'
      });
      return;
    }

    try {
      console.log(`🔄 Force refreshing profile for user: ${userId}`);
      
      const profile = await aggregateUserCognitiveProfile(userId);
      
      await db.doc(`users/${userId}/cognitiveProfile/current`).set(profile);
      
      res.status(200).json({
        success: true,
        message: `✅ Profile refreshed for user: ${userId}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Error refreshing profile:', error);
      res.status(500).json({
        error: 'Failed to refresh cognitive profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});