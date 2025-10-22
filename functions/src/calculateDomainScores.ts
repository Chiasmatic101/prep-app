import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import cors from 'cors';

admin.initializeApp();
const db = admin.firestore();
const corsHandler = cors({ origin: true });

const getTodayDateKey = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

const normalize = (val: number, min: number, max: number): number => {
  if (max === min) return 0;
  return Math.round(((val - min) / (max - min)) * 100);
};

const inverseNormalize = (val: number, min: number, max: number): number => {
  if (max === min) return 0;
  return Math.round((1 - (val - min) / (max - min)) * 100);
};

const average = (arr: number[]): number => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

// Enhanced session performance logging
interface SessionPerformanceLog {
  timestamp: number;
  hourOfDay: number;
  domain: string;
  rawScore: number;
  normalizedScore: number;
  sessionIndex: number;
  gameType: string;
  hoursAwake?: number;
  deviceType?: string;
  userId: string;
  date: string;
}

// Extract raw performance metrics from different game types
const extractRawScore = (session: any, domain: string, gameType: string): number => {
  switch (gameType) {
    case 'memoryGame':
      return session.performance?.accuracy || 0;
    
    case 'patternMemoryGame':
      if (domain === 'memory') return session.cognitiveMetrics?.visualMemorySpan || 0;
      if (domain === 'recall') return session.performance?.accuracy || 0;
      return 0;
    
    case 'memoryTest':
      return session.performance?.quizAccuracy || 0;
    
    case 'colorQuickGame':
      // For attention domain - invert stroop effect (lower is better)
      const stroopEffect = session.stroopDetails?.stroopEffect || 1000;
      return Math.max(0, 1000 - stroopEffect);
    
    case 'reactionTimeGame':
      // For attention domain - invert reaction time (lower is better)
      const rt = session.performance?.averageReactionTime || 1000;
      return Math.max(0, 1000 - rt);
    
    case 'colorRunnerGame':
      if (domain === 'attention') return session.cognitiveMetrics?.attentionalFlexibility || 0;
      if (domain === 'problemSolving') return session.cognitiveMetrics?.adaptationSpeed || 0;
      if (domain === 'creativity') return session.cognitiveMetrics?.riskTaking || 0;
      return 0;
    
    case 'colorSortGame':
      if (domain === 'problemSolving') {
        const planning = session.cognitive?.planningPauses || 0;
        const backtracks = session.cognitive?.backtrackMoves || 0;
        // Lower planning pauses and backtracks = better performance
        return Math.max(0, 100 - (planning * 5 + backtracks * 3));
      }
      if (domain === 'creativity') return session.cognitive?.focusChanges || 0;
      return 0;
    
    case 'survivalGame':
      if (domain === 'creativity') return session.explorationScore || 0;
      return 0;
    
    default:
      return 0;
  }
};

// Calculate normalized score based on user's recent performance
const calculateNormalizedScore = async (
  userId: string, 
  rawScore: number, 
  domain: string, 
  gameType: string
): Promise<number> => {
  try {
    // Get last 7 days of performance for this domain/game combination
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const recentPerformance = await db
      .collection(`users/${userId}/cognitivePerformance`)
      .where('domain', '==', domain)
      .where('gameType', '==', gameType)
      .where('timestamp', '>=', sevenDaysAgo)
      .get();
    
    if (recentPerformance.empty || recentPerformance.size < 3) {
      // Not enough data for normalization, return 0 (neutral)
      return 0;
    }
    
    const recentScores = recentPerformance.docs.map(doc => doc.data().rawScore);
    recentScores.sort((a, b) => a - b);
    
    // Calculate median and MAD (Median Absolute Deviation)
    const median = recentScores[Math.floor(recentScores.length / 2)];
    const deviations = recentScores.map(score => Math.abs(score - median));
    deviations.sort((a, b) => a - b);
    const mad = deviations[Math.floor(deviations.length / 2)];
    
    // Robust z-score calculation
    const epsilon = 0.01; // Prevent division by zero
    const normalizedScore = (rawScore - median) / (mad + epsilon);
    
    // Winsorize at ±3 and return
    return Math.max(-3, Math.min(3, normalizedScore));
    
  } catch (error) {
    console.error('Error calculating normalized score:', error);
    return 0;
  }
};

