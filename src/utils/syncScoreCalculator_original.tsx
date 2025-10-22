interface QuizResponses {
  naturalWake: 'Before 8 AM' | '8–10 AM' | 'After 10 AM'
  focusTime: 'Morning' | 'Afternoon' | 'Evening'
  testTime: 'Morning' | 'Midday' | 'Evening'
  schoolStart: 'Before 7:30 AM' | '7:30–8:00 AM' | 'After 8:00 AM'
  homeworkTime: 'Right after school' | 'After dinner' | 'Late at night' | 'Depends'
  wakeSchool?: 'Before 6 AM' | '6–6:59 AM' | '7–7:59 AM' | '8 AM or later'
  homeTime?: 'Before 3:30 PM' | '3:30–4:30 PM' | 'After 4:30 PM'
  extraTime?: 'Before 4 PM' | '4–6 PM' | 'After 6 PM' | 'Varies'
  extras?: 'AoPS' | 'RSM' | 'Kumon' | 'Other' | 'None'
  wakeFeel?: 'Wide awake' | 'A bit slow' | 'Super groggy'
  bedWeekend?: 'Before 10 PM' | '10 PM–Midnight' | 'After Midnight'
}

interface CognitiveSession {
  timestamp: number;
  hourOfDay: number;
  domain: 'memory' | 'attention' | 'recall' | 'problemSolving' | 'creativity';
  normalizedScore: number;
  rawScore: number;
  gameType: string;
}

interface SleepEntry {
  date: string;
  bedTime: string;
  wakeTime: string;
  wakingEvents?: number;
  sleepQualityScore?: number;
}

interface CosinorResult {
  amplitude: number;
  acrophase: number;
  reliability: number;
  rSquared: number;
}

interface EnhancedSyncResults {
  syncScore: number;
  schoolAlignment: number;
  studyAlignment: number;
  learningPhase: number;
  socialJetlagPenalty: number;
  adaptiveComponents: {
    observedAlignment: { school: number; study: number };
    predictedAlignment: { school: number; study: number };
    adaptationLevel: number;
    domainReliability: Record<string, number>;
  };
  sleepMetrics: {
    averageQuality: number;
    consistency: number;
    duration: number;
  };
  learningTimeline: number[]; // 96 15-minute bins
  chronotype: { chronotype: string; outOfSync: number };
}

class EnhancedSyncScoreCalculator {
  private readonly omega = 2 * Math.PI / 24;
  private readonly N0 = 20; // reliability parameter
  private readonly rhoMax = 0.8; // max reliability weight

  // Original mapping functions (unchanged)
  private mapNaturalWakeToHours(wake: string): number {
    switch (wake) {
      case 'Before 8 AM': return 7;
      case '8–10 AM': return 9;
      case 'After 10 AM': return 11;
      default: return 9;
    }
  }

  private mapFocusTimeToOffset(focus: string): number {
    switch (focus) {
      case 'Morning': return 2;
      case 'Afternoon': return 7;
      case 'Evening': return 9;
      default: return 5;
    }
  }

  private mapTestTimeToOffset(test: string): number {
    switch (test) {
      case 'Morning': return 2;
      case 'Midday': return 5;
      case 'Evening': return 9;
      default: return 5;
    }
  }

  private mapSchoolStartToWindow(start: string): { startTime: number; duration: number } {
    const duration = 6.5;
    switch (start) {
      case 'Before 7:30 AM': return { startTime: 7.25, duration };
      case '7:30–8:00 AM': return { startTime: 7.75, duration };
      case 'After 8:00 AM': return { startTime: 8.5, duration };
      default: return { startTime: 7.75, duration };
    }
  }

  private mapHomeworkTimeToWindow(homework: string, schoolEndTime: number): { startTime: number; duration: number } {
    switch (homework) {
      case 'Right after school': return { startTime: schoolEndTime + 0.5, duration: 1.5 };
      case 'After dinner': return { startTime: 19, duration: 1.5 };
      case 'Late at night': return { startTime: 21, duration: 1.5 };
      case 'Depends': return { startTime: schoolEndTime + 0.5, duration: 1 };
      default: return { startTime: schoolEndTime + 0.5, duration: 1.5 };
    }
  }

