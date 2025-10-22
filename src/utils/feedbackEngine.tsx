// Enhanced Feedback Engine for Lifestyle-Cognitive Performance Analysis
// This integrates with the existing sync score calculator and challenge system

interface LifestyleFactor {
  type: 'sleep' | 'nutrition' | 'activity' | 'challenge'
  timestamp: number
  value: any
  metadata?: Record<string, any>
}

interface CognitiveOutcome {
  timestamp: number
  domain: 'memory' | 'attention' | 'recall' | 'problemSolving' | 'creativity'
  score: number
  sessionMetadata?: {
    timeOfDay: number
    duration: number
    difficulty: number
  }
}

interface CorrelationInsight {
  factor: string
  outcome: string
  correlation: number
  confidence: number
  sampleSize: number
  timelag: number // hours between factor and outcome
  significance: 'high' | 'medium' | 'low'
  trend: 'improving' | 'stable' | 'declining'
}

interface PersonalizedRecommendation {
  id: string
  category: 'sleep' | 'nutrition' | 'activity' | 'timing'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  expectedImprovement: {
    domain: string
    percentageIncrease: number
    confidence: number
  }
  suggestedChallenge?: string
  timeframe: string
  evidence: {
    correlation: number
    basedOnDays: number
    userSpecific: boolean
  }
}

interface FeedbackAnalysis {
  insights: CorrelationInsight[]
  recommendations: PersonalizedRecommendation[]
  progressSummary: {
    overallTrend: 'improving' | 'stable' | 'declining'
    bestPerformingFactors: string[]
    areasForImprovement: string[]
  }
  confidenceLevel: number
}

class LifestyleCognitiveFeedbackEngine {
  private userData: any
  private minSampleSize = 7 // minimum days for correlation analysis
  private confidenceThreshold = 0.3 // minimum correlation for recommendations

  constructor(userData: any) {
    this.userData = userData
  }

  // Main analysis function
  async analyzeFeedbackPatterns(
    lifestyleData: LifestyleFactor[],
    cognitiveData: CognitiveOutcome[],
    challengeData: any
  ): Promise<FeedbackAnalysis> {
    
    const sleepInsights = this.analyzeSleepCorrelations(lifestyleData, cognitiveData)
    const nutritionInsights = this.analyzeNutritionCorrelations(lifestyleData, cognitiveData)
    const activityInsights = this.analyzeActivityCorrelations(lifestyleData, cognitiveData)
    const challengeInsights = this.analyzeChallengeEffectiveness(challengeData, cognitiveData)
    const timingInsights = this.analyzeTimingOptimization(cognitiveData)

    const allInsights = [
      ...sleepInsights,
      ...nutritionInsights, 
      ...activityInsights,
      ...challengeInsights,
      ...timingInsights
    ]

    const recommendations = this.generatePersonalizedRecommendations(allInsights)
    const progressSummary = this.calculateProgressSummary(allInsights, cognitiveData)
    const confidenceLevel = this.calculateOverallConfidence(allInsights)

    return {
      insights: allInsights,
      recommendations,
      progressSummary,
      confidenceLevel
    }
  }

  private analyzeSleepCorrelations(
    lifestyleData: LifestyleFactor[], 
    cognitiveData: CognitiveOutcome[]
  ): CorrelationInsight[] {
    const insights: CorrelationInsight[] = []
    
    // Sleep quality vs cognitive performance
    const sleepQualityCorr = this.calculateCorrelation(
      lifestyleData.filter(d => d.type === 'sleep'),
      cognitiveData,
      (sleep: any) => sleep.value.sleepQualityScore,
      (cog: CognitiveOutcome) => cog.score,
      0 // same day correlation
    )

    if (sleepQualityCorr.sampleSize >= this.minSampleSize) {
      insights.push({
        factor: 'Sleep Quality',
        outcome: 'Overall Cognitive Performance',
        correlation: sleepQualityCorr.correlation,
        confidence: sleepQualityCorr.confidence,
        sampleSize: sleepQualityCorr.sampleSize,
        timelag: 0,
        significance: this.getSignificance(sleepQualityCorr.correlation),
        trend: this.calculateTrend(sleepQualityCorr.recentCorrelation, sleepQualityCorr.correlation)
      })
    }

    // Sleep duration vs cognitive domains
    const cognitiveDomains = ['memory', 'attention', 'recall', 'problemSolving', 'creativity']
    
    cognitiveDomains.forEach(domain => {
      const durationCorr = this.calculateCorrelation(
        lifestyleData.filter(d => d.type === 'sleep'),
        cognitiveData.filter(c => c.domain === domain),
        (sleep: any) => sleep.value.sleepDuration?.totalMinutes || 0,
        (cog: CognitiveOutcome) => cog.score,
        0
      )

      if (durationCorr.sampleSize >= this.minSampleSize) {
        insights.push({
          factor: 'Sleep Duration',
          outcome: `${domain} Performance`,
          correlation: durationCorr.correlation,
          confidence: durationCorr.confidence,
          sampleSize: durationCorr.sampleSize,
          timelag: 0,
          significance: this.getSignificance(durationCorr.correlation),
          trend: this.calculateTrend(durationCorr.recentCorrelation, durationCorr.correlation)
        })
      }
    })

    // Bedtime consistency vs performance
    const bedtimeConsistencyCorr = this.calculateBedtimeConsistencyCorrelation(lifestyleData, cognitiveData)
    if (bedtimeConsistencyCorr) {
      insights.push(bedtimeConsistencyCorr)
    }

    return insights
  }

