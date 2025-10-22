"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/firebase/config';
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const DECISION_ZONE = 150;

// TypeScript interfaces
interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
  canDoubleJump: boolean;
  isDoubleJumping: boolean;
  color: string;
  rotation: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  colorName: string;
  isTarget: boolean;
  enteredDecisionZoneAt: number | null;
  reactionLogged: boolean;
}

interface TargetStats {
  total: number;
  hit: number;
  missed: number;
}

interface DistanceLog {
  time: number;
  score: number;
}

interface GameMetrics {
  avgRT: number | null;
  adaptation: number | null;
  totalTargets: number;
  targetsHit: number;
  targetsMissed: number;
  riskScore: string | null;
  distanceLog: DistanceLog[];
  finalScore: number;
}

interface UserStats {
  bestScore: number;
  totalSessionsPlayed: number;
  totalPlayTime: number;
  averageReactionTime: number;
  averageTargetAccuracy: number;
  bestReactionTime: number;
  lastPlayed: string;
  sessions: any[];
  cognitiveProfile: {
    reactionTime: number;
    adaptationSpeed: number;
    riskTaking: number;
    attentionalFlexibility: number;
    executiveControl: number;
  };
}

interface SessionData {
  sessionOverview: {
    sessionStart: number;
    sessionEnd: number;
    totalSessionDuration: number;
    gameType: string;
  };
  performance: {
    finalScore: number;
    averageReactionTime: number;
    bestReactionTime: number;
    targetAccuracy: number;
    totalTargets: number;
    targetsHit: number;
    targetsMissed: number;
    adaptationDelay: number;
  };
  cognitiveMetrics: {
    reactionTime: number;
    adaptationSpeed: number;
    riskTaking: number;
    attentionalFlexibility: number;
    executiveControl: number;
    cognitiveLoad: number;
  };
  detailedLogs: {
    reactionTimes: number[];
    baselineReactions: number[];
    switchReactions: number[];
    targetStats: TargetStats;
    distanceProgression: DistanceLog[];
    colorSwitchAnalysis: {
      totalColorSwitches: number;
      adaptationAttempts: number;
      averageAdaptationTime: number;
      flexibilityIndex: number;
    };
  };
}

interface TrailParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  maxAge: number;
  age: number;
  color: string;
  update(): void;
  shouldRemove(): boolean;
}

interface SparkParticle {
  x: number;
  y: number;
  color: string;
  velocityX: number;
  velocityY: number;
  size: number;
  opacity: number;
  maxAge: number;
  age: number;
  update(): void;
  shouldRemove(): boolean;
}

type GameState = 'ready' | 'playing' | 'gameOver';