  private parseTimeString(timeStr: string): number {
    if (timeStr.includes('Before 6')) return 5.5;
    if (timeStr.includes('6–6:59')) return 6.5;
    if (timeStr.includes('7–7:59')) return 7.5;
    if (timeStr.includes('8 AM or later')) return 8.5;
    return 7.5;
  }

  // Enhanced chronotype calculation with survey inputs
  private calculateLearningAcrophase(responses: QuizResponses): number {
    const wNat = this.mapNaturalWakeToHours(responses.naturalWake);
    const deltaFocus = this.mapFocusTimeToOffset(responses.focusTime);
    const deltaTest = this.mapTestTimeToOffset(responses.testTime);
    
    // Base calculation
    const wf = 0.6, wt = 0.4;
    let phi = (wNat + wf * deltaFocus + wt * deltaTest) % 24;
    
    // Adjust based on additional survey data
    if (responses.wakeFeel === 'Super groggy') {
      phi += 1; // Later chronotype if very groggy in morning
    } else if (responses.wakeFeel === 'Wide awake') {
      phi -= 0.5; // Earlier chronotype if naturally alert
    }
    
    if (responses.bedWeekend === 'After Midnight') {
      phi += 1; // Later chronotype
    } else if (responses.bedWeekend === 'Before 10 PM') {
      phi -= 1; // Earlier chronotype
    }
    
    return (phi + 24) % 24;
  }

  // Fit cosinor model to cognitive performance data
  private fitCosinorModel(sessions: CognitiveSession[], domain: string): CosinorResult {
    const domainSessions = sessions.filter(s => s.domain === domain);
    
    if (domainSessions.length < 5) {
      return { amplitude: 0, acrophase: 12, reliability: 0, rSquared: 0 };
    }

    // Simple cosinor fitting using least squares
    const n = domainSessions.length;
    let sumY = 0, sumCos = 0, sumSin = 0, sumCosCos = 0, sumSinSin = 0, sumCosSin = 0, sumYCos = 0, sumYSin = 0;

    domainSessions.forEach(session => {
      const t = session.hourOfDay;
      const y = session.normalizedScore;
      const cosT = Math.cos(this.omega * t);
      const sinT = Math.sin(this.omega * t);

      sumY += y;
      sumCos += cosT;
      sumSin += sinT;
      sumCosCos += cosT * cosT;
      sumSinSin += sinT * sinT;
      sumCosSin += cosT * sinT;
      sumYCos += y * cosT;
      sumYSin += y * sinT;
    });

    // Solve normal equations for cosinor model: y = α + a*cos(ωt) + b*sin(ωt)
    const meanY = sumY / n;
    const meanCos = sumCos / n;
    const meanSin = sumSin / n;
    
    const denominator = (sumCosCos - n * meanCos * meanCos) * (sumSinSin - n * meanSin * meanSin) - 
                       Math.pow(sumCosSin - n * meanCos * meanSin, 2);
    
    if (Math.abs(denominator) < 1e-10) {
      return { amplitude: 0, acrophase: 12, reliability: 0, rSquared: 0 };
    }

    const a = ((sumYCos - n * meanY * meanCos) * (sumSinSin - n * meanSin * meanSin) - 
               (sumYSin - n * meanY * meanSin) * (sumCosSin - n * meanCos * meanSin)) / denominator;
    
    const b = ((sumYSin - n * meanY * meanSin) * (sumCosCos - n * meanCos * meanCos) - 
               (sumYCos - n * meanY * meanCos) * (sumCosSin - n * meanCos * meanSin)) / denominator;

    const amplitude = Math.sqrt(a * a + b * b);
    const acrophase = (Math.atan2(b, a) * 24 / (2 * Math.PI) + 24) % 24;

    // Calculate R²
    const yPred = domainSessions.map(s => meanY + a * Math.cos(this.omega * s.hourOfDay) + b * Math.sin(this.omega * s.hourOfDay));
    const ssRes = domainSessions.reduce((sum, s, i) => sum + Math.pow(s.normalizedScore - yPred[i], 2), 0);
    const ssTot = domainSessions.reduce((sum, s) => sum + Math.pow(s.normalizedScore - meanY, 2), 0);
    const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    const reliability = Math.min(this.rhoMax, (n / (n + this.N0)) * Math.max(0, rSquared));

    return { amplitude, acrophase, reliability, rSquared };
  }

