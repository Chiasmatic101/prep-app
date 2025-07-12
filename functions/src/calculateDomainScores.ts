// File: functions/src/calculateDomainScores.ts

import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v1';


admin.initializeApp()
const db = admin.firestore()

const getTodayDateKey = (): string => {
  const now = new Date()
  return now.toISOString().split('T')[0] // e.g., '2025-07-06'
}

const normalize = (val: number, min: number, max: number): number => {
  if (max === min) return 0
  return Math.round(((val - min) / (max - min)) * 100)
}

const inverseNormalize = (val: number, min: number, max: number): number => {
  if (max === min) return 0
  return Math.round((1 - (val - min) / (max - min)) * 100)
}

const average = (arr: number[]): number => {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export const computeDailyScores = functions.pubsub.schedule('every day 02:00').timeZone('UTC').onRun(async () => {
  const usersSnapshot = await db.collection('users').get()
  const todayKey = getTodayDateKey()
  const startTime = new Date(todayKey).getTime()
  const endTime = startTime + 86400000 // +24h

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id
    const userData = userDoc.data()

    try {
      const scores = await calculateDomainScoresForUser(userData, startTime, endTime)
      await db.doc(`users/${userId}/dailyCognitiveScores/${todayKey}`).set({
        ...scores,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`Saved scores for ${userId}`)
    } catch (err) {
      console.error(`Error processing ${userId}`, err)
    }
  }
})

export const testDailyScores = functions.https.onRequest(async (req, res) => {
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

    const scores = await calculateDomainScoresForUser(userData, startTime, endTime);
    await db.doc(`users/${userId}/dailyCognitiveScores/${todayKey}`).set({
      ...scores,
      testRun: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send(`✅ Scores written for user: ${userId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error calculating scores');
  }
});






async function calculateDomainScoresForUser(userData: any, startTime: number, endTime: number) {
  const memoryGame = userData.memoryGame?.sessions || []
  const patternGame = userData.patternMemoryGame?.sessions || []
  const quizData = userData.memoryTest?.sessions || []
  const colorQuick = userData.colorQuickGame?.sessions || []
  const reactionGame = userData.reactionTimeGame?.sessions || []
  const runnerGame = userData.colorRunnerGame?.sessions || []
  const colorSort = userData.colorSortGame?.sessions || []
  const survivalGame = userData.survivalGame?.sessions || []

  const filterToday = (sessions: any[]) =>
    sessions.filter(s => s.sessionOverview?.sessionStart >= startTime && s.sessionOverview?.sessionStart < endTime)

  const todayMemory = filterToday(memoryGame)
  const todayPattern = filterToday(patternGame)
  const todayQuiz = filterToday(quizData)
  const todayStroop = filterToday(colorQuick)
  const todayReaction = filterToday(reactionGame)
  const todayRunner = filterToday(runnerGame)
  const todaySort = filterToday(colorSort)
  const todaySurvival = filterToday(survivalGame)

  // MEMORY
  const visualSpan = average(todayPattern.map(s => s.cognitiveMetrics?.visualMemorySpan || 0))
  const sequenceAcc = average(todayMemory.map(s => s.performance?.accuracy || 0))
  const quizAcc = average(todayQuiz.map(s => s.performance?.quizAccuracy || 0))
  const memoryScore = Math.round(
    0.4 * normalize(visualSpan, 0, 12) +
    0.3 * sequenceAcc +
    0.3 * quizAcc
  )

  // ATTENTION
  const stroopEffect = average(todayStroop.map(s => s.stroopDetails?.stroopEffect || 0))
  const rt = average(todayReaction.map(s => s.performance?.averageReactionTime || 0))
  const flexibility = average(todayRunner.map(s => s.cognitiveMetrics?.attentionalFlexibility || 0))
  const attentionScore = Math.round(
    0.4 * inverseNormalize(stroopEffect, 0, 1000) +
    0.3 * inverseNormalize(rt, 200, 1000) +
    0.3 * normalize(flexibility, 0, 100)
  )

  // RECALL
  const recallAcc = average(todayPattern.map(s => s.performance?.accuracy || 0))
  const recallScore = Math.round(
    0.4 * recallAcc +
    0.3 * sequenceAcc +
    0.3 * quizAcc
  )

  // PROBLEM SOLVING
  const planning = average(todaySort.map(s => s.cognitive?.planningPauses || 0))
  const backtracks = average(todaySort.map(s => s.cognitive?.backtrackMoves || 0))
  const adaptation = average(todayRunner.map(s => s.cognitiveMetrics?.adaptationSpeed || 0))
  const problemSolvingScore = Math.round(
    0.5 * inverseNormalize(planning, 0, 10) +
    0.3 * inverseNormalize(backtracks, 0, 10) +
    0.2 * normalize(adaptation, 0, 100)
  )

  // CREATIVITY
  const risk = average(todayRunner.map(s => s.cognitiveMetrics?.riskTaking || 0))
  const explore = average(todaySurvival.map(s => s.explorationScore || 0))
  const novelty = average(todaySort.map(s => s.cognitive?.focusChanges || 0))
  const creativityScore = Math.round(
    0.4 * normalize(risk, 0, 100) +
    0.3 * normalize(explore, 0, 100) +
    0.3 * normalize(novelty, 0, 20)
  )

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
  }
}
