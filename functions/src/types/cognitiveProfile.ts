export interface UnifiedCognitiveProfile {
  // Core Domains (0-100 normalized scores)
  domains: {
    [key: string]: DomainScore;  // ← Add this index signature
    memory: DomainScore;
    attention: DomainScore;
    recall: DomainScore;
    problemSolving: DomainScore;
    creativity: DomainScore;
    executiveFunction: DomainScore;
    inhibitionControl: DomainScore;
    cognitiveFlexibility: DomainScore;
    workingMemory: DomainScore;
  };
  
  // Granular Cross-Game Metrics
  metrics: {
    averageDecisionTime: number;
    strategicConsistency: number;
    errorRate: number;
    adaptationSpeed: number;
    planningDepth: number;
    impulseControl: number;
    focusStability: number;
    learningRate: number;
  };
  
  // Game Contributions
  contributions: {
    [domain: string]: GameContribution[];
  };
  
  // Temporal Analytics
  trends: {
    [key: string]: TrendData;  // ← Keep the index signature AND add specific keys
    memory: TrendData;
    attention: TrendData;
    recall: TrendData;
    problemSolving: TrendData;
    creativity: TrendData;
    executiveFunction: TrendData;
    inhibitionControl: TrendData;
    cognitiveFlexibility: TrendData;
    workingMemory: TrendData;
  };
  
  // Comparison Data (percentiles vs other users)
  percentiles: {
    [key: string]: number;  // ← Keep the index signature AND add specific keys
    memory: number;
    attention: number;
    recall: number;
    problemSolving: number;
    creativity: number;
    executiveFunction: number;
    inhibitionControl: number;
    cognitiveFlexibility: number;
    workingMemory: number;
  };
  
  // Peak Performance Insights
  peakPerformance: {
    bestTimeOfDay: number;
    bestDayOfWeek: number;
    optimalSessionDuration: number;
    fatigueThreshold: number;
  };
  
  // Metadata
  lastUpdated: any;
  totalSessions: number;
  totalGamesPlayed: number;
  accountAge: number;
  dataQuality: DataQualityMetrics;
}

export interface DomainScore {
  current: number; // 0-100
  average7d: number; // 7-day rolling average
  average30d: number; // 30-day rolling average
  personalBest: number;
  personalBestDate: number; // timestamp
  confidence: number; // 0-1, based on sample size and variance
}

export interface GameContribution {
  gameType: string;
  weight: number; // contribution weight to this domain
  lastUpdated: number;
  sessionCount: number;
  avgScore: number;
  reliability: number; // 0-1, based on consistency
}

export interface TrendData {
  weeklyChange: number; // percentage change
  monthlyChange: number;
  yearlyChange: number;
  trajectory: 'improving' | 'declining' | 'stable';
  volatility: number; // standard deviation
  consistencyScore: number; // 0-100
  momentum: number; // rate of change
}

export interface DataQualityMetrics {
  sampleSize: number; // total data points
  recency: number; // days since last session
  coverage: number; // percentage of domains with data
  consistency: number; // temporal consistency score
  reliability: number; // overall reliability score 0-100
}

export interface SessionPerformanceLog {
  timestamp: number;
  hourOfDay: number;
  dayOfWeek: number;
  domain: string;
  rawScore: number;
  normalizedScore: number;
  sessionIndex: number;
  gameType: string;
  hoursAwake?: number;
  deviceType?: string;
  userId: string;
  date: string;
  sessionDuration?: number;
  fatigueLevel?: number;
}

export interface DomainConfig {
  game: string;
  metric: string;
  weight: number;
  inverse?: boolean; // true if lower is better
  normalize?: [number, number]; // [min, max] for normalization
  reliability?: number; // override default reliability
}