  // Calculate sleep quality metrics
  private calculateSleepMetrics(sleepEntries: SleepEntry[]): {
    averageQuality: number;
    consistency: number;
    duration: number;
  } {
    if (sleepEntries.length === 0) {
      return { averageQuality: 0, consistency: 0, duration: 0 };
    }

    const qualities = sleepEntries.map(entry => {
      if (entry.sleepQualityScore) return entry.sleepQualityScore;
      
      // Calculate quality from bed/wake times and waking events
      const bedTime = this.parseTimeToDecimal(entry.bedTime);
      const wakeTime = this.parseTimeToDecimal(entry.wakeTime);
      let duration = wakeTime - bedTime;
      if (duration < 0) duration += 24;
      
      const durationScore = Math.min(duration / 8, 1) * 70; // 70% weight for duration
      const continuityScore = Math.max(0, 30 - (entry.wakingEvents || 0) * 5); // 30% weight for continuity
      
      return Math.min(100, durationScore + continuityScore);
    });

    const bedTimes = sleepEntries.map(entry => this.parseTimeToDecimal(entry.bedTime));
    const wakeTimes = sleepEntries.map(entry => this.parseTimeToDecimal(entry.wakeTime));
    
    const bedTimeVariance = this.calculateVariance(bedTimes);
    const wakeTimeVariance = this.calculateVariance(wakeTimes);
    const consistency = Math.max(0, 100 - (bedTimeVariance + wakeTimeVariance) * 10);

    const durations = sleepEntries.map(entry => {
      const bedTime = this.parseTimeToDecimal(entry.bedTime);
      const wakeTime = this.parseTimeToDecimal(entry.wakeTime);
      let duration = wakeTime - bedTime;
      if (duration < 0) duration += 24;
      return duration;
    });

    return {
      averageQuality: qualities.reduce((a, b) => a + b, 0) / qualities.length,
      consistency: consistency,
      duration: durations.reduce((a, b) => a + b, 0) / durations.length
    };
  }

