// utils/challengeTypes.ts

// Base Challenge interface
export interface Challenge {
  id: string;
  title: string;
  description: string;
  duration: number; // in days
  points: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ChallengeRequirement {
  type: 'time' | 'frequency' | 'duration' | 'checklist' | 'comparison'
  field: string
  target?: any
  validation?: (value: any, userData: any) => boolean
}

export interface EnhancedChallenge extends Challenge {
  category: 'shifting' | 'sleep-hygiene' | 'diet-caffeine' | 'cognitive'
  requirements: ChallengeRequirement[]
  setupQuestions?: SetupQuestion[]
  autoTrack?: boolean // If true, pulls from existing Firebase data
  manualTrack?: boolean // If true, requires user input
}

export interface SetupQuestion {
  id: string
  question: string
  type: 'time' | 'select' | 'number' | 'multiselect'
  options?: string[]
  validation?: (value: any) => boolean
  helperText?: string
}