  private analyzeNutritionCorrelations(
    lifestyleData: LifestyleFactor[], 
    cognitiveData: CognitiveOutcome[]
  ): CorrelationInsight[] {
    const insights: CorrelationInsight[] = []

    // Caffeine timing vs attention/focus
    const caffeineTimingCorr = this.calculateCorrelation(
      lifestyleData.filter(d => d.type === 'nutrition'),
      cognitiveData.filter(c => c.domain === 'attention'),
      (nutrition: any) => this.getCaffeineTimingScore(nutrition.value),
      (cog: CognitiveOutcome) => cog.score,
      2 // 2-hour lag for caffeine effect
    )

    if (caffeineTimingCorr.sampleSize >= this.minSampleSize) {
      insights.push({
        factor: 'Caffeine Timing',
        outcome: 'Attention Performance',
        correlation: caffeineTimingCorr.correlation,
        confidence: caffeineTimingCorr.confidence,
        sampleSize: caffeineTimingCorr.sampleSize,
        timelag: 2,
        significance: this.getSignificance(caffeineTimingCorr.correlation),
        trend: this.calculateTrend(caffeineTimingCorr.recentCorrelation, caffeineTimingCorr.correlation)
      })
    }

    // Meal timing vs cognitive performance
    const mealTimingCorr = this.calculateMealTimingCorrelation(lifestyleData, cognitiveData)
    if (mealTimingCorr) {
      insights.push(mealTimingCorr)
    }

    return insights
  }

  private analyzeActivityCorrelations(
    lifestyleData: LifestyleFactor[], 
    cognitiveData: CognitiveOutcome[]
  ): CorrelationInsight[] {
    const insights: CorrelationInsight[] = []

    // Exercise vs cognitive performance (next day effect)
    const exerciseCorr = this.calculateCorrelation(
      lifestyleData.filter(d => d.type === 'activity'),
      cognitiveData,
      (activity: any) => this.getExerciseIntensityScore(activity.value),
      (cog: CognitiveOutcome) => cog.score,
      12 // 12-hour lag for exercise benefits
    )

    if (exerciseCorr.sampleSize >= this.minSampleSize) {
      insights.push({
        factor: 'Exercise Intensity',
        outcome: 'Next-Day Cognitive Performance',
        correlation: exerciseCorr.correlation,
        confidence: exerciseCorr.confidence,
        sampleSize: exerciseCorr.sampleSize,
        timelag: 12,
        significance: this.getSignificance(exerciseCorr.correlation),
        trend: this.calculateTrend(exerciseCorr.recentCorrelation, exerciseCorr.correlation)
      })
    }

    return insights
  }

  private analyzeChallengeEffectiveness(
    challengeData: any,
    cognitiveData: CognitiveOutcome[]
  ): CorrelationInsight[] {
    const insights: CorrelationInsight[] = []

    if (!challengeData?.activeChallenges && !challengeData?.completedChallenges) {
      return insights
    }

    // Analyze effect of specific challenges on cognitive performance
    const allChallenges = [...(challengeData.activeChallenges || []), ...(challengeData.completedChallenges || [])]
    
    allChallenges.forEach(challenge => {
      const challengeEffect = this.analyzeChallengeImpact(challenge, cognitiveData)
      if (challengeEffect) {
        insights.push(challengeEffect)
      }
    })

    return insights
  }

