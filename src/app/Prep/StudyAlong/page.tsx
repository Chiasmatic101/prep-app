"use client";
import React, { useEffect, useState, useRef } from "react";
import Lottie from "lottie-react";

// ✅ Import new lotties
import RunOnSpotAnim from "@/lotties/Warmup.json";
import BreathingAnim from "@/lotties/BreathingMethod.json";

type Phase =
  | "setup"
  | "intro"
  | "warmupMove"
  | "warmupKeys"
  | "warmupBreathing"
  | "study"
  | "breakMessage"
  | "breakBreathing"
  | "complete";

const DUR = {
  WARMUP_MOVE: 60,
  WARMUP_KEYS: 60,
  WARMUP_BREATHING: 60,
  STUDY_BLOCK: 25 * 60,
  BREAK_MSG: 3 * 60,
  BREAK_BREATH: 2 * 60,
} as const;

//
// 🔹 Fun animations
//
function PulseAnimation() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-24 h-24 bg-purple-400 rounded-full animate-ping"></div>
    </div>
  );
}

function GalaxyAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: { angle: number; radius: number }[] = [];
    const numParticles = 200;
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * Math.min(w, h) * 0.4,
      });
    }

    function draw() {
      if (!ctx) return;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "white";
      particles.forEach((p) => {
        const x = w / 2 + Math.cos(p.angle) * p.radius;
        const y = h / 2 + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Spiral inward
        p.radius *= 0.995;
        p.angle += 0.03;
        if (p.radius < 1) {
          p.radius = Math.random() * Math.min(w, h) * 0.4;
          p.angle = Math.random() * Math.PI * 2;
        }
      });

      requestAnimationFrame(draw);
    }
    draw();
  }, []);

  return <canvas ref={canvasRef} className="w-full h-48 rounded-xl bg-black" />;
}

//
// 🔹 Simple Key Tapping Warmup
//
function KeyTapWarmup({ timeLeft }: { timeLeft: number }) {
  const [targetKey, setTargetKey] = useState<string>("");
  const [message, setMessage] = useState<string>("Press the shown key quickly!");
  const [lastTime, setLastTime] = useState<number>(0);

  useEffect(() => {
    const keys = ["A", "S", "D", "F", "J", "K", "L"];
    const newKey = keys[Math.floor(Math.random() * keys.length)];
    setTargetKey(newKey);
    setLastTime(Date.now());

    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toUpperCase() === newKey) {
        const reaction = Date.now() - lastTime;
        setMessage(`✅ Correct! Reaction: ${reaction} ms`);
        setTimeout(() => {
          setTargetKey(keys[Math.floor(Math.random() * keys.length)]);
          setMessage("Press the shown key quickly!");
          setLastTime(Date.now());
        }, 1000);
      } else {
        setMessage("❌ Wrong key, try again!");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lastTime]);

  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl font-bold mb-4">Key: {targetKey}</div>
      <p className="text-sm text-gray-600 mb-2">{message}</p>
      <div className="text-sm text-gray-500">Time left: {timeLeft}s</div>
    </div>
  );
}

