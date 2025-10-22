// functions/src/index.ts

export { computeDailyScores, testDailyScores, getAdaptiveTimelineData } from './calculateDomainScores';

export {
  aggregateCognitiveProfiles,
  testCognitiveAggregation,
  getCognitiveProfile,
  getDomainLeaderboard,
  refreshCognitiveProfile
} from './aggregateCognitiveProfile';