// Enhanced session logging function
const logSessionPerformance = async (
  userId: string,
  sessions: any[],
  gameType: string,
  domain: string,
  startTime: number,
  endTime: number
): Promise<void> => {
  const sessionLogs: SessionPerformanceLog[] = [];
  
  for (const session of sessions) {
    if (session.sessionOverview?.sessionStart >= startTime && 
        session.sessionOverview?.sessionStart < endTime) {
      
      const sessionTime = new Date(session.sessionOverview.sessionStart);
      const hourOfDay = sessionTime.getHours() + sessionTime.getMinutes() / 60;
      const rawScore = extractRawScore(session, domain, gameType);
      
      if (rawScore > 0) { // Only log if we extracted a valid score
        const normalizedScore = await calculateNormalizedScore(userId, rawScore, domain, gameType);
        
        sessionLogs.push({
          timestamp: session.sessionOverview.sessionStart,
          hourOfDay: hourOfDay,
          domain: domain,
          rawScore: rawScore,
          normalizedScore: normalizedScore,
          sessionIndex: session.sessionOverview.sessionNumber || 0,
          gameType: gameType,
          userId: userId,
          date: getTodayDateKey(),
          deviceType: session.deviceInfo?.type || 'unknown'
        });
      }
    }
  }
  
  // Batch write session performance data
  if (sessionLogs.length > 0) {
    const batch = db.batch();
    sessionLogs.forEach((log) => {
      const docRef = db.collection(`users/${userId}/cognitivePerformance`).doc();
      batch.set(docRef, log);
    });
    await batch.commit();
    console.log(`Logged ${sessionLogs.length} session performance entries for user ${userId}`);
  }
};

// Main compute daily scores function (enhanced)
export const computeDailyScores = functions.pubsub
  .schedule('every day 02:00')
  .timeZone('UTC')
  .onRun(async () => {
    const usersSnapshot = await db.collection('users').get();
    const todayKey = getTodayDateKey();
    const startTime = new Date(todayKey).getTime();
    const endTime = startTime + 86400000; // +24h

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      try {
        const scores = await calculateDomainScoresForUser(userData, userId, startTime, endTime);
        
        await db.doc(`users/${userId}/dailyCognitiveScores/${todayKey}`).set({
          ...scores,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Saved scores for ${userId}`);
      } catch (err) {
        console.error(`Error processing ${userId}`, err);
      }
    }
  });

// Test endpoint for development
export const testDailyScores = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).send('Missing userId parameter');
      return;
    }

    try {
      const userDoc = await db.doc(`users/${userId}`).get();
      const userData = userDoc.data();
      const todayKey = getTodayDateKey();
      const startTime = new Date(todayKey).getTime();
      const endTime = startTime + 86400000;

      const scores = await calculateDomainScoresForUser(userData, userId, startTime, endTime);
      
      await db.doc(`users/${userId}/dailyCognitiveScores/${todayKey}`).set({
        ...scores,
        testRun: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).send(`✅ Scores written for user: ${userId}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('❌ Error calculating scores');
    }
  });
});