const RunnerGame: React.FC = () => {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Cognitive test metrics
  const reactionTimesRef = useRef<number[]>([]);
  const baselineReactionsRef = useRef<number[]>([]);
  const switchReactionsRef = useRef<number[]>([]);
  const hasLoggedAdaptationRef = useRef<boolean>(false);
  const colorChangeTimeRef = useRef<number>(Date.now());
  const targetStatsRef = useRef<TargetStats>({ total: 0, hit: 0, missed: 0 });
  const distanceLogRef = useRef<DistanceLog[]>([]);
  const sessionStartTimeRef = useRef<number>(Date.now());
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [lastGameMetrics, setLastGameMetrics] = useState<GameMetrics | null>(null);
  
  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');
  
  // Color system
  const gameColors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
  const colorNames = ['Blue', 'Green', 'Orange', 'Pink'];
  const [playerColor, setPlayerColor] = useState<string>('#3B82F6');
  const [playerColorName, setPlayerColorName] = useState<string>('Blue');
  const lastColorChangeRef = useRef<number>(Date.now());
  const colorChangeDuration = 10000;
  
  // Game objects
  const playerRef = useRef<Player>({
    x: 100,
    y: 300,
    width: 40,
    height: 40,
    velocityY: 0,
    isJumping: false,
    canDoubleJump: false,
    isDoubleJumping: false,
    color: '#3B82F6',
    rotation: 0
  });
  
  const obstaclesRef = useRef<Obstacle[]>([]);
  const gameSpeedRef = useRef<number>(4);
  const lastObstacleRef = useRef<number>(0);
  const groundY = 340;
  const particlesRef = useRef<TrailParticle[]>([]);
  const sparkParticlesRef = useRef<SparkParticle[]>([]);
  
  // Game constants
  const GRAVITY = 0.8;
  const JUMP_FORCE = -16;
  const MIN_OBSTACLE_DISTANCE = 250;
  const MAX_OBSTACLE_DISTANCE = 400;

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadUserStats(user.uid);
      } else {
        setUserId(null);
        setUserStats(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load user stats from Firestore
  const loadUserStats = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          if (data.colorRunnerGame) {
            setUserStats(data.colorRunnerGame as UserStats);
            setHighScore(data.colorRunnerGame.bestScore || 0);
          }
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  // Save session data to Firestore
  const saveSessionData = async (sessionMetrics: SessionData): Promise<void> => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage');
      const savedSessions = JSON.parse(localStorage.getItem('colorRunnerSessions') || '[]');
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10); // Keep last 10 sessions
      localStorage.setItem('colorRunnerSessions', JSON.stringify(updatedSessions));
      return;
    }

    setIsLoading(true);
    setSaveError('');

    try {
      const userDocRef = doc(db, 'users', userId);
      
      // Calculate session stats
      const sessionDuration = sessionMetrics.sessionOverview.totalSessionDuration;
      const avgReactionTime = sessionMetrics.performance.averageReactionTime;
      const bestScore = sessionMetrics.performance.finalScore;
      const accuracy = sessionMetrics.performance.targetAccuracy;

      // Update user's game stats
      await setDoc(userDocRef, {
        colorRunnerGame: {
          bestScore: Math.max(bestScore, userStats?.bestScore || 0),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalPlayTime: (userStats?.totalPlayTime || 0) + sessionDuration,
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalSessionsPlayed || 0,
            avgReactionTime
          ),
          averageTargetAccuracy: calculateRunningAverage(
            userStats?.averageTargetAccuracy || 0,
            userStats?.totalSessionsPlayed || 0,
            accuracy
          ),
          bestReactionTime: Math.min(avgReactionTime, userStats?.bestReactionTime || Infinity),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), sessionMetrics].slice(-10), // Keep last 10 sessions
          cognitiveProfile: {
            reactionTime: avgReactionTime,
            adaptationSpeed: sessionMetrics.cognitiveMetrics.adaptationSpeed,
            riskTaking: sessionMetrics.cognitiveMetrics.riskTaking,
            attentionalFlexibility: sessionMetrics.cognitiveMetrics.attentionalFlexibility,
            executiveControl: sessionMetrics.cognitiveMetrics.executiveControl
          }
        }
      }, { merge: true });

      // Save detailed session data in separate collection
     await addDoc(collection(db, 'users', userId, 'gameSessionsDetailed'), {
        userId,
        gameType: 'colorRunner',
        ...sessionMetrics,
        createdAt: new Date()
      });

      console.log('Color Runner session saved successfully');
    } catch (error) {
      console.error('Error saving session data:', error);
      setSaveError('Failed to save session data. Your progress may not be synced.');
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('colorRunnerSessions') || '[]');
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10);
      localStorage.setItem('colorRunnerSessions', JSON.stringify(updatedSessions));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue;
    return Math.round(((currentAvg * count) + newValue) / (count + 1));
  };

  // Generate session data for saving
  const generateSessionData = (metrics: GameMetrics): SessionData => {
    const sessionEnd = Date.now();
    const totalDuration = sessionEnd - sessionStartTimeRef.current;

    return {
      sessionOverview: {
        sessionStart: sessionStartTimeRef.current,
        sessionEnd,
        totalSessionDuration: totalDuration,
        gameType: 'colorRunner'
      },
      performance: {
        finalScore: metrics.finalScore,
        averageReactionTime: metrics.avgRT || 0,
        bestReactionTime: metrics.avgRT ? Math.min(...reactionTimesRef.current) : 0,
        targetAccuracy: metrics.riskScore ? parseFloat(metrics.riskScore) * 100 : 0,
        totalTargets: metrics.totalTargets,
        targetsHit: metrics.targetsHit,
        targetsMissed: metrics.targetsMissed,
        adaptationDelay: metrics.adaptation || 0
      },
      cognitiveMetrics: {
        reactionTime: metrics.avgRT || 0,
        adaptationSpeed: calculateAdaptationSpeed(),
        riskTaking: calculateRiskTaking(),
        attentionalFlexibility: calculateAttentionalFlexibility(),
        executiveControl: calculateExecutiveControl(),
        cognitiveLoad: calculateCognitiveLoad()
      },
      detailedLogs: {
        reactionTimes: reactionTimesRef.current,
        baselineReactions: baselineReactionsRef.current,
        switchReactions: switchReactionsRef.current,
        targetStats: targetStatsRef.current,
        distanceProgression: distanceLogRef.current,
        colorSwitchAnalysis: generateColorSwitchAnalysis()
      }
    };
  };

  // Cognitive analysis helper functions
  const calculateAdaptationSpeed = (): number => {
    const base = baselineReactionsRef.current;
    const sw = switchReactionsRef.current;
    const avgBase = base.length ? base.reduce((a, b) => a + b, 0) / base.length : 0;
    const avgSwitch = sw.length ? sw.reduce((a, b) => a + b, 0) / sw.length : 0;
    
    if (avgBase === 0 || avgSwitch === 0) return 100;
    
    const adaptationEffect = ((avgSwitch - avgBase) / avgBase) * 100;
    return Math.max(0, 100 - Math.abs(adaptationEffect)); // Higher score = better adaptation
  };

  const calculateRiskTaking = (): number => {
    const { total, hit, missed } = targetStatsRef.current;
    if (total === 0) return 50; // Neutral score
    
    const attemptRate = (hit + missed) / total; // How often they tried to collect
    const successRate = hit > 0 ? hit / (hit + missed) : 0; // Success when attempting
    
    return Math.round((attemptRate * 50) + (successRate * 50)); // Balanced risk-taking score
  };

  const calculateAttentionalFlexibility = (): number => {
    const colorSwitches = Math.floor((Date.now() - sessionStartTimeRef.current) / colorChangeDuration);
    if (colorSwitches === 0) return 100;
    
    const switchReactions = switchReactionsRef.current;
    const avgSwitchRT = switchReactions.length ? 
      switchReactions.reduce((a, b) => a + b, 0) / switchReactions.length : 0;
    
    if (avgSwitchRT === 0) return 100;
    
    // Lower reaction times after switches = better flexibility
    return Math.max(0, Math.min(100, 100 - ((avgSwitchRT - 300) / 10)));
  };

  const calculateExecutiveControl = (): number => {
    const allReactions = reactionTimesRef.current;
    if (allReactions.length < 2) return 100;
    
    // Calculate consistency (lower variance = better control)
    const mean = allReactions.reduce((a, b) => a + b, 0) / allReactions.length;
    const variance = allReactions.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / allReactions.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation
    
    return Math.max(0, Math.min(100, 100 - (cv * 100)));
  };

  const calculateCognitiveLoad = (): number => {
    const { total, hit, missed } = targetStatsRef.current;
    const reactionCount = reactionTimesRef.current.length;
    
    if (reactionCount === 0) return 0;
    
    // Higher cognitive load = more decisions made under pressure
    const decisionDensity = (total + reactionCount) / (score / 10 || 1); // Decisions per distance unit
    return Math.min(100, decisionDensity * 10);
  };

  const generateColorSwitchAnalysis = () => {
    const colorSwitches = Math.floor((Date.now() - sessionStartTimeRef.current) / colorChangeDuration);
    
    return {
      totalColorSwitches: colorSwitches,
      adaptationAttempts: switchReactionsRef.current.length,
      averageAdaptationTime: switchReactionsRef.current.length > 0 ? 
        switchReactionsRef.current.reduce((a, b) => a + b, 0) / switchReactionsRef.current.length : 0,
      flexibilityIndex: calculateAttentionalFlexibility()
    };
  };

  // Auto-save when returning to game selection
  const handleReturnToGameSelection = async (): Promise<void> => {
    if (lastGameMetrics) {
      const sessionData = generateSessionData(lastGameMetrics);
      await saveSessionData(sessionData);
    }
    router.push('/Prep/PrepGames/GameSelection');
  };
  
  // Particle classes
  class TrailParticle implements TrailParticle {
    x: number;
    y: number;
    size: number;
    opacity: number;
    maxAge: number;
    age: number;
    color: string;

    constructor(x: number, y: number, isDoubleJump: boolean = false) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 8 + 4;
      this.opacity = 0.9;
      this.maxAge = 30 + Math.random() * 15;
      this.age = 0;
      this.color = isDoubleJump ? '#EC4899' : playerColor;
    }
    
    update(): void {
      this.age++;
      this.opacity = (1 - (this.age / this.maxAge)) * 0.9;
      this.size *= 0.96;
      this.x -= 2;
    }
    
    shouldRemove(): boolean {
      return this.age >= this.maxAge || this.opacity <= 0.1;
    }
  }
  
  class SparkParticle implements SparkParticle {
    x: number;
    y: number;
    color: string;
    velocityX: number;
    velocityY: number;
    size: number;
    opacity: number;
    maxAge: number;
    age: number;

    constructor(x: number, y: number, color: string) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * 2 * Math.PI;
      const speed = 3 + Math.random() * 6;
      this.velocityX = Math.cos(angle) * speed;
      this.velocityY = Math.sin(angle) * speed;
      this.size = 4 + Math.random() * 6;
      this.opacity = 1.0;
      this.maxAge = 30 + Math.random() * 20;
      this.age = 0;
    }
    
    update(): void {
      this.age++;
      this.x += this.velocityX;
      this.y += this.velocityY;
      this.velocityY += 0.3;
      this.velocityX *= 0.98;
      this.velocityY *= 0.98;
      this.opacity = (1 - (this.age / this.maxAge));
      this.size *= 0.96;
    }
    
    shouldRemove(): boolean {
      return this.age >= this.maxAge || this.opacity <= 0.1 || this.size <= 1;
    }
  }
  
  // Initialize game
  const initGame = useCallback((): void => {
    const player = playerRef.current;
    player.x = 100;
    player.y = 300;
    player.velocityY = 0;
    player.isJumping = false;
    player.canDoubleJump = false;
    player.isDoubleJumping = false;
    player.rotation = 0;
    player.color = '#3B82F6';
    
    obstaclesRef.current = [];
    gameSpeedRef.current = 4;
    lastObstacleRef.current = 0;
    particlesRef.current = [];
    sparkParticlesRef.current = [];
    setScore(0);
    
    // Reset cognitive metrics
    reactionTimesRef.current = [];
    baselineReactionsRef.current = [];
    switchReactionsRef.current = [];
    hasLoggedAdaptationRef.current = false;
    targetStatsRef.current = { total: 0, hit: 0, missed: 0 };
    distanceLogRef.current = [];
    sessionStartTimeRef.current = Date.now();
    
    // Reset color system
    setPlayerColor('#3B82F6');
    setPlayerColorName('Blue');
    lastColorChangeRef.current = Date.now();
    colorChangeTimeRef.current = Date.now();
  }, []);
  
  // Log distance periodically
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      distanceLogRef.current.push({ time: Date.now(), score });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [score, gameState]);
  
  // Change player color
  const changePlayerColor = useCallback((): void => {
    const randomIndex = Math.floor(Math.random() * gameColors.length);
    const newColor = gameColors[randomIndex];
    const newColorName = colorNames[randomIndex];
    
    setPlayerColor(newColor);
    setPlayerColorName(newColorName);
    playerRef.current.color = newColor;
    lastColorChangeRef.current = Date.now();
    colorChangeTimeRef.current = Date.now();
    hasLoggedAdaptationRef.current = false;
  }, []);
  
  // Check if colors match
  const colorsMatch = useCallback((color1: string, color2: string): boolean => {
    return color1 === color2;
  }, []);
  
  // Handle jump with reaction time tracking
  const jump = useCallback((): void => {
    const player = playerRef.current;
    
    if (gameState !== 'playing') return;
    
    // Track reaction time for nearby obstacles
    const nearbyObstacle = obstaclesRef.current.find(
      (o) =>
        o.enteredDecisionZoneAt &&
        !o.reactionLogged &&
        Math.abs(o.x - player.x) <= DECISION_ZONE
    );
    
    if (nearbyObstacle && nearbyObstacle.enteredDecisionZoneAt) {
      const rt = Date.now() - nearbyObstacle.enteredDecisionZoneAt;
      reactionTimesRef.current.push(rt);
      
      // Check if this is within adaptation period (10 seconds after color change)
      if (
        !hasLoggedAdaptationRef.current &&
        Date.now() - colorChangeTimeRef.current < 10000
      ) {
        switchReactionsRef.current.push(rt);
        hasLoggedAdaptationRef.current = true;
      } else {
        baselineReactionsRef.current.push(rt);
      }
      nearbyObstacle.reactionLogged = true;
    }
    
    if (!player.isJumping) {
      player.velocityY = JUMP_FORCE;
      player.isJumping = true;
      player.canDoubleJump = true;
      player.isDoubleJumping = false;
    } else if (player.canDoubleJump && !player.isDoubleJumping) {
      player.velocityY = JUMP_FORCE * 0.8;
      player.isDoubleJumping = true;
      player.canDoubleJump = false;
    }
  }, [gameState]);
  
  // Generate obstacles
  const generateObstacle = useCallback((canvasWidth: number): void => {
    const obstacles = obstaclesRef.current;
    const lastObstacle = obstacles[obstacles.length - 1];
    
    const shouldSpawn = !lastObstacle || 
      (canvasWidth - lastObstacle.x > MIN_OBSTACLE_DISTANCE + Math.random() * (MAX_OBSTACLE_DISTANCE - MIN_OBSTACLE_DISTANCE));
    
    if (shouldSpawn) {
      const obstacleHeight = 50 + Math.random() * 40;
      const obstacleWidth = 35;
      
      let obstacleColor: string, obstacleColorName: string, isTarget: boolean;
      
      if (Math.random() < 0.5) {
        isTarget = true;
        if (Math.random() < 0.6) {
          obstacleColor = playerColor;
          obstacleColorName = playerColorName;
        } else {
          const otherColors = gameColors.filter(c => c !== playerColor);
          const randomIndex = Math.floor(Math.random() * otherColors.length);
          obstacleColor = otherColors[randomIndex];
          obstacleColorName = colorNames[gameColors.indexOf(obstacleColor)];
        }
      } else {
        obstacleColor = '#EF4444';
        obstacleColorName = 'Red';
        isTarget = false;
      }
      
      // Track target generation
      if (isTarget && obstacleColor === playerColor) {
        targetStatsRef.current.total += 1;
      }
      
      obstacles.push({
        x: canvasWidth + 50,
        y: groundY - obstacleHeight,
        width: obstacleWidth,
        height: obstacleHeight,
        color: obstacleColor,
        colorName: obstacleColorName,
        isTarget: isTarget,
        enteredDecisionZoneAt: null,
        reactionLogged: false
      });
    }
  }, [playerColor, playerColorName]);
  
  // Check collision
  const checkCollision = useCallback((rect1: Player, rect2: Obstacle): boolean => {
    const playerLeft = rect1.x;
    const playerRight = rect1.x + rect1.width;
    const playerTop = rect1.y - rect1.height;
    const playerBottom = rect1.y;
    
    const obstacleLeft = rect2.x;
    const obstacleRight = rect2.x + rect2.width;
    const obstacleTop = rect2.y;
    const obstacleBottom = rect2.y + rect2.height;
    
    return playerLeft < obstacleRight &&
           playerRight > obstacleLeft &&
           playerTop < obstacleBottom &&
           playerBottom > obstacleTop;
  }, []);
  
  // Create spark effect
  const createSparks = useCallback((x: number, y: number, color: string): void => {
    const sparks = sparkParticlesRef.current;
    for (let i = 0; i < 12; i++) {
      sparks.push(new SparkParticle(x, y, color));
    }
  }, []);
  
  // Calculate and display metrics
  const calculateMetrics = useCallback(async (): Promise<GameMetrics> => {
    const rtList = reactionTimesRef.current;
    const avgRT = rtList.length
      ? Math.round(rtList.reduce((a, b) => a + b, 0) / rtList.length)
      : null;
    
    const base = baselineReactionsRef.current;
    const sw = switchReactionsRef.current;
    const avgBase = base.length ? base.reduce((a, b) => a + b, 0) / base.length : 0;
    const avgSwitch = sw.length ? sw.reduce((a, b) => a + b, 0) / sw.length : 0;
    const adaptation = avgSwitch && avgBase ? Math.round(avgSwitch - avgBase) : null;
    
    const { total, hit, missed } = targetStatsRef.current;
    const riskScore = hit + missed > 0 ? (hit / (hit + missed)) : null;
    
    const metrics: GameMetrics = {
      avgRT,
      adaptation,
      totalTargets: total,
      targetsHit: hit,
      targetsMissed: missed,
      riskScore: riskScore?.toFixed(2) || null,
      distanceLog: distanceLogRef.current,
      finalScore: score
    };
    
    console.log('--- GAME METRICS ---');
    console.log('Average RT:', avgRT);
    console.log('Adaptation (Switch - Base):', adaptation);
    console.log('Targets — Total:', total, 'Hit:', hit, 'Missed:', missed);
    console.log('Risk Score:', riskScore?.toFixed(2));
    console.log('Score vs Time:', distanceLogRef.current);
    
    setLastGameMetrics(metrics);
    setShowMetrics(true);
    
    // Auto-save metrics to Firestore
    const sessionData = generateSessionData(metrics);
    await saveSessionData(sessionData);
    
    return metrics;
  }, [score, saveSessionData, generateSessionData]);
  
  // Update game logic
  const updateGame = useCallback((): void => {
    if (gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const player = playerRef.current;
    const obstacles = obstaclesRef.current;
    
    // Update player physics
    player.velocityY += GRAVITY;
    player.y += player.velocityY;
    
    if (player.y >= 300) {
      player.y = 300;
      player.velocityY = 0;
      player.isJumping = false;
      player.canDoubleJump = false;
      player.isDoubleJumping = false;
      player.rotation = 0;
    }
    
    if (player.isJumping) {
      player.rotation += 0.2;
      if (player.rotation > 2 * Math.PI) {
        player.rotation = 0;
      }
    }
    
    player.color = playerColor;
    
    // Check for color changes
    const now = Date.now();
    if (now - lastColorChangeRef.current >= colorChangeDuration) {
      changePlayerColor();
    }
    
    // Track when obstacles enter decision zone
    obstacles.forEach((obstacle) => {
      if (
        !obstacle.enteredDecisionZoneAt &&
        obstacle.x <= player.x + DECISION_ZONE
      ) {
        obstacle.enteredDecisionZoneAt = Date.now();
      }
    });
    
    // Generate obstacles
    generateObstacle(canvas.width);
    
    // Update trail particles
    const trails = particlesRef.current;
    if (Math.random() < 0.3) {
      trails.push(new TrailParticle(
        player.x + player.width / 2,
        player.y - player.height / 2,
        player.isDoubleJumping
      ));
    }
    
    particlesRef.current = trails.filter(particle => {
      particle.update();
      return !particle.shouldRemove();
    });
    
    sparkParticlesRef.current = sparkParticlesRef.current.filter(particle => {
      particle.update();
      return !particle.shouldRemove();
    });
    
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= gameSpeedRef.current;
      
      // Check collision
      if (checkCollision(player, obstacle)) {
        if (obstacle.isTarget && colorsMatch(obstacle.color, playerColor)) {
          // Correct color match - collect target
          targetStatsRef.current.hit += 1;
          createSparks(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.color);
          setScore(prev => prev + 50);
          obstacles.splice(i, 1);
          continue;
        } else {
          // Wrong color or red obstacle - game over
          setGameState('gameOver');
          setHighScore(prev => Math.max(prev, score));
          calculateMetrics();
          return;
        }
      }
      
      // Remove off-screen obstacles
      if (obstacle.x + obstacle.width < 0) {
        if (obstacle.isTarget && obstacle.color === playerColor) {
          targetStatsRef.current.missed += 1;
        }
        obstacles.splice(i, 1);
        
        if (!obstacle.isTarget) {
          setScore(prev => prev + 10);
        }
      }
    }
    
    // Increase game speed
    gameSpeedRef.current = 4 + Math.floor(score / 100) * 0.5;
  }, [gameState, score, playerColor, changePlayerColor, generateObstacle, checkCollision, colorsMatch, createSparks, calculateMetrics]);
  
  // Render game
  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const player = playerRef.current;
    const obstacles = obstaclesRef.current;
    
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1b3a');
    gradient.addColorStop(0.5, '#2d1b69');
    gradient.addColorStop(1, '#42307d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw moving background particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 30; i++) {
      const x = (i * 50 + (Date.now() * 0.05) % canvas.width) % canvas.width;
      const y = 50 + (i * 20) % (canvas.height - 100);
      ctx.fillRect(x, y, 2, 2);
    }
    
    // Draw ground
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, groundY - 2, canvas.width, 2);
    
    // Draw trail particles
    particlesRef.current.forEach(particle => {
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = particle.opacity * 0.3;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Draw spark particles
    sparkParticlesRef.current.forEach(particle => {
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Draw player
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y - player.height / 2);
    ctx.rotate(player.rotation);
    
    ctx.shadowColor = player.color;
    ctx.shadowBlur = player.isJumping ? 20 : 10;
    
    ctx.fillStyle = player.color;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-player.width / 2 + 8, -player.height / 2 + 8, 6, 6);
    ctx.fillRect(-player.width / 2 + 26, -player.height / 2 + 8, 6, 6);
    
    if (player.canDoubleJump) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-player.width / 2 + 4, -player.height / 2 + 4, player.width - 8, player.height - 8);
    }
    
    ctx.restore();
    
    // Draw obstacles
    obstacles.forEach(obstacle => {
      ctx.shadowColor = obstacle.color;
      ctx.shadowBlur = 15;
      
      ctx.fillStyle = obstacle.color;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      
      if (obstacle.isTarget) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, obstacle.height - 4);
      }
    });
    
    ctx.shadowBlur = 0;
    
    // Draw UI
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.fillText(`Speed: ${gameSpeedRef.current.toFixed(1)}x`, 20, 70);
    ctx.fillText(`High Score: ${highScore}`, canvas.width - 200, 40);
    
    // Color indicator
    const timeLeft = Math.max(0, colorChangeDuration - (Date.now() - lastColorChangeRef.current));
    ctx.fillStyle = playerColor;
    ctx.fillRect(canvas.width - 120, 60, 100, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(playerColorName, canvas.width - 115, 80);
    ctx.font = '12px Arial';
    ctx.fillText(`${Math.ceil(timeLeft / 1000)}s`, canvas.width - 115, 95);
    
    // Game state overlays
    if (gameState === 'ready') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('COLOR RUNNER', canvas.width / 2, canvas.height / 2 - 60);
      
      ctx.font = 'bold 20px Arial';
      ctx.fillText('Match colors to collect targets!', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText('Jump over everything else!', canvas.width / 2, canvas.height / 2 + 10);
      
      ctx.font = 'bold 18px Arial';
      ctx.fillText('Your color changes every 10 seconds', canvas.width / 2, canvas.height / 2 + 40);
      
      ctx.fillText('Press SPACE or CLICK to start', canvas.width / 2, canvas.height / 2 + 70);
      ctx.textAlign = 'left';
    }
    
    if (gameState === 'gameOver') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 10);
      ctx.fillText('Press ENTER to restart', canvas.width / 2, canvas.height / 2 + 50);
      ctx.textAlign = 'left';
    }
  }, [gameState, score, highScore, playerColor, playerColorName]);
  
  // Game loop
  const gameLoop = useCallback((): void => {
    updateGame();
    render();
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, render]);
  
  // Start game
  const startGame = useCallback((): void => {
    initGame();
    setGameState('playing');
    setShowMetrics(false);
    setSaveError('');
  }, [initGame]);
  
  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = true;
      
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
      
      if (e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'ready' || gameState === 'gameOver') {
          startGame();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jump, startGame, gameState]);
  
  // Handle canvas click
  const handleCanvasClick = useCallback((): void => {
    if (gameState === 'playing') {
      jump();
    } else if (gameState === 'ready' || gameState === 'gameOver') {
      startGame();
    }
  }, [gameState, jump, startGame]);
  
  // Initialize canvas and start game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 400;
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameLoop]);
  
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Loading and Error indicators */}
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          💾 Saving session data...
        </div>
      )}
      
      {saveError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          ⚠️ {saveError}
        </div>
      )}

      {/* User stats display if logged in */}
      {userId && userStats && gameState === 'ready' && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4 text-white max-w-2xl w-full">
          <h3 className="text-lg font-semibold mb-3 text-center">Your Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{userStats.bestScore || 0}</div>
              <div className="text-gray-400">Best Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{userStats.bestReactionTime || 0}ms</div>
              <div className="text-gray-400">Best RT</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{Math.round(userStats.averageTargetAccuracy || 0)}%</div>
              <div className="text-gray-400">Avg Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{userStats.totalSessionsPlayed || 0}</div>
              <div className="text-gray-400">Sessions</div>
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="border-4 border-gray-800 rounded-lg cursor-pointer bg-gradient-to-b from-purple-900 to-purple-700"
        style={{ imageRendering: 'pixelated' }}
      />
      
      <div className="flex space-x-4">
        <button
          onClick={startGame}
          disabled={gameState === 'playing'}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {gameState === 'ready' ? 'Start Game' : 
           gameState === 'playing' ? 'Playing...' : 'Restart'}
        </button>
        
        <button
          onClick={jump}
          disabled={gameState !== 'playing'}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Jump
        </button>
        
        {gameState === 'gameOver' && (
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            {showMetrics ? 'Hide Metrics' : 'Show Metrics'}
          </button>
        )}

        <button
          onClick={handleReturnToGameSelection}
          className="px-6 py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
        >
          🏠 Return to Game Selection
        </button>
      </div>
      
      {showMetrics && lastGameMetrics && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg text-white max-w-2xl w-full">
          <h3 className="text-xl font-bold mb-3">Cognitive Test Results</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Reaction Time:</p>
              <p>{lastGameMetrics.avgRT ? `${lastGameMetrics.avgRT}ms avg` : 'No data'}</p>
            </div>
            <div>
              <p className="font-semibold">Adaptation (Switch - Base):</p>
              <p>{lastGameMetrics.adaptation !== null ? `${lastGameMetrics.adaptation}ms` : 'No data'}</p>
            </div>
            <div>
              <p className="font-semibold">Target Collection:</p>
              <p>Hit: {lastGameMetrics.targetsHit} / Total: {lastGameMetrics.totalTargets}</p>
              <p>Missed: {lastGameMetrics.targetsMissed}</p>
            </div>
            <div>
              <p className="font-semibold">Risk Score:</p>
              <p>{lastGameMetrics.riskScore || 'No data'}</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="font-semibold">Score Progression:</p>
            <p className="text-sm">
              {lastGameMetrics.distanceLog.map((log, i) => 
                `${Math.round((log.time - lastGameMetrics.distanceLog[0].time) / 1000)}s: ${log.score}`
              ).join(' → ')}
            </p>
          </div>
          {userId && (
            <div className="mt-3 text-center">
              <p className="text-green-400 text-sm">✅ Results automatically saved to your profile</p>
            </div>
          )}
          {!userId && (
            <div className="mt-3 text-center">
              <p className="text-orange-400 text-sm">💡 Sign in to save your cognitive performance data!</p>
            </div>
          )}
        </div>
      )}
      
      <div className="text-center text-gray-600 max-w-2xl">
        <p className="font-semibold text-lg mb-2">Color Runner Game - Cognitive Test Edition</p>
        <p className="mb-1"><strong>Objective:</strong> Jump over obstacles that DON'T match your color</p>
        <p className="mb-1"><strong>Collect:</strong> Targets that match your current color for bonus points</p>
        <p className="mb-1"><strong>Red obstacles:</strong> Always jump over these!</p>
        <p className="text-sm"><strong>Controls:</strong> SPACE or CLICK to jump • ENTER to start/restart</p>
        <p className="text-sm">Your color changes every 10 seconds!</p>
        <p className="text-sm mt-2 text-gray-500">This game tracks reaction times, adaptation to color changes, and risk-taking behavior</p>
        {!userId && (
          <p className="text-sm mt-2 text-orange-600">💡 Sign in to save your progress and track cognitive improvements!</p>
        )}
      </div>
    </div>
  );
};

export default RunnerGame;