//
// 🔹 Main StudyAlongPomodoro Component
//
export default function StudyAlongPomodoro() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionLength, setSessionLength] = useState(60); // minutes (30/60/90/120)
  const [elapsed, setElapsed] = useState(0); // seconds elapsed in entire session
  const [timeLeft, setTimeLeft] = useState(0); // seconds left in current phase

  // Helper to format m:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.max(0, sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Remaining seconds in the whole session
  const remainingSession = () => Math.max(0, sessionLength * 60 - elapsed);

  // Enter a phase with the correct (clamped) duration
  const enterPhase = (p: Phase, desiredSeconds: number | null = null) => {
    const rem = remainingSession();
    if (rem <= 0) {
      setPhase("complete");
      setTimeLeft(0);
      return;
    }
    const duration =
      desiredSeconds == null ? rem : Math.max(0, Math.min(desiredSeconds, rem));
    setPhase(p);
    setTimeLeft(duration);
  };

  // Advance from the current phase to the next one
  const nextPhase = () => {
    if (remainingSession() <= 0) {
      setPhase("complete");
      return;
    }

    switch (phase) {
      case "setup":
        setPhase("intro");
        break;
      case "intro":
        enterPhase("warmupMove", DUR.WARMUP_MOVE);
        break;
      case "warmupMove":
        enterPhase("warmupKeys", DUR.WARMUP_KEYS);
        break;
      case "warmupKeys":
        enterPhase("warmupBreathing", DUR.WARMUP_BREATHING);
        break;
      case "warmupBreathing":
        enterPhase("study", Math.min(DUR.STUDY_BLOCK, remainingSession()));
        break;
      case "study":
        enterPhase("breakMessage", DUR.BREAK_MSG);
        break;
      case "breakMessage":
        enterPhase("breakBreathing", DUR.BREAK_BREATH);
        break;
      case "breakBreathing":
        enterPhase("study", Math.min(DUR.STUDY_BLOCK, remainingSession()));
        break;
      case "complete":
        break;
    }
  };

  // Single timer driving ALL timed phases
  useEffect(() => {
    const timedPhases: Phase[] = [
      "warmupMove",
      "warmupKeys",
      "warmupBreathing",
      "study",
      "breakMessage",
      "breakBreathing",
    ];
    if (!timedPhases.includes(phase)) return;

    const iv = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1;
        if (next <= 0) {
          setElapsed((e) => e + 1);
          clearInterval(iv);
          setTimeout(nextPhase, 0);
          return 0;
        }
        return next;
      });
      setElapsed((e) => e + 1);
    }, 1000);

    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startSession = () => {
    setElapsed(0);
    setPhase("intro");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-200 p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-lg w-full text-center">
        {/* Setup */}
        {phase === "setup" && (
          <>
            <h1 className="text-2xl font-bold mb-4">Create Study Session</h1>
            <label className="block mb-4">
              <span className="font-semibold">Session length:</span>
              <select
                value={sessionLength}
                onChange={(e) => setSessionLength(parseInt(e.target.value))}
                className="ml-2 border rounded px-2 py-1"
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </label>
            <button
              onClick={startSession}
              className="bg-purple-600 text-white rounded-xl px-4 py-2 hover:bg-purple-700"
            >
              Start Session
            </button>
          </>
        )}

        {/* Intro message */}
        {phase === "intro" && (
          <>
            <h2 className="text-2xl font-bold mb-4">📚 Study Session Plan</h2>
            <p className="mb-4 text-gray-700">
              Let's start with a <strong>3-minute mind and brain warmup</strong>,
              followed by <strong>25 minutes of concentrated study</strong> and a
              <strong> 5-minute break</strong>. This cycle repeats using the
              Pomodoro method ⏱️.
            </p>
            <p className="mb-6 text-gray-600">
              Stay consistent, take mindful breaks, and maximize your learning.
            </p>
            <button
              onClick={() => enterPhase("warmupMove", DUR.WARMUP_MOVE)}
              className="bg-purple-600 text-white rounded-xl px-4 py-2 hover:bg-purple-700"
            >
              Continue ➡️
            </button>
          </>
        )}

        {/* Warmups */}
        {phase === "warmupMove" && (
          <>
            <div className="text-sm text-gray-600 mb-2">
              Warmup 1/3 · {formatTime(timeLeft)}
            </div>
            <h2 className="text-lg font-bold mb-2">🏃 Move Your Body</h2>
            <Lottie
  animationData={RunOnSpotAnim}
  loop
  className="w-32 h-32 sm:w-40 sm:h-40 mx-auto"
/>

          </>
        )}

        {phase === "warmupKeys" && (
          <>
            <div className="text-sm text-gray-600 mb-2">
              Warmup 2/3 · {formatTime(timeLeft)}
            </div>
            <KeyTapWarmup timeLeft={timeLeft} />
          </>
        )}

        {phase === "warmupBreathing" && (
          <>
            <div className="text-sm text-gray-600 mb-2">
              Warmup 3/3 · {formatTime(timeLeft)}
            </div>
            <h2 className="text-lg font-bold mb-2">🌬️ Box Breathing Method</h2>
            <Lottie
              animationData={BreathingAnim}
              loop
              className="w-64 h-64 mx-auto"
            />
          </>
        )}

        {/* Study */}
        {phase === "study" && (
          <>
            <h2 className="text-xl font-bold mb-2">Focus Time</h2>
            <p className="mb-4">Stay focused — let the animation guide you</p>
            <div className="text-5xl font-mono mb-4">{formatTime(timeLeft)}</div>
            <GalaxyAnimation />
          </>
        )}

        {/* Breaks */}
        {phase === "breakMessage" && (
          <>
            <h2 className="text-xl font-bold mb-2">Break Time</h2>
            <p className="mb-4">Take a break — move, stretch, relax</p>
            <div className="text-5xl font-mono mb-4">{formatTime(timeLeft)}</div>
          </>
        )}
        {phase === "breakBreathing" && (
          <>
            <div className="text-sm text-gray-600 mb-2">
              Breathing · {formatTime(timeLeft)}
            </div>
            <Lottie
              animationData={BreathingAnim}
              loop
              className="w-64 h-64 mx-auto"
            />
          </>
        )}

        {/* Complete */}
        {phase === "complete" && (
          <>
            <h2 className="text-2xl font-bold mb-4">🎉 Session Complete!</h2>
            <p className="mb-4">
              Total time: {sessionLength} minutes (Pomodoro).
            </p>
            <button
              onClick={() => setPhase("setup")}
              className="bg-purple-600 text-white rounded-xl px-4 py-2 hover:bg-purple-700"
            >
              Start New Session
            </button>
          </>
        )}
      </div>
    </main>
  );
}