// Enhanced domain score calculation with session logging
async function calculateDomainScoresForUser(
  userData: any, 
  userId: string, 
  startTime: number, 
  endTime: number
) {
  // Extract game session data
  const memoryGame = userData.memoryGame?.sessions || [];
  const patternGame = userData.patternMemoryGame?.sessions || [];
  const quizData = userData.memoryTest?.sessions || [];
  const colorQuick = userData.colorQuickGame?.sessions || [];
  const reactionGame = userData.reactionTimeGame?.sessions || [];
  const runnerGame = userData.colorRunnerGame?.sessions || [];
  const colorSort = userData.colorSortGame?.sessions || [];
  const survivalGame = userData.survivalGame?.sessions || [];

  // Filter sessions for today
  const filterToday = (sessions: any[]) => 
    sessions.filter(s => 
      s.sessionOverview?.sessionStart >= startTime && 
      s.sessionOverview?.sessionStart < endTime
    );

  const todayMemory = filterToday(memoryGame);
  const todayPattern = filterToday(patternGame);
  const todayQuiz = filterToday(quizData);
  const todayStroop = filterToday(colorQuick);
  const todayReaction = filterToday(reactionGame);
  const todayRunner = filterToday(runnerGame);
  const todaySort = filterToday(colorSort);
  const todaySurvival = filterToday(survivalGame);

  // Log session performance data for adaptive timeline
  const gameSessionMappings = [
    { sessions: todayMemory, gameType: 'memoryGame', domains: ['memory'] },
    { sessions: todayPattern, gameType: 'patternMemoryGame', domains: ['memory', 'recall'] },
    { sessions: todayQuiz, gameType: 'memoryTest', domains: ['memory', 'recall'] },
    { sessions: todayStroop, gameType: 'colorQuickGame', domains: ['attention'] },
    { sessions: todayReaction, gameType: 'reactionTimeGame', domains: ['attention'] },
    { sessions: todayRunner, gameType: 'colorRunnerGame', domains: ['attention', 'problemSolving', 'creativity'] },
    { sessions: todaySort, gameType: 'colorSortGame', domains: ['problemSolving', 'creativity'] },
    { sessions: todaySurvival, gameType: 'survivalGame', domains: ['creativity'] }
  ];

  // Log performance data for each game/domain combination
  for (const mapping of gameSessionMappings) {
    for (const domain of mapping.domains) {
      await logSessionPerformance(
        userId, 
        mapping.sessions, 
        mapping.gameType, 
        domain, 
        startTime, 
        endTime
      );
    }
  }

  // MEMORY DOMAIN CALCULATION
  const visualSpan = average(
    todayPattern.map(s => s.cognitiveMetrics?.visualMemorySpan || 0)
  );
  const sequenceAcc = average(
    todayMemory.map(s => s.performance?.accuracy || 0)
  );
  const quizAcc = average(
    todayQuiz.map(s => s.performance?.quizAccuracy || 0)
  );

  const memoryScore = Math.round(
    0.4 * normalize(visualSpan, 0, 12) +
    0.3 * sequenceAcc +
    0.3 * quizAcc
  );

  // ATTENTION DOMAIN CALCULATION
  const stroopEffect = average(
    todayStroop.map(s => s.stroopDetails?.stroopEffect || 0)
  );
  const rt = average(
    todayReaction.map(s => s.performance?.averageReactionTime || 0)
  );
  const flexibility = average(
    todayRunner.map(s => s.cognitiveMetrics?.attentionalFlexibility || 0)
  );

  const attentionScore = Math.round(
    0.4 * inverseNormalize(stroopEffect, 0, 1000) +
    0.3 * inverseNormalize(rt, 200, 1000) +
    0.3 * normalize(flexibility, 0, 100)
  );

  // RECALL DOMAIN CALCULATION
  const recallAcc = average(
    todayPattern.map(s => s.performance?.accuracy || 0)
  );

  const recallScore = Math.round(
    0.4 * recallAcc +
    0.3 * sequenceAcc +
    0.3 * quizAcc
  );

  // PROBLEM SOLVING DOMAIN CALCULATION
  const planning = average(
    todaySort.map(s => s.cognitive?.planningPauses || 0)
  );
  const backtracks = average(
    todaySort.map(s => s.cognitive?.backtrackMoves || 0)
  );
  const adaptation = average(
    todayRunner.map(s => s.cognitiveMetrics?.adaptationSpeed || 0)
  );

  const problemSolvingScore = Math.round(
    0.5 * inverseNormalize(planning, 0, 10) +
    0.3 * inverseNormalize(backtracks, 0, 10) +
    0.2 * normalize(adaptation, 0, 100)
  );

  // CREATIVITY DOMAIN CALCULATION
  const risk = average(
    todayRunner.map(s => s.cognitiveMetrics?.riskTaking || 0)
  );
  const explore = average(
    todaySurvival.map(s => s.explorationScore || 0)
  );
  const novelty = average(
    todaySort.map(s => s.cognitive?.focusChanges || 0)
  );

  const creativityScore = Math.round(
    0.4 * normalize(risk, 0, 100) +
    0.3 * normalize(explore, 0, 100) +
    0.3 * normalize(novelty, 0, 20)
  );

  return {
    memory: memoryScore,
    attention: attentionScore,
    recall: recallScore,
    problemSolving: problemSolvingScore,
    creativity: creativityScore,
    computedFrom: {
      memoryGame: !!todayMemory.length,
      patternMemoryGame: !!todayPattern.length,
      memoryTest: !!todayQuiz.length,
      colorQuickGame: !!todayStroop.length,
      reactionTimeGame: !!todayReaction.length,
      colorRunnerGame: !!todayRunner.length,
      colorSortGame: !!todaySort.length,
      survivalGame: !!todaySurvival.length,
    },
    sessionDataLogged: true, // Flag indicating enhanced logging is active
    timestamp: Date.now()
  };
}

// Utility function to fetch adaptive timeline data for frontend
export const getAdaptiveTimelineData = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const userId = req.query.userId as string;
    const days = parseInt(req.query.days as string) || 7;
    
    if (!userId) {
      res.status(400).send('Missing userId parameter');
      return;
    }

    try {
      const daysAgo = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      const performanceData = await db
        .collection(`users/${userId}/cognitivePerformance`)
        .where('timestamp', '>=', daysAgo)
        .orderBy('timestamp', 'asc')
        .get();

      const sessions = performanceData.docs.map(doc => doc.data());
      
      res.status(200).json({
        sessions: sessions,
        count: sessions.length,
        timeRange: {
          start: daysAgo,
          end: Date.now()
        }
      });
    } catch (err) {
      console.error('Error fetching adaptive timeline data:', err);
      res.status(500).send('Error fetching timeline data');
    }
  });
});