"use client"

import React, { useRef, useEffect, useState } from "react"

interface Player {
  x: number
  y: number
  vy: number
  color: string
  health: number
  controls?: { jump: string; shoot: string }
}

interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  owner: number
}

const CakeBattle: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [gameId, setGameId] = useState<number>(0)
  const [scores, setScores] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const gravity = 0.6
    const floor = 350
    const mid = canvas.width / 2

    // Load brain sprite sheet
    const brainImg = new Image()
    brainImg.src = "/sprites/brain.png" // put your sheet in public/sprites/

    const frameCount = 8 // 8 brains in the sheet
    let frameIndex = 0
    let frameTick = 0

    const players: Player[] = [
      { x: 100, y: 300, vy: 0, color: "pink", health: 100 }, // AI
      { 
        x: 500, y: 300, vy: 0, color: "lightblue", health: 100,
        controls: { jump: "ArrowUp", shoot: "ArrowLeft" }
      },
    ]
    const projectiles: Projectile[] = []
    const keys: Record<string, boolean> = {}

    const keyDown = (e: KeyboardEvent) => (keys[e.code] = true)
    const keyUp = (e: KeyboardEvent) => (keys[e.code] = false)
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)

    let running = true
    let aiCooldown = 0
    let aiDirection = 1
    let aiMoveTimer = 40

    const gameLoop = () => {
      if (!running) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Mid divider
      ctx.fillStyle = "#ccc"
      ctx.fillRect(mid - 2, 0, 4, canvas.height)

      // Floor
      ctx.fillStyle = "#444"
      ctx.fillRect(0, floor + 50, canvas.width, 50)

      // Advance animation
      frameTick++
      if (frameTick % 10 === 0) { // change frame every 10 ticks
        frameIndex = (frameIndex + 1) % frameCount
      }

      players.forEach((p, i) => {
        // Gravity
        p.vy += gravity
        p.y += p.vy
        if (p.y > floor) {
          p.y = floor
          p.vy = 0
        }

        if (i === 0) {
          // AI logic (same as before, aggressive)
          const target = players[1]

          aiMoveTimer--
          if (aiMoveTimer <= 0) {
            if (Math.random() < 0.7) aiDirection = 1
            else aiDirection = -1
            aiMoveTimer = 40 + Math.floor(Math.random() * 40)
          }
          p.x += aiDirection * 2.5
          if (p.x < 20) p.x = 20
          if (p.x > mid - 60) p.x = mid - 60

          if (p.y === floor) {
            if (Math.abs(target.x - p.x) < 200 && Math.random() < 0.1) {
              p.vy = -12
            } else if (Math.random() < 0.01) {
              p.vy = -12
            }
          }

          if (aiCooldown <= 0 && Math.abs(target.x - p.x) < 300) {
            if (Math.random() < 0.5) {
              projectiles.push({
                x: p.x + 20,
                y: p.y - 20,
                vx: 7,
                vy: 0,
                owner: 0,
              })
              aiCooldown = 20 + Math.floor(Math.random() * 20)
            }
          } else {
            aiCooldown--
          }
        } else {
          // Player 2 controls
          if (keys[p.controls!.jump] && p.y === floor) {
            p.vy = -12
          }

          if (keys[p.controls!.shoot]) {
            keys[p.controls!.shoot] = false
            projectiles.push({
              x: p.x - 20,
              y: p.y - 20,
              vx: -6,
              vy: 0,
              owner: 1,
            })
          }

          if (keys["KeyA"] && p.x > mid + 20) p.x -= 3
          if (keys["KeyD"] && p.x < canvas.width - 60) p.x += 3
        }

        // Draw brain sprite (instead of rectangle)
        if (brainImg.complete) {
          const frameWidth = brainImg.width / frameCount
          const frameHeight = brainImg.height
          ctx.drawImage(
            brainImg,
            frameIndex * frameWidth, 0, // crop x,y
            frameWidth, frameHeight,   // crop size
            p.x, p.y - 40, 40, 40      // draw size
          )
        } else {
          // fallback: rectangle if sprite not loaded yet
          ctx.fillStyle = p.color
          ctx.fillRect(p.x, p.y - 40, 40, 40)
        }

        // Health bar
        ctx.fillStyle = "red"
        ctx.fillRect(p.x, p.y - 60, p.health, 5)
      })

      // Projectiles
      projectiles.forEach((proj, idx) => {
        proj.x += proj.vx
        proj.y += proj.vy

        ctx.fillStyle = "yellow"
        ctx.beginPath()
        ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2)
        ctx.fill()

        players.forEach((p, i) => {
          if (i !== proj.owner) {
            if (
              proj.x > p.x &&
              proj.x < p.x + 40 &&
              proj.y > p.y - 40 &&
              proj.y < p.y
            ) {
              p.health -= 10
              projectiles.splice(idx, 1)

              if (p.health <= 0) {
                running = false
                setWinner(`Player ${proj.owner + 1} Wins!`)
                setScores((prev) => {
                  if (proj.owner === 0) return { ...prev, p1: prev.p1 + 1 }
                  else return { ...prev, p2: prev.p2 + 1 }
                })
              }
            }
          }
        })
      })

      if (running) requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
    }
  }, [gameId])

  return (
    <div className="flex flex-col items-center p-4">
      <h2 className="text-xl font-bold mb-2">Brain Battle (Animated Sprites)</h2>

      {/* Scoreboard */}
      <div className="flex gap-8 mb-4 text-lg font-semibold">
        <div className="text-pink-600">AI: {scores.p1}</div>
        <div className="text-blue-600">Player: {scores.p2}</div>
      </div>

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="border border-gray-500 bg-white"
      />
      <p className="mt-2 text-sm text-gray-600">
        You (Blue Brain): ↑ = Jump, ← = Shoot, A/D = Move | Pink Brain = AI
      </p>

      {winner && (
        <div className="mt-4 text-center">
          <p className="text-lg font-bold text-purple-700">{winner}</p>
          <button
            onClick={() => {
              setWinner(null)
              setGameId((id) => id + 1)
            }}
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700"
          >
            Next Round
          </button>
        </div>
      )}

      <button
        onClick={() => {
          setScores({ p1: 0, p2: 0 })
          setWinner(null)
          setGameId((id) => id + 1)
        }}
        className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700"
      >
        Reset Scores
      </button>
    </div>
  )
}

export default CakeBattle