  private analyzeTimingOptimization(cognitiveData: CognitiveOutcome[]): CorrelationInsight[] {
    const insights: CorrelationInsight[] = []

    // Analyze time-of-day performance patterns
    const timeOfDayAnalysis = this.analyzeTimeOfDayPerformance(cognitiveData)
    if (timeOfDayAnalysis) {
      insights.push(timeOfDayAnalysis)
    }

    return insights
  }

  private generatePersonalizedRecommendations(insights: CorrelationInsight[]): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = []

    // Sort insights by correlation strength and significance
    const significantInsights = insights.filter(i => 
      Math.abs(i.correlation) > this.confidenceThreshold && 
      i.significance !== 'low'
    ).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))

    significantInsights.forEach((insight, index) => {
      const rec = this.createRecommendationFromInsight(insight, index < 3 ? 'high' : 'medium')
      if (rec) {
        recommendations.push(rec)
      }
    })

    return recommendations
  }

  private createRecommendationFromInsight(
    insight: CorrelationInsight, 
    priority: 'high' | 'medium' | 'low'
  ): PersonalizedRecommendation | null {
    
    // Sleep-related recommendations
    if (insight.factor.includes('Sleep')) {
      if (insight.correlation > 0.4) {
        return {
          id: `sleep-${Date.now()}`,
          category: 'sleep',
          priority,
          title: 'Optimize Your Sleep Pattern',
          description: `Your ${insight.factor.toLowerCase()} strongly correlates with ${insight.outcome.toLowerCase()}. Focus on maintaining consistent sleep habits.`,
          expectedImprovement: {
            domain: insight.outcome,
            percentageIncrease: Math.round(insight.correlation * 15),
            confidence: insight.confidence
          },
          suggestedChallenge: this.getSuggestedSleepChallenge(insight),
          timeframe: '1-2 weeks',
          evidence: {
            correlation: insight.correlation,
            basedOnDays: insight.sampleSize,
            userSpecific: true
          }
        }
      }
    }

    // Nutrition-related recommendations
    if (insight.factor.includes('Caffeine') || insight.factor.includes('Meal')) {
      return {
        id: `nutrition-${Date.now()}`,
        category: 'nutrition',
        priority,
        title: 'Adjust Your Nutrition Timing',
        description: `Your ${insight.factor.toLowerCase()} shows a ${insight.correlation > 0 ? 'positive' : 'negative'} relationship with ${insight.outcome.toLowerCase()}.`,
        expectedImprovement: {
          domain: insight.outcome,
          percentageIncrease: Math.round(Math.abs(insight.correlation) * 12),
          confidence: insight.confidence
        },
        suggestedChallenge: this.getSuggestedNutritionChallenge(insight),
        timeframe: '1 week',
        evidence: {
          correlation: insight.correlation,
          basedOnDays: insight.sampleSize,
          userSpecific: true
        }
      }
    }

    // Activity-related recommendations
    if (insight.factor.includes('Exercise')) {
      return {
        id: `activity-${Date.now()}`,
        category: 'activity',
        priority,
        title: 'Optimize Exercise Timing',
        description: `Regular exercise appears to boost your ${insight.outcome.toLowerCase()} by ${Math.round(Math.abs(insight.correlation) * 100)}%.`,
        expectedImprovement: {
          domain: insight.outcome,
          percentageIncrease: Math.round(Math.abs(insight.correlation) * 10),
          confidence: insight.confidence
        },
        timeframe: '2-3 weeks',
        evidence: {
          correlation: insight.correlation,
          basedOnDays: insight.sampleSize,
          userSpecific: true
        }
      }
    }

    return null
  }

  private getSuggestedSleepChallenge(insight: CorrelationInsight): string {
    if (insight.factor.includes('Quality')) {
      return 'evening-dim-down'
    } else if (insight.factor.includes('Duration')) {
      return 'consistent-pre-sleep-routine'
    } else if (insight.factor.includes('Consistency')) {
      return 'wake-time-anchor'
    }
    return 'fifteen-minute-shift'
  }

  private getSuggestedNutritionChallenge(insight: CorrelationInsight): string {
    if (insight.factor.includes('Caffeine')) {
      return 'smart-caffeine-window'
    } else if (insight.factor.includes('Meal')) {
      return 'consistent-meal-windows'
    }
    return 'study-snack-swap'
  }

  // Utility methods for correlation calculation
  private calculateCorrelation(
    factors: LifestyleFactor[],
    outcomes: CognitiveOutcome[],
    factorExtractor: (factor: any) => number,
    outcomeExtractor: (outcome: CognitiveOutcome) => number,
    timelagHours: number
  ): { correlation: number; confidence: number; sampleSize: number; recentCorrelation: number } {
    
    const pairs: Array<{ factor: number; outcome: number; timestamp: number }> = []
    
    factors.forEach(factor => {
      const factorTime = factor.timestamp
      const relevantOutcomes = outcomes.filter(outcome => 
        Math.abs(outcome.timestamp - (factorTime + timelagHours * 3600000)) < 12 * 3600000 // within 12 hours
      )
      
      relevantOutcomes.forEach(outcome => {
        pairs.push({
          factor: factorExtractor(factor),
          outcome: outcomeExtractor(outcome),
          timestamp: outcome.timestamp
        })
      })
    })

    if (pairs.length < this.minSampleSize) {
      return { correlation: 0, confidence: 0, sampleSize: pairs.length, recentCorrelation: 0 }
    }

    const correlation = this.pearsonCorrelation(
      pairs.map(p => p.factor),
      pairs.map(p => p.outcome)
    )

    // Calculate confidence based on sample size and consistency
    const confidence = Math.min(0.95, pairs.length / 30)

    // Calculate recent correlation (last 7 days) for trend analysis
    const recentPairs = pairs.filter(p => p.timestamp > Date.now() - 7 * 24 * 3600000)
    const recentCorrelation = recentPairs.length >= 5 ? 
      this.pearsonCorrelation(
        recentPairs.map(p => p.factor),
        recentPairs.map(p => p.outcome)
      ) : correlation

    return { correlation, confidence, sampleSize: pairs.length, recentCorrelation }
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0

    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0)
    const sumYY = y.reduce((acc, yi) => acc + yi * yi, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY))

    return denominator === 0 ? 0 : numerator / denominator
  }

  private getSignificance(correlation: number): 'high' | 'medium' | 'low' {
    const abs = Math.abs(correlation)
    if (abs > 0.6) return 'high'
    if (abs > 0.3) return 'medium'
    return 'low'
  }

  private calculateTrend(recent: number, overall: number): 'improving' | 'stable' | 'declining' {
    const diff = recent - overall
    if (Math.abs(diff) < 0.1) return 'stable'
    return diff > 0 ? 'improving' : 'declining'
  }

  private getCaffeineTimingScore(nutritionValue: any): number {
    // Implementation depends on nutrition data structure
    // Return score based on caffeine timing relative to optimal windows
    return 0
  }

  private getExerciseIntensityScore(activityValue: any): number {
    // Implementation depends on activity data structure
    // Return score based on exercise intensity and duration
    return 0
  }

  // Additional helper methods would be implemented here...
  private calculateBedtimeConsistencyCorrelation(lifestyleData: LifestyleFactor[], cognitiveData: CognitiveOutcome[]): CorrelationInsight | null {
    // Implementation for bedtime consistency analysis
    return null
  }

  private calculateMealTimingCorrelation(lifestyleData: LifestyleFactor[], cognitiveData: CognitiveOutcome[]): CorrelationInsight | null {
    // Implementation for meal timing analysis
    return null
  }

  private analyzeChallengeImpact(challenge: any, cognitiveData: CognitiveOutcome[]): CorrelationInsight | null {
    // Implementation for challenge effectiveness analysis
    return null
  }

  private analyzeTimeOfDayPerformance(cognitiveData: CognitiveOutcome[]): CorrelationInsight | null {
    // Implementation for time-of-day performance analysis
    return null
  }

  private calculateProgressSummary(insights: CorrelationInsight[], cognitiveData: CognitiveOutcome[]): any {
    // Implementation for progress summary calculation
    return {
      overallTrend: 'stable' as const,
      bestPerformingFactors: [],
      areasForImprovement: []
    }
  }

  private calculateOverallConfidence(insights: CorrelationInsight[]): number {
    if (insights.length === 0) return 0
    return insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
  }
}

// Export for integration with existing codebase
export {
  LifestyleCognitiveFeedbackEngine,
  type FeedbackAnalysis,
  type PersonalizedRecommendation,
  type CorrelationInsight
}