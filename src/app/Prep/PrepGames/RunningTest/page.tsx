"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/firebase/config';
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Soft‑Ambient, Cross‑Platform visual upgrade for Color Runner
 * ------------------------------------------------------------------
 * - Core logic, scoring, cognitive tracking/reporting are preserved.
 * - Adds parallax background, day/night ambience, subtle glow, and
 *   lightweight overlays with minimal perf impact.
 * - Canvas only; no heavy deps. Wrapper UI keeps Tailwind.
 */

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

type AmbientDot = { x: number; y: number; r: number; speed: number; a: number };

type Cloud = { x: number; y: number; w: number; h: number; speed: number; a: number };

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

  // Ambient helpers
  const [overlayMsg, setOverlayMsg] = useState<string>('');
  const overlayTimeoutRef = useRef<number | null>(null);

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

  // Ambient field
  const ambientDotsRef = useRef<AmbientDot[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);

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

  // Save session data to Firestore (unchanged)
  const saveSessionData = async (sessionMetrics: SessionData): Promise<void> => {
    if (!userId) {
      const savedSessions = JSON.parse(localStorage.getItem('colorRunnerSessions') || '[]');
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10);
      localStorage.setItem('colorRunnerSessions', JSON.stringify(updatedSessions));
      return;
    }

    setIsLoading(true);
    setSaveError('');

    try {
      const userDocRef = doc(db, 'users', userId);

      const sessionDuration = sessionMetrics.sessionOverview.totalSessionDuration;
      const avgReactionTime = sessionMetrics.performance.averageReactionTime;
      const bestScore = sessionMetrics.performance.finalScore;
      const accuracy = sessionMetrics.performance.targetAccuracy;

      await setDoc(
        userDocRef,
        {
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
            sessions: [...(userStats?.sessions || []), sessionMetrics].slice(-10),
            cognitiveProfile: {
              reactionTime: avgReactionTime,
              adaptationSpeed: sessionMetrics.cognitiveMetrics.adaptationSpeed,
              riskTaking: sessionMetrics.cognitiveMetrics.riskTaking,
              attentionalFlexibility: sessionMetrics.cognitiveMetrics.attentionalFlexibility,
              executiveControl: sessionMetrics.cognitiveMetrics.executiveControl,
            },
          },
        },
        { merge: true }
      );

      await addDoc(collection(db, 'users', userId, 'gameSessionsDetailed'), {
        userId,
        gameType: 'colorRunner',
        ...sessionMetrics,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving session data:', error);
      setSaveError('Failed to save session data. Your progress may not be synced.');

      const savedSessions = JSON.parse(localStorage.getItem('colorRunnerSessions') || '[]');
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10);
      localStorage.setItem('colorRunnerSessions', JSON.stringify(updatedSessions));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate running average (unchanged)
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue;
    return Math.round(((currentAvg * count) + newValue) / (count + 1));
  };

  // Generate session data for saving (unchanged)
  const generateSessionData = (metrics: GameMetrics): SessionData => {
    const sessionEnd = Date.now();
    const totalDuration = sessionEnd - sessionStartTimeRef.current;

    return {
      sessionOverview: {
        sessionStart: sessionStartTimeRef.current,
        sessionEnd,
        totalSessionDuration: totalDuration,
        gameType: 'colorRunner',
      },
      performance: {
        finalScore: metrics.finalScore,
        averageReactionTime: metrics.avgRT || 0,
        bestReactionTime: metrics.avgRT ? Math.min(...reactionTimesRef.current) : 0,
        targetAccuracy: metrics.riskScore ? parseFloat(metrics.riskScore) * 100 : 0,
        totalTargets: metrics.totalTargets,
        targetsHit: metrics.targetsHit,
        targetsMissed: metrics.targetsMissed,
        adaptationDelay: metrics.adaptation || 0,
      },
      cognitiveMetrics: {
        reactionTime: metrics.avgRT || 0,
        adaptationSpeed: calculateAdaptationSpeed(),
        riskTaking: calculateRiskTaking(),
        attentionalFlexibility: calculateAttentionalFlexibility(),
        executiveControl: calculateExecutiveControl(),
        cognitiveLoad: calculateCognitiveLoad(),
      },
      detailedLogs: {
        reactionTimes: reactionTimesRef.current,
        baselineReactions: baselineReactionsRef.current,
        switchReactions: switchReactionsRef.current,
        targetStats: targetStatsRef.current,
        distanceProgression: distanceLogRef.current,
        colorSwitchAnalysis: generateColorSwitchAnalysis(),
      },
    };
  };

  // Cognitive analysis helper functions (unchanged)
  const calculateAdaptationSpeed = (): number => {
    const base = baselineReactionsRef.current;
    const sw = switchReactionsRef.current;
    const avgBase = base.length ? base.reduce((a, b) => a + b, 0) / base.length : 0;
    const avgSwitch = sw.length ? sw.reduce((a, b) => a + b, 0) / sw.length : 0;

    if (avgBase === 0 || avgSwitch === 0) return 100;

    const adaptationEffect = ((avgSwitch - avgBase) / avgBase) * 100;
    return Math.max(0, 100 - Math.abs(adaptationEffect));
  };

  const calculateRiskTaking = (): number => {
    const { total, hit, missed } = targetStatsRef.current;
    if (total === 0) return 50;

    const attemptRate = (hit + missed) / total;
    const successRate = hit > 0 ? hit / (hit + missed) : 0;

    return Math.round((attemptRate * 50) + (successRate * 50));
  };

  const calculateAttentionalFlexibility = (): number => {
    const colorSwitches = Math.floor((Date.now() - sessionStartTimeRef.current) / colorChangeDuration);
    if (colorSwitches === 0) return 100;

    const switchReactions = switchReactionsRef.current;
    const avgSwitchRT = switchReactions.length ?
      switchReactions.reduce((a, b) => a + b, 0) / switchReactions.length : 0;

    if (avgSwitchRT === 0) return 100;
    return Math.max(0, Math.min(100, 100 - ((avgSwitchRT - 300) / 10)));
  };

  const calculateExecutiveControl = (): number => {
    const allReactions = reactionTimesRef.current;
    if (allReactions.length < 2) return 100;

    const mean = allReactions.reduce((a, b) => a + b, 0) / allReactions.length;
    const variance = allReactions.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / allReactions.length;
    const cv = Math.sqrt(variance) / mean;

    return Math.max(0, Math.min(100, 100 - (cv * 100)));
  };

  const calculateCognitiveLoad = (): number => {
    const { total } = targetStatsRef.current;
    const reactionCount = reactionTimesRef.current.length;
    if (reactionCount === 0) return 0;

    const decisionDensity = (total + reactionCount) / (score / 10 || 1);
    return Math.min(100, decisionDensity * 10);
  };

  const generateColorSwitchAnalysis = () => {
    const colorSwitches = Math.floor((Date.now() - sessionStartTimeRef.current) / colorChangeDuration);

    return {
      totalColorSwitches: colorSwitches,
      adaptationAttempts: switchReactionsRef.current.length,
      averageAdaptationTime: switchReactionsRef.current.length > 0
        ? switchReactionsRef.current.reduce((a, b) => a + b, 0) / switchReactionsRef.current.length
        : 0,
      flexibilityIndex: calculateAttentionalFlexibility(),
    };
  };

  // Auto-save when returning to game selection (unchanged)
  const handleReturnToGameSelection = async (): Promise<void> => {
    if (lastGameMetrics) {
      const sessionData = generateSessionData(lastGameMetrics);
      await saveSessionData(sessionData);
    }
    router.push('/Prep/PrepGames/GameSelection');
  };

  // Particle classes (unchanged logic)
  class TrailParticle implements TrailParticle {
    x: number; y: number; size: number; opacity: number; maxAge: number; age: number; color: string;
    constructor(x: number, y: number, isDoubleJump: boolean = false) {
      this.x = x; this.y = y;
      this.size = Math.random() * 7 + 3; // slightly smaller for perf
      this.opacity = 0.85; this.maxAge = 26 + Math.random() * 12; this.age = 0;
      this.color = isDoubleJump ? '#EC4899' : playerColor;
    }
    update(): void { this.age++; this.opacity = (1 - (this.age / this.maxAge)) * 0.85; this.size *= 0.96; this.x -= 2; }
    shouldRemove(): boolean { return this.age >= this.maxAge || this.opacity <= 0.1; }
  }

  class SparkParticle implements SparkParticle {
    x: number; y: number; color: string; velocityX: number; velocityY: number; size: number; opacity: number; maxAge: number; age: number;
    constructor(x: number, y: number, color: string) {
      this.x = x; this.y = y; this.color = color;
      const angle = Math.random() * 2 * Math.PI; const speed = 2.8 + Math.random() * 4.5; // toned down for mobile
      this.velocityX = Math.cos(angle) * speed; this.velocityY = Math.sin(angle) * speed;
      this.size = 3 + Math.random() * 5; this.opacity = 1; this.maxAge = 24 + Math.random() * 16; this.age = 0;
    }
    update(): void {
      this.age++; this.x += this.velocityX; this.y += this.velocityY;
      this.velocityY += 0.28; this.velocityX *= 0.985; this.velocityY *= 0.985;
      this.opacity = (1 - (this.age / this.maxAge)); this.size *= 0.965;
    }
    shouldRemove(): boolean { return this.age >= this.maxAge || this.opacity <= 0.1 || this.size <= 1; }
  }

  // Initialize game + ambience
  const initGame = useCallback((): void => {
    const player = playerRef.current;
    player.x = 100; player.y = 300; player.velocityY = 0;
    player.isJumping = false; player.canDoubleJump = false; player.isDoubleJumping = false; player.rotation = 0; player.color = '#3B82F6';

    obstaclesRef.current = [];
    gameSpeedRef.current = 4; lastObstacleRef.current = 0;
    particlesRef.current = []; sparkParticlesRef.current = [];
    setScore(0);

    // Reset cognitive metrics
    reactionTimesRef.current = []; baselineReactionsRef.current = []; switchReactionsRef.current = [];
    hasLoggedAdaptationRef.current = false; targetStatsRef.current = { total: 0, hit: 0, missed: 0 };
    distanceLogRef.current = []; sessionStartTimeRef.current = Date.now();

    // Reset color system
    setPlayerColor('#3B82F6'); setPlayerColorName('Blue');
    lastColorChangeRef.current = Date.now(); colorChangeTimeRef.current = Date.now();

    // Ambient field setup (cross‑platform friendly counts)
    const canvas = canvasRef.current; if (!canvas) return;
    ambientDotsRef.current = Array.from({ length: 24 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      speed: 0.15 + Math.random() * 0.25,
      a: 0.35 + Math.random() * 0.3,
    }));

    cloudsRef.current = Array.from({ length: 4 }, () => ({
      x: Math.random() * canvas.width,
      y: 40 + Math.random() * 110,
      w: 120 + Math.random() * 140,
      h: 26 + Math.random() * 16,
      speed: 0.25 + Math.random() * 0.35,
      a: 0.18 + Math.random() * 0.12,
    }));

    // Clear any lingering overlay
    setOverlayMsg('');
    if (overlayTimeoutRef.current) { window.clearTimeout(overlayTimeoutRef.current); overlayTimeoutRef.current = null; }
  }, []);

  // Log distance periodically (unchanged)
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => { distanceLogRef.current.push({ time: Date.now(), score }); }, 5000);
    return () => clearInterval(interval);
  }, [score, gameState]);

  // Change player color + ambient overlay
  const changePlayerColor = useCallback((): void => {
    const randomIndex = Math.floor(Math.random() * gameColors.length);
    const newColor = gameColors[randomIndex];
    const newColorName = colorNames[randomIndex];

    setPlayerColor(newColor); setPlayerColorName(newColorName);
    playerRef.current.color = newColor; lastColorChangeRef.current = Date.now(); colorChangeTimeRef.current = Date.now();
    hasLoggedAdaptationRef.current = false;

    // soft overlay cue
    setOverlayMsg(`Color Shift → ${newColorName}`);
    if (overlayTimeoutRef.current) window.clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = window.setTimeout(() => setOverlayMsg(''), 1400) as unknown as number;
  }, []);

  // Check if colors match (unchanged)
  const colorsMatch = useCallback((color1: string, color2: string): boolean => color1 === color2, []);

  // Handle jump with reaction time tracking (unchanged)
  const jump = useCallback((): void => {
    const player = playerRef.current;
    if (gameState !== 'playing') return;

    const nearbyObstacle = obstaclesRef.current.find(
      (o) => o.enteredDecisionZoneAt && !o.reactionLogged && Math.abs(o.x - player.x) <= DECISION_ZONE
    );

    if (nearbyObstacle && nearbyObstacle.enteredDecisionZoneAt) {
      const rt = Date.now() - nearbyObstacle.enteredDecisionZoneAt;
      reactionTimesRef.current.push(rt);
      if (!hasLoggedAdaptationRef.current && Date.now() - colorChangeTimeRef.current < 10000) {
        switchReactionsRef.current.push(rt); hasLoggedAdaptationRef.current = true;
      } else { baselineReactionsRef.current.push(rt); }
      nearbyObstacle.reactionLogged = true;
    }

    if (!player.isJumping) {
      player.velocityY = JUMP_FORCE; player.isJumping = true; player.canDoubleJump = true; player.isDoubleJumping = false;
    } else if (player.canDoubleJump && !player.isDoubleJumping) {
      player.velocityY = JUMP_FORCE * 0.8; player.isDoubleJumping = true; player.canDoubleJump = false;
    }
  }, [gameState]);

  // Generate obstacles (unchanged logic)
  const generateObstacle = useCallback((canvasWidth: number): void => {
    const obstacles = obstaclesRef.current;
    const lastObstacle = obstacles[obstacles.length - 1];
    const shouldSpawn = !lastObstacle || (canvasWidth - lastObstacle.x > MIN_OBSTACLE_DISTANCE + Math.random() * (MAX_OBSTACLE_DISTANCE - MIN_OBSTACLE_DISTANCE));

    if (shouldSpawn) {
      const obstacleHeight = 50 + Math.random() * 40; const obstacleWidth = 35;
      let obstacleColor: string, obstacleColorName: string, isTarget: boolean;

      if (Math.random() < 0.5) {
        isTarget = true;
        if (Math.random() < 0.6) { obstacleColor = playerColor; obstacleColorName = playerColorName; }
        else {
          const otherColors = gameColors.filter(c => c !== playerColor);
          const randomIndex = Math.floor(Math.random() * otherColors.length);
          obstacleColor = otherColors[randomIndex];
          obstacleColorName = colorNames[gameColors.indexOf(obstacleColor)];
        }
      } else { obstacleColor = '#EF4444'; obstacleColorName = 'Red'; isTarget = false; }

      if (isTarget && obstacleColor === playerColor) { targetStatsRef.current.total += 1; }

      obstacles.push({
        x: canvasWidth + 50, y: groundY - obstacleHeight, width: obstacleWidth, height: obstacleHeight,
        color: obstacleColor, colorName: obstacleColorName, isTarget, enteredDecisionZoneAt: null, reactionLogged: false,
      });
    }
  }, [playerColor, playerColorName]);

  // Check collision (unchanged)
  const checkCollision = useCallback((rect1: Player, rect2: Obstacle): boolean => {
    const playerLeft = rect1.x, playerRight = rect1.x + rect1.width, playerTop = rect1.y - rect1.height, playerBottom = rect1.y;
    const obstacleLeft = rect2.x, obstacleRight = rect2.x + rect2.width, obstacleTop = rect2.y, obstacleBottom = rect2.y + rect2.height;
    return playerLeft < obstacleRight && playerRight > obstacleLeft && playerTop < obstacleBottom && playerBottom > obstacleTop;
  }, []);

  // Create spark effect (unchanged interface)
  const createSparks = useCallback((x: number, y: number, color: string): void => {
    const sparks = sparkParticlesRef.current;
    for (let i = 0; i < 10; i++) { sparks.push(new SparkParticle(x, y, color)); }
  }, []);

  // Calculate and display metrics (unchanged)
  const calculateMetrics = useCallback(async (): Promise<GameMetrics> => {
    const rtList = reactionTimesRef.current;
    const avgRT = rtList.length ? Math.round(rtList.reduce((a, b) => a + b, 0) / rtList.length) : null;

    const base = baselineReactionsRef.current; const sw = switchReactionsRef.current;
    const avgBase = base.length ? base.reduce((a, b) => a + b, 0) / base.length : 0;
    const avgSwitch = sw.length ? sw.reduce((a, b) => a + b, 0) / sw.length : 0;
    const adaptation = avgSwitch && avgBase ? Math.round(avgSwitch - avgBase) : null;

    const { total, hit, missed } = targetStatsRef.current;
    const riskScore = hit + missed > 0 ? (hit / (hit + missed)) : null;

    const metrics: GameMetrics = {
      avgRT, adaptation, totalTargets: total, targetsHit: hit, targetsMissed: missed,
      riskScore: riskScore?.toFixed(2) || null, distanceLog: distanceLogRef.current, finalScore: score,
    };

    setLastGameMetrics(metrics); setShowMetrics(true);
    const sessionData = generateSessionData(metrics); await saveSessionData(sessionData);
    return metrics;
  }, [score]);

  // Update game logic (unchanged core + ambience and soft squash)
  const updateGame = useCallback((): void => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current; if (!canvas) return;
    const player = playerRef.current; const obstacles = obstaclesRef.current;

    // Player physics
    player.velocityY += GRAVITY; player.y += player.velocityY;
    if (player.y >= 300) { player.y = 300; player.velocityY = 0; player.isJumping = false; player.canDoubleJump = false; player.isDoubleJumping = false; player.rotation = 0; }
    if (player.isJumping) { player.rotation += 0.16; if (player.rotation > 2 * Math.PI) player.rotation = 0; }
    player.color = playerColor;

    // Color changes
    const now = Date.now(); if (now - lastColorChangeRef.current >= colorChangeDuration) changePlayerColor();

    // Decision zone stamps
    obstacles.forEach((obstacle) => {
      if (!obstacle.enteredDecisionZoneAt && obstacle.x <= player.x + DECISION_ZONE) obstacle.enteredDecisionZoneAt = Date.now();
    });

    // Spawn obstacles
    generateObstacle(canvas.width);

    // Trails
    if (Math.random() < 0.28) {
      particlesRef.current.push(new TrailParticle(player.x + player.width / 2, player.y - player.height / 2, player.isDoubleJumping));
    }
    particlesRef.current = particlesRef.current.filter((p) => { p.update(); return !p.shouldRemove(); });
    sparkParticlesRef.current = sparkParticlesRef.current.filter((p) => { p.update(); return !p.shouldRemove(); });

    // Obstacles update & scoring
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i]; obstacle.x -= gameSpeedRef.current;
      if (checkCollision(player, obstacle)) {
        if (obstacle.isTarget && colorsMatch(obstacle.color, playerColor)) {
          targetStatsRef.current.hit += 1; createSparks(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.color);
          setScore((prev) => prev + 50); obstacles.splice(i, 1); continue;
        } else {
          setGameState('gameOver'); setHighScore((prev) => Math.max(prev, score)); calculateMetrics(); return;
        }
      }
      if (obstacle.x + obstacle.width < 0) {
        if (obstacle.isTarget && obstacle.color === playerColor) targetStatsRef.current.missed += 1;
        obstacles.splice(i, 1);
        if (!obstacle.isTarget) setScore((prev) => prev + 10);
      }
    }

    // Difficulty ramp (unchanged formula)
    gameSpeedRef.current = 4 + Math.floor(score / 100) * 0.5;
  }, [gameState, score, playerColor, changePlayerColor, generateObstacle, checkCollision, colorsMatch, createSparks, calculateMetrics]);

  // Render game (soft ambient pass)
  const render = useCallback((): void => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const player = playerRef.current; const obstacles = obstaclesRef.current;

    // Day/Night gradient (soft ambient)
    const t = (Date.now() - sessionStartTimeRef.current) / 1000; // seconds since start
    const cycle = (Math.sin(t * 0.15) + 1) / 2; // 0..1 slowly
    const top = `hsl(${220 + 30 * cycle} 60% ${18 + 8 * cycle}%)`;
    const mid = `hsl(${255 + 10 * cycle} 55% ${20 + 8 * cycle}%)`;
    const bot = `hsl(${265 + 5 * cycle} 50% ${24 + 6 * cycle}%)`;

    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, top); bg.addColorStop(0.55, mid); bg.addColorStop(1, bot);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax ambient dots (slow drift)
    ambientDotsRef.current.forEach((d) => {
      d.x -= d.speed; if (d.x < -2) d.x = canvas.width + Math.random() * 20;
      ctx.globalAlpha = d.a; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Soft clouds (very subtle)
    cloudsRef.current.forEach((c) => {
      c.x -= c.speed; if (c.x < -c.w) c.x = canvas.width + Math.random() * 60;
      const cloudGrad = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
      cloudGrad.addColorStop(0, `rgba(255,255,255,${0.18 * c.a})`);
      cloudGrad.addColorStop(1, `rgba(255,255,255,${0.05 * c.a})`);
      ctx.fillStyle = cloudGrad; ctx.globalAlpha = c.a;
      roundRect(ctx, c.x, c.y, c.w, c.h, 12); ctx.fill(); ctx.globalAlpha = 1;
    });

    // Ground (soft gradient strip)
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    groundGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
    groundGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = groundGrad; ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Horizon glow
    const horizonGrad = ctx.createLinearGradient(0, groundY - 18, 0, groundY + 10);
    horizonGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
    horizonGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = horizonGrad; ctx.fillRect(0, groundY - 18, canvas.width, 28);

    // Trail particles (soft glow)
    particlesRef.current.forEach((p) => {
      ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = p.opacity * 0.22; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2); ctx.fill();
    }); ctx.globalAlpha = 1;

    // Spark particles
    sparkParticlesRef.current.forEach((p) => {
      ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }); ctx.globalAlpha = 1;

    // Player (soft squash & glow)
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y - player.height / 2);
    ctx.rotate(player.rotation);

    const jumpPhase = player.isJumping ? Math.min(1, Math.abs(player.velocityY) / 14) : 0;
    const squashX = 1 + 0.06 * jumpPhase; // subtle
    const squashY = 1 - 0.06 * jumpPhase;
    ctx.scale(squashX, squashY);

    ctx.shadowColor = player.color; ctx.shadowBlur = player.isJumping ? 18 : 10;
    ctx.fillStyle = player.color; roundRect(ctx, -player.width / 2, -player.height / 2, player.width, player.height, 8); ctx.fill();
    ctx.shadowBlur = 0;

    // eyes
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-player.width / 2 + 8, -player.height / 2 + 8, 6, 6); ctx.fillRect(-player.width / 2 + 26, -player.height / 2 + 8, 6, 6);

    // double jump indicator
    if (player.canDoubleJump) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; roundRect(ctx, -player.width / 2 + 4, -player.height / 2 + 4, player.width - 8, player.height - 8, 6); ctx.stroke(); }
    ctx.restore();

    // Obstacles (soft glow + target outline)
    obstacles.forEach((o) => {
      ctx.shadowColor = o.color; ctx.shadowBlur = 10; ctx.fillStyle = o.color;
      roundRect(ctx, o.x, o.y, o.width, o.height, 6); ctx.fill();
      if (o.isTarget) { ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; roundRect(ctx, o.x + 2, o.y + 2, o.width - 4, o.height - 4, 5); ctx.stroke(); }
    }); ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px Arial';
    ctx.fillText(`Score: ${score}`, 20, 36); ctx.fillText(`Speed: ${gameSpeedRef.current.toFixed(1)}x`, 20, 66);
    ctx.textAlign = 'right'; ctx.fillText(`High Score: ${highScore}`, canvas.width - 20, 36); ctx.textAlign = 'left';

    // Color indicator
    const timeLeft = Math.max(0, colorChangeDuration - (Date.now() - lastColorChangeRef.current));
    ctx.fillStyle = playerColor; roundRect(ctx, canvas.width - 140, 56, 120, 36, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText(playerColorName, canvas.width - 132, 78);
    ctx.font = '12px Arial'; ctx.fillText(`${Math.ceil(timeLeft / 1000)}s`, canvas.width - 60, 78);

    // Overlay message (Color Shift)
    if (overlayMsg) {
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, canvas.width / 2 - 130, 24, 260, 40, 10); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText(overlayMsg, canvas.width / 2, 50); ctx.textAlign = 'left'; ctx.restore();
    }

    // State overlays
    if (gameState === 'ready' || gameState === 'gameOver') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.50)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
      if (gameState === 'ready') {
        ctx.font = 'bold 34px Arial'; ctx.fillText('COLOR RUNNER', canvas.width / 2, canvas.height / 2 - 70);
        ctx.font = 'bold 18px Arial'; ctx.fillText('Match your color to collect • Jump over the rest', canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillText('Your color changes every 10 seconds', canvas.width / 2, canvas.height / 2);
        ctx.font = 'bold 16px Arial'; ctx.fillText('Press ENTER to start • SPACE/CLICK to jump', canvas.width / 2, canvas.height / 2 + 36);
      } else {
        ctx.fillStyle = '#F87171'; ctx.font = 'bold 44px Arial'; ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 72);
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px Arial'; ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 - 32);
        ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText('Press ENTER to restart', canvas.width / 2, canvas.height / 2 + 36);
      }
      ctx.textAlign = 'left';
    }

    // Vignette for focus
    vignette(ctx, canvas.width, canvas.height);
  }, [gameState, score, highScore, playerColor, playerColorName, overlayMsg]);

  // Game loop (unchanged)
  const gameLoop = useCallback((): void => {
    updateGame(); render(); gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, render]);

  // Start game (unchanged)
  const startGame = useCallback((): void => {
    initGame(); setGameState('playing'); setShowMetrics(false); setSaveError('');
  }, [initGame]);

  // Keyboard input (unchanged)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); jump(); }
      if (e.code === 'Enter') { e.preventDefault(); if (gameState === 'ready' || gameState === 'gameOver') startGame(); }
    };
    const handleKeyUp = (e: KeyboardEvent): void => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [jump, startGame, gameState]);

  // Canvas click (unchanged)
  const handleCanvasClick = useCallback((): void => {
    if (gameState === 'playing') jump(); else if (gameState === 'ready' || gameState === 'gameOver') startGame();
  }, [gameState, jump, startGame]);

  // Initialize canvas and start loop (unchanged)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width = 800; canvas.height = 400; gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameLoop]);

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Saving indicators */}
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">💾 Saving session data...</div>
      )}
      {saveError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">⚠️ {saveError}</div>
      )}

      {/* Stats preface */}
      {userId && userStats && gameState === 'ready' && (
        <div className="bg-gray-800 rounded-lg p-4 mb-2 text-white max-w-2xl w-full">
          <h3 className="text-lg font-semibold mb-3 text-center">Your Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center"><div className="text-2xl font-bold text-yellow-400">{userStats.bestScore || 0}</div><div className="text-gray-400">Best Score</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-green-400">{userStats.bestReactionTime || 0}ms</div><div className="text-gray-400">Best RT</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-blue-400">{Math.round(userStats.averageTargetAccuracy || 0)}%</div><div className="text-gray-400">Avg Accuracy</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-purple-400">{userStats.totalSessionsPlayed || 0}</div><div className="text-gray-400">Sessions</div></div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="border-4 border-gray-800 rounded-lg cursor-pointer bg-gradient-to-b from-purple-900 to-purple-700"
        style={{ imageRendering: 'pixelated' }}
      />

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={startGame}
          disabled={gameState === 'playing'}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {gameState === 'ready' ? 'Start Game' : gameState === 'playing' ? 'Playing...' : 'Restart'}
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
        <div className="mt-2 p-4 bg-gray-800 rounded-lg text-white max-w-2xl w-full">
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
              {lastGameMetrics.distanceLog.map((log, i) => `${Math.round((log.time - lastGameMetrics.distanceLog[0].time) / 1000)}s: ${log.score}`).join(' → ')}
            </p>
          </div>
          {userId && (<div className="mt-3 text-center"><p className="text-green-400 text-sm">✅ Results automatically saved to your profile</p></div>)}
          {!userId && (<div className="mt-3 text-center"><p className="text-orange-400 text-sm">💡 Sign in to save your cognitive performance data!</p></div>)}
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
        {!userId && (<p className="text-sm mt-2 text-orange-600">💡 Sign in to save your progress and track cognitive improvements!</p>)}
      </div>
    </div>
  );
};

// ---- Drawing helpers -------------------------------------------------
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.65);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

export default RunnerGame;