  private parseTimeToDecimal(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + minutes / 60;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  // Generate 96-bin learning timeline
  private generateLearningTimeline(
    theoreticalPhase: number,
    cognitiveData: CognitiveSession[],
    responses: QuizResponses
  ): number[] {
    const domains = ['memory', 'attention', 'recall', 'problemSolving', 'creativity'];
    const cosinorResults = domains.map(domain => this.fitCosinorModel(cognitiveData, domain));
    
    // Generate theoretical curve
    const theoreticalCurve = Array.from({ length: 96 }, (_, i) => {
      const hour = (i * 0.25) % 24;
      const wakeTime = responses.wakeSchool ? this.parseTimeString(responses.wakeSchool) : undefined;
      return this.calculateLearningReadiness(hour, theoreticalPhase, wakeTime);
    });

    // If insufficient cognitive data, return theoretical curve
    const totalReliability = cosinorResults.reduce((sum, result) => sum + result.reliability, 0) / domains.length;
    if (totalReliability < 0.1) {
      return theoreticalCurve;
    }

    // Blend theoretical with observed data
    return theoreticalCurve.map((theoreticalValue, i) => {
      const hour = (i * 0.25) % 24;
      let observedValue = 0;
      let reliabilitySum = 0;

      cosinorResults.forEach((result, domainIndex) => {
        if (result.reliability > 0) {
          const domainValue = 0.5 * (1 + result.amplitude * Math.cos(this.omega * (hour - result.acrophase)));
          observedValue += result.reliability * domainValue;
          reliabilitySum += result.reliability;
        }
      });

      if (reliabilitySum > 0) {
        observedValue /= reliabilitySum;
        return (1 - totalReliability) * theoreticalValue + totalReliability * observedValue;
      }

      return theoreticalValue;
    });
  }

  // Original learning readiness calculation
  private calculateLearningReadiness(t: number, phi: number, wakeTime?: number): number {
    const Lc = 0.5 * (1 + Math.cos(this.omega * (t - phi)));
    const sigma = 2;
    const B = Math.exp(-Math.pow(t - 17, 2) / (2 * sigma * sigma));
    
    let I = 1;
    if (wakeTime !== undefined && t >= wakeTime && t < wakeTime + 1) {
      I = 0;
    }
    
    const beta = 0.2;
    const L = I * ((1 - beta) * Lc + beta * B);
    
    return Math.max(0, Math.min(1, L));
  }

  private calculateMeanReadiness(startTime: number, duration: number, phi: number, wakeTime?: number): number {
    const samples = 60;
    let sum = 0;
    
    for (let i = 0; i < samples; i++) {
      const t = startTime + (i * duration / samples);
      sum += this.calculateLearningReadiness(t % 24, phi, wakeTime);
    }
    
    return sum / samples;
  }

  private calculateSocialJetlagPenalty(responses: QuizResponses): number {
    const naturalWake = this.mapNaturalWakeToHours(responses.naturalWake);
    const schoolWake = responses.wakeSchool ? this.parseTimeString(responses.wakeSchool) : naturalWake;
    
    const naturalMidsleep = (naturalWake - 8 + 24) % 24;
    const actualMidsleep = (schoolWake - 8 + 24) % 24;
    
    let deltaSJ = Math.abs(actualMidsleep - naturalMidsleep);
    if (deltaSJ > 12) deltaSJ = 24 - deltaSJ;
    
    const k = 0.03;
    return Math.exp(-k * deltaSJ * deltaSJ);
  }

  // Calculate observed performance alignment
  private calculateObservedAlignment(
    cognitiveData: CognitiveSession[],
    schoolWindow: { startTime: number; duration: number },
    studyWindow: { startTime: number; duration: number }
  ): { school: number; study: number } {
    const schoolSessions = cognitiveData.filter(s => 
      s.hourOfDay >= schoolWindow.startTime && 
      s.hourOfDay <= schoolWindow.startTime + schoolWindow.duration
    );
    
    const studySessions = cognitiveData.filter(s =>
      s.hourOfDay >= studyWindow.startTime && 
      s.hourOfDay <= studyWindow.startTime + studyWindow.duration
    );

    const schoolMean = schoolSessions.length > 0 
      ? schoolSessions.reduce((sum, s) => sum + s.normalizedScore, 0) / schoolSessions.length
      : 0;
    
    const studyMean = studySessions.length > 0
      ? studySessions.reduce((sum, s) => sum + s.normalizedScore, 0) / studySessions.length
      : 0;

    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    
    return {
      school: sigmoid(schoolMean),
      study: sigmoid(studyMean)
    };
  }

  // Main enhanced calculation
  calculateEnhancedSync(
    responses: QuizResponses,
    cognitiveData: CognitiveSession[] = [],
    sleepData: SleepEntry[] = []
  ): EnhancedSyncResults {
    // Calculate base learning acrophase
    const phi = this.calculateLearningAcrophase(responses);
    
    // Get schedule windows
    const schoolWindow = this.mapSchoolStartToWindow(responses.schoolStart);
    const homeworkWindow = this.mapHomeworkTimeToWindow(
      responses.homeworkTime, 
      schoolWindow.startTime + schoolWindow.duration
    );
    
    // Calculate theoretical alignments
    const wakeTime = responses.wakeSchool ? this.parseTimeString(responses.wakeSchool) : undefined;
    const schoolAlignment = this.calculateMeanReadiness(
      schoolWindow.startTime, 
      schoolWindow.duration, 
      phi, 
      wakeTime
    );
    const studyAlignment = this.calculateMeanReadiness(
      homeworkWindow.startTime, 
      homeworkWindow.duration, 
      phi, 
      wakeTime
    );

    // Calculate cognitive performance reliability
    const domains = ['memory', 'attention', 'recall', 'problemSolving', 'creativity'];
    const cosinorResults = domains.map(domain => this.fitCosinorModel(cognitiveData, domain));
    const domainReliability: Record<string, number> = {};
    let overallReliability = 0;

    domains.forEach((domain, i) => {
      domainReliability[domain] = cosinorResults[i].reliability;
      overallReliability += cosinorResults[i].reliability;
    });
    overallReliability /= domains.length;

    // Calculate observed alignment if sufficient data
    const observedAlignment = this.calculateObservedAlignment(
      cognitiveData, schoolWindow, homeworkWindow
    );

    // Calculate sleep metrics
    const sleepMetrics = this.calculateSleepMetrics(sleepData);
    
    // Social jetlag penalty (enhanced with sleep consistency)
    let socialJetlagPenalty = this.calculateSocialJetlagPenalty(responses);
    if (sleepMetrics.consistency > 0) {
      socialJetlagPenalty *= (0.8 + 0.2 * (sleepMetrics.consistency / 100));
    }

    // Calculate adaptive sync score
    const ws = 0.7, wh = 0.3;
    const predictedScore = ws * schoolAlignment + wh * studyAlignment;
    const observedScore = ws * observedAlignment.school + wh * observedAlignment.study;
    
    const adaptiveSyncScore = Math.round(100 * socialJetlagPenalty * [
      (1 - overallReliability) * predictedScore + overallReliability * observedScore
    ][0]);

    // Apply sleep quality bonus/penalty
    let finalSyncScore = adaptiveSyncScore;
    if (sleepMetrics.averageQuality > 0) {
      const sleepBonus = (sleepMetrics.averageQuality - 70) * 0.1; // +/- 3 points per 10 quality points above/below 70
      finalSyncScore = Math.round(adaptiveSyncScore + sleepBonus);
    }

    // Generate learning timeline
    const learningTimeline = this.generateLearningTimeline(phi, cognitiveData, responses);

    return {
      syncScore: Math.max(0, Math.min(100, finalSyncScore)),
      schoolAlignment: Math.round(schoolAlignment * 100),
      studyAlignment: Math.round(studyAlignment * 100),
      learningPhase: Math.round(phi * 10) / 10,
      socialJetlagPenalty: Math.round(socialJetlagPenalty * 100),
      adaptiveComponents: {
        observedAlignment,
        predictedAlignment: {
          school: schoolAlignment,
          study: studyAlignment
        },
        adaptationLevel: overallReliability,
        domainReliability
      },
      sleepMetrics,
      learningTimeline,
      chronotype: this.determineChronotype(phi)
    };
  }

  private determineChronotype(learningPhase: number): { chronotype: string; outOfSync: number } {
    let chronotype: string;
    let outOfSync: number;
    
    if (learningPhase < 10) {
      chronotype = 'Lion';
      outOfSync = Math.abs(learningPhase - 8) * 5;
    } else if (learningPhase < 14) {
      chronotype = 'Bear';
      outOfSync = Math.abs(learningPhase - 12) * 4;
    } else if (learningPhase < 18) {
      chronotype = 'Wolf';
      outOfSync = Math.abs(learningPhase - 16) * 5;
    } else {
      chronotype = 'Dolphin';
      outOfSync = Math.min(Math.abs(learningPhase - 20), Math.abs(learningPhase - 6)) * 6;
    }
    
    return {
      chronotype,
      outOfSync: Math.round(Math.min(100, Math.max(0, outOfSync)))
    };
  }
}

// Enhanced usage function
export function calculateEnhancedSyncScore(
  responses: QuizResponses,
  cognitiveData: CognitiveSession[] = [],
  sleepData: SleepEntry[] = []
) {
  const calculator = new EnhancedSyncScoreCalculator();
  return calculator.calculateEnhancedSync(responses, cognitiveData, sleepData);
}

export type { 
  QuizResponses, 
  CognitiveSession, 
  SleepEntry, 
  EnhancedSyncResults 
};