// utils/shiftingChallengeLogic.ts
export interface ShiftingStrategy {
  name: string
  description: string
  maxShiftPerDay: number // minutes
  restDaysRequired: boolean
  lightExposureRecommended: boolean
}

export const JET_LAG_STRATEGIES: ShiftingStrategy[] = [
  {
    name: 'Gradual Advance (Early Bird)',
    description: 'Shift bedtime earlier by 15-30 minutes per day',
    maxShiftPerDay: 30,
    restDaysRequired: false,
    lightExposureRecommended: true
  },
  {
    name: 'Gradual Delay (Night Owl)',
    description: 'Shift bedtime later by 15-30 minutes per day',
    maxShiftPerDay: 30,
    restDaysRequired: false,
    lightExposureRecommended: true
  },
  {
    name: 'Anchor Sleep Method',
    description: 'Keep wake time consistent while adjusting bedtime',
    maxShiftPerDay: 15,
    restDaysRequired: false,
    lightExposureRecommended: true
  },
  {
    name: 'Core Sleep Plus Nap',
    description: 'Maintain core sleep window with strategic naps',
    maxShiftPerDay: 45,
    restDaysRequired: true,
    lightExposureRecommended: true
  },
  {
    name: 'Light Exposure Protocol',
    description: 'Use bright light to shift circadian rhythm',
    maxShiftPerDay: 20,
    restDaysRequired: false,
    lightExposureRecommended: true
  },
  {
    name: 'Fasting Window Adjustment',
    description: 'Align meal times with target sleep schedule',
    maxShiftPerDay: 25,
    restDaysRequired: false,
    lightExposureRecommended: true
  },
  {
    name: 'Weekend Reset Method',
    description: 'Make larger shifts on weekends, maintain during week',
    maxShiftPerDay: 60,
    restDaysRequired: true,
    lightExposureRecommended: true
  }
]

export const calculateShiftingPlan = (
  currentSleepTime: string,
  currentWakeTime: string,
  targetWakeTime: string,
  syncImprovementNeeded: number, // 0-100 scale
  selectedStrategy: ShiftingStrategy
) => {
  const current = new Date(`2024-01-01T${currentSleepTime}`)
  const target = new Date(`2024-01-01T${targetWakeTime}`)
  
  let totalShiftMinutes = (target.getTime() - current.getTime()) / (1000 * 60)
  
  // Adjust for day wrap
  if (totalShiftMinutes < -720) totalShiftMinutes += 1440
  if (totalShiftMinutes > 720) totalShiftMinutes -= 1440
  
  const dailyShift = Math.min(
    Math.abs(totalShiftMinutes) / 7, // Spread over week
    selectedStrategy.maxShiftPerDay
  )
  
  const estimatedDays = Math.ceil(Math.abs(totalShiftMinutes) / dailyShift)
  
  return {
    totalShiftMinutes,
    dailyShiftMinutes: dailyShift,
    estimatedDays,
    direction: totalShiftMinutes > 0 ? 'advance' : 'delay',
    strategy: selectedStrategy,
    milestones: generateMilestones(currentSleepTime, dailyShift, estimatedDays, totalShiftMinutes > 0)
  }
}

const generateMilestones = (
  startTime: string,
  dailyShift: number,
  days: number,
  advancing: boolean
) => {
  const milestones = []
  let current = new Date(`2024-01-01T${startTime}`)
  
  for (let i = 1; i <= days; i++) {
    const shiftAmount = advancing ? dailyShift : -dailyShift
    current = new Date(current.getTime() + shiftAmount * 60 * 1000)
    
    milestones.push({
      day: i,
      targetTime: current.toTimeString().slice(0, 5),
      toleranceWindow: 15 // minutes
    })
  }
  
  return milestones
}