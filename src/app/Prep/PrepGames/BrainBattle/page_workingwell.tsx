"use client"

import React, { useRef, useEffect, useState } from "react"

interface Player {
  x: number
  y: number
  vy: number
  vx: number
  color: string
  health: number
  maxHealth: number
  controls?: { jump: string; shoot: string; left: string; right: string }
  facingRight: boolean
  shootCooldown: number
  lastPlatformId: string | null
  alive: boolean
  respawnTimer: number
}

interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  owner: number
  bounces: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface Platform {
  x: number
  y: number
  width: number
  height: number
  hits: number
  maxHits: number
  ownerSide: 'left' | 'right' | 'neutral'
  id: string
  hasCoin?: boolean
}

interface Coin {
  x: number
  y: number
  platformId: string
  collected: boolean
  type: 'gold' | 'black' | 'heart'
}

const BrainBattle: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [gameId, setGameId] = useState<number>(0)
  const [kills, setKills] = useState<number>(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [height, setHeight] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [canShoot, setCanShoot] = useState(false)
  const [shootTimeLeft, setShootTimeLeft] = useState(0)
  const [canShootBlack, setCanShootBlack] = useState(false)
  const [shootBlackTimeLeft, setShootBlackTimeLeft] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    
    const gravity = 0.4
    const canvasHeight = 480
    const mid = canvas.width / 2
    let cameraY = 0
    let currentHeight = 0
    const scrollSpeed = 0.4

    const players: Player[] = [
      { 
        x: 120, y: 400, vy: 0, vx: 0, color: "#ef4444", 
        health: 100, maxHealth: 100, facingRight: true, shootCooldown: 0,
        lastPlatformId: null, alive: true, respawnTimer: 0
      },
      { 
        x: 520, y: 400, vy: 0, vx: 0, color: "#3b82f6", 
        health: 100, maxHealth: 100, facingRight: false, shootCooldown: 0,
        controls: { jump: "ArrowUp", shoot: " ", left: "ArrowLeft", right: "ArrowRight" },
        lastPlatformId: null, alive: true, respawnTimer: 0
      },
    ]
    
    const projectiles: Projectile[] = []
    const particles: Particle[] = []
    const keys: Record<string, boolean> = {}
    const coins: Coin[] = []

    const platforms: Platform[] = []
    const segmentWidth = 60
    
    const generatePlatforms = (startY: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const y = startY - (i * 50)
        
        const leftPlatformCount = 1 + Math.floor(Math.random() * 3)
        const rightPlatformCount = 1 + Math.floor(Math.random() * 3)
        
        const leftPositions: number[] = []
        for (let j = 0; j < leftPlatformCount; j++) {
          let attempts = 0
          let validPosition = false
          let leftX = 0
          
          while (!validPosition && attempts < 20) {
            leftX = Math.random() * (mid - segmentWidth - 40) + 20
            validPosition = leftPositions.every(pos => Math.abs(pos - leftX) > segmentWidth + 20)
            attempts++
          }
          
          if (validPosition) {
            leftPositions.push(leftX)
            const hasCoin = Math.random() < 0.08
            const coinRoll = Math.random()
            const coinType: 'gold' | 'black' | 'heart' = 
              coinRoll < 0.15 ? 'heart' : (coinRoll < 0.55 ? 'gold' : 'black')
            const platformId = `left-${y}-${leftX}-${i}-${j}`
            platforms.push({ 
              x: leftX, y, width: segmentWidth, height: 15, 
              hits: 0, maxHits: 3, ownerSide: 'left',
              id: platformId,
              hasCoin
            })
            
            if (hasCoin) {
              coins.push({
                x: leftX + segmentWidth / 2,
                y: y - 20,
                platformId,
                collected: false,
                type: coinType
              })
            }
          }
        }
        
        const rightPositions: number[] = []
        for (let j = 0; j < rightPlatformCount; j++) {
          let attempts = 0
          let validPosition = false
          let rightX = 0
          
          while (!validPosition && attempts < 20) {
            rightX = mid + Math.random() * (mid - segmentWidth - 40) + 20
            validPosition = rightPositions.every(pos => Math.abs(pos - rightX) > segmentWidth + 20)
            attempts++
          }
          
          if (validPosition) {
            rightPositions.push(rightX)
            const hasCoin = Math.random() < 0.08
            const coinType: 'gold' | 'black' = Math.random() < 0.6 ? 'gold' : 'black'
            const platformId = `right-${y}-${rightX}-${i}-${j}`
            platforms.push({ 
              x: rightX, y, width: segmentWidth, height: 15, 
              hits: 0, maxHits: 3, ownerSide: 'right',
              id: platformId,
              hasCoin
            })
            
            if (hasCoin) {
              coins.push({
                x: rightX + segmentWidth / 2,
                y: y - 20,
                platformId,
                collected: false,
                type: coinType
              })
            }
          }
        }
      }
    }

    let x = 0
    while (x < canvas.width) {
      platforms.push({ 
        x, y: 450, width: segmentWidth, height: 50, 
        hits: 0, maxHits: 999, ownerSide: 'neutral',
        id: `floor-${x}`
      })
      x += segmentWidth
    }
    
    generatePlatforms(330, 100)

    const keyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      keys[e.key] = true
    }
    const keyUp = (e: KeyboardEvent) => {
      e.preventDefault()
      keys[e.key] = false
    }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)

    let running = true
    let aiCooldown = 0
    let aiJumpCooldown = 0
    let aiStrategyTimer = 0
    let aiStrategy: 'aggressive' | 'defensive' | 'tricky' = 'aggressive'
    let playerShootTimer = 0
    let playerShootBlackTimer = 0

    const respawnAI = () => {
      const ai = players[0]
      ai.alive = true
      ai.health = 100
      ai.x = 120
      ai.y = cameraY + 200
      ai.vy = 0
      ai.vx = 0
      ai.respawnTimer = 0
      ai.shootCooldown = 30
      
      createExplosion(ai.x + 20, ai.y - 20, '#10b981')
    }

    const createExplosion = (x: number, y: number, color: string) => {
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 4
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 30 + Math.random() * 20,
          color
        })
      }
    }

    const drawBrain = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, facingRight: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x + 20, y - 20)
      if (!facingRight) ctx.scale(-1, 1)
      
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(0, -2, 20, 24, 0, 0, Math.PI * 2)
      ctx.fill()
      
      const gradient = ctx.createRadialGradient(-5, -5, 5, 0, 0, 25)
      gradient.addColorStop(0, 'rgba(255,255,255,0.3)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.2)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.ellipse(0, -2, 20, 24, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, -22)
      ctx.lineTo(0, 8)
      ctx.stroke()
      
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      
      for (let side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(side * 15, -5)
        ctx.bezierCurveTo(side * 12, -8, side * 8, -10, side * 3, -8)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 12, -18)
        ctx.bezierCurveTo(side * 10, -12, side * 8, -8, side * 6, -2)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 8, -20)
        ctx.bezierCurveTo(side * 6, -16, side * 5, -12, side * 4, -8)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 16, -12)
        ctx.bezierCurveTo(side * 14, -10, side * 12, -8, side * 10, -6)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 14, -16)
        ctx.bezierCurveTo(side * 12, -14, side * 10, -12, side * 8, -10)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 12, 2)
        ctx.bezierCurveTo(side * 10, 4, side * 8, 5, side * 5, 5)
        ctx.stroke()
      }
      
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      
      for (let i = 0; i < 6; i++) {
        const offsetX = (i % 2 === 0 ? -1 : 1) * (8 + Math.random() * 8)
        const offsetY = -18 + i * 6
        ctx.beginPath()
        ctx.arc(offsetX, offsetY, 3 + Math.random() * 2, 0, Math.PI)
        ctx.stroke()
      }
      
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.ellipse(0, 20, 6, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(-7, 0, 4.5, 0, Math.PI * 2)
      ctx.arc(7, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(-6, -1, 1.5, 0, Math.PI * 2)
      ctx.arc(8, -1, 1.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'black'
      ctx.beginPath()
      ctx.arc(-6, 1, 2.5, 0, Math.PI * 2)
      ctx.arc(8, 1, 2.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()
    }

    const gameLoop = () => {
      if (!running) return

      cameraY -= scrollSpeed
      currentHeight = Math.floor(-cameraY / 10)
      setHeight(currentHeight)
      
      if (playerShootTimer > 0) {
        playerShootTimer--
        setShootTimeLeft(Math.ceil(playerShootTimer / 60))
        setCanShoot(true)
      } else {
        setCanShoot(false)
        setShootTimeLeft(0)
      }

      if (playerShootBlackTimer > 0) {
        playerShootBlackTimer--
        setShootBlackTimeLeft(Math.ceil(playerShootBlackTimer / 60))
        setCanShootBlack(true)
      } else {
        setCanShootBlack(false)
        setShootBlackTimeLeft(0)
      }

      const lowestPlatform = platforms.reduce((min, p) => Math.min(min, p.y), 0)
      if (lowestPlatform > cameraY - 3500) {
        generatePlatforms(lowestPlatform, 100)
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, '#1e1b4b')
      gradient.addColorStop(0.5, '#4c1d95')
      gradient.addColorStop(1, '#000000')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.shadowBlur = 20
      ctx.shadowColor = '#8b5cf6'
      ctx.fillStyle = '#8b5cf6'
      ctx.fillRect(mid - 2, 0, 4, canvas.height)
      ctx.shadowBlur = 0

      ctx.save()
      ctx.translate(0, -cameraY)

      platforms.forEach(platform => {
        const screenY = platform.y - cameraY
        
        if (screenY > canvasHeight * 0.4 && screenY < canvasHeight + 100) {
          const damagePercent = platform.hits / platform.maxHits
          
          ctx.fillStyle = 'rgba(0,0,0,0.3)'
          ctx.fillRect(platform.x + 2, platform.y + 2, platform.width, platform.height)
          
          const platGradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height)
          
          if (platform.ownerSide === 'left') {
            if (damagePercent < 0.33) {
              platGradient.addColorStop(0, '#ef4444')
              platGradient.addColorStop(1, '#dc2626')
            } else if (damagePercent < 0.67) {
              platGradient.addColorStop(0, '#f97316')
              platGradient.addColorStop(1, '#ea580c')
            } else {
              platGradient.addColorStop(0, '#991b1b')
              platGradient.addColorStop(1, '#7f1d1d')
            }
          } else if (platform.ownerSide === 'right') {
            if (damagePercent < 0.33) {
              platGradient.addColorStop(0, '#3b82f6')
              platGradient.addColorStop(1, '#2563eb')
            } else if (damagePercent < 0.67) {
              platGradient.addColorStop(0, '#0ea5e9')
              platGradient.addColorStop(1, '#0284c7')
            } else {
              platGradient.addColorStop(0, '#1e3a8a')
              platGradient.addColorStop(1, '#1e40af')
            }
          } else {
            platGradient.addColorStop(0, '#6366f1')
            platGradient.addColorStop(1, '#4338ca')
          }
          
          ctx.fillStyle = platGradient
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
          
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.fillRect(platform.x, platform.y, platform.width, 3)
          
          ctx.strokeStyle = damagePercent > 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.3)'
          ctx.lineWidth = 1
          ctx.strokeRect(platform.x, platform.y, platform.width, platform.height)
          
          if (damagePercent > 0.33) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(platform.x + platform.width * 0.5, platform.y)
            ctx.lineTo(platform.x + platform.width * 0.5, platform.y + platform.height)
            ctx.stroke()
          }
          if (damagePercent > 0.67) {
            ctx.beginPath()
            ctx.moveTo(platform.x + platform.width * 0.3, platform.y)
            ctx.lineTo(platform.x + platform.width * 0.3, platform.y + platform.height)
            ctx.moveTo(platform.x + platform.width * 0.7, platform.y)
            ctx.lineTo(platform.x + platform.width * 0.7, platform.y + platform.height)
            ctx.stroke()
          }
        }
      })

      particles.forEach((p, idx) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.3
        p.life--
        
        if (p.life <= 0) {
          particles.splice(idx, 1)
        } else {
          ctx.globalAlpha = p.life / 50
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      })

      players.forEach((p, i) => {
        if (!p.alive) {
          p.respawnTimer++
          if (i === 0 && p.respawnTimer >= 600) {
            respawnAI()
          }
          return
        }

        p.vy += gravity
        p.y += p.vy
        p.x += p.vx
        p.vx *= 0.85
        
        const screenTop = cameraY + 40
        if (p.y < screenTop) {
          p.y = screenTop
          p.vy = Math.max(0, p.vy)
        }
        
        let onPlatform = false
        let currentPlatformId: string | null = null
        
        platforms.forEach((platform, platIdx) => {
          const screenY = platform.y - cameraY
          
          if (screenY > canvasHeight * 0.4 && screenY < canvasHeight) {
            if (
              p.x + 40 > platform.x &&
              p.x < platform.x + platform.width &&
              p.y > platform.y - 40 &&
              p.y < platform.y + platform.height &&
              p.vy >= 0
            ) {
              p.y = platform.y
              p.vy = 0
              onPlatform = true
              currentPlatformId = platform.id
              
              if (p.lastPlatformId !== platform.id && platform.maxHits < 999) {
                platform.hits++
                
                if (platform.hits >= platform.maxHits) {
                  createExplosion(platform.x + platform.width / 2, platform.y, platform.ownerSide === 'left' ? '#ef4444' : '#3b82f6')
                  platforms.splice(platIdx, 1)
                  currentPlatformId = null
                }
              }
            }
          }
        })
        
        if (onPlatform) {
          p.lastPlatformId = currentPlatformId
        } else {
          p.lastPlatformId = null
        }

        if (p.y > cameraY + canvasHeight) {
          p.health = 0
          p.alive = false
          p.respawnTimer = 0
          createExplosion(p.x + 20, p.y - 20, p.color)
          
          if (i === 0) {
            setKills(k => k + 1)
          } else {
            running = false
            setGameOver(true)
          }
        }

        if (i === 1 && p.alive) {
          coins.forEach((coin) => {
            if (!coin.collected && 
                Math.abs(p.x + 20 - coin.x) < 25 &&
                Math.abs(p.y - 20 - coin.y) < 25) {
              coin.collected = true
              if (coin.type === 'gold') {
                playerShootTimer = 600
                createExplosion(coin.x, coin.y, '#fbbf24')
              } else {
                playerShootBlackTimer = 600
                createExplosion(coin.x, coin.y, '#1f2937')
              }
            }
          })
        }

        if (p.shootCooldown > 0) p.shootCooldown--

        if (i === 0 && p.alive) {
          const target = players[1]
          if (!target.alive) {
            if (Math.random() < 0.05) {
              p.vx += (Math.random() - 0.5) * 1.0
            }
          } else {
            const distance = Math.abs(target.x - p.x)
            const verticalDistance = target.y - p.y
            
            aiStrategyTimer++
            if (aiStrategyTimer > 180) {
              const strategies: ('aggressive' | 'defensive' | 'tricky')[] = ['aggressive', 'defensive', 'tricky']
              aiStrategy = strategies[Math.floor(Math.random() * strategies.length)]
              aiStrategyTimer = 0
            }

            let targetPlatform = null
            let bestScore = -Infinity
            
            const visiblePlatforms = platforms.filter(platform => {
              const screenY = platform.y - cameraY
              return screenY > canvasHeight * 0.4 && screenY < canvasHeight
            })
            
            const floorsByY = new Map<number, Platform[]>()
            visiblePlatforms.forEach(platform => {
              if (!floorsByY.has(platform.y)) {
                floorsByY.set(platform.y, [])
              }
              floorsByY.get(platform.y)!.push(platform)
            })
            
            floorsByY.forEach((segments, floorY) => {
              if (floorY < p.y - 20) {
                const leftSegments = segments.filter(seg => seg.x < mid && seg.ownerSide === 'left')
                
                if (leftSegments.length > 0) {
                  let closestSegment = null
                  let minDist = Infinity
                  
                  leftSegments.forEach(seg => {
                    const segCenterX = seg.x + seg.width / 2
                    const dist = Math.abs(segCenterX - p.x)
                    if (dist < minDist) {
                      minDist = dist
                      closestSegment = seg
                    }
                  })
                  
                  if (closestSegment) {
                    const verticalDist = p.y - floorY
                    const horizontalDist = minDist
                    
                    let score = verticalDist * 1.5
                    score -= horizontalDist * 0.5
                    score += leftSegments.length * 10
                    
                    if (score > bestScore) {
                      bestScore = score
                      targetPlatform = closestSegment
                    }
                  }
                }
              }
            })

            if (targetPlatform) {
              const platformCenterX = targetPlatform.x + targetPlatform.width / 2
              const horizontalOffset = platformCenterX - p.x
              const platformAbove = targetPlatform.y < p.y - 20
              
              if (Math.abs(horizontalOffset) > 10) {
                const moveSpeed = 0.6
                p.vx += horizontalOffset > 0 ? moveSpeed : -moveSpeed
              }
              
              if (onPlatform && aiJumpCooldown <= 0 && platformAbove) {
                const isAligned = Math.abs(horizontalOffset) < 60
                const shouldJumpUrgently = verticalDistance < -120
                
                if (isAligned || shouldJumpUrgently) {
                  p.vy = -10.5
                  aiJumpCooldown = 15
                  
                  if (Math.abs(horizontalOffset) > 20) {
                    p.vx += horizontalOffset > 0 ? 1.2 : -1.2
                  }
                }
              }
            } else {
              if (Math.random() < 0.1) {
                p.vx += (Math.random() - 0.5) * 1.0
              }
              
              if (onPlatform && aiJumpCooldown <= 0 && verticalDistance < -150) {
                p.vy = -10.5
                aiJumpCooldown = 20
              }
            }

            p.facingRight = target.x > p.x
            aiJumpCooldown--

            if (aiCooldown <= 0 && p.shootCooldown <= 0) {
              const inCombatRange = distance < 300 && Math.abs(verticalDistance) < 180
              
              const shouldShoot = 
                (inCombatRange && Math.random() < 0.15) ||
                (aiStrategy === 'aggressive' && distance < 280 && Math.abs(verticalDistance) < 150 && Math.random() < 0.12) ||
                (aiStrategy === 'tricky' && Math.random() < 0.08)
              
              if (shouldShoot) {
                const angle = Math.atan2(target.y - p.y, target.x - p.x)
                const spread = (Math.random() - 0.5) * 0.3
                projectiles.push({
                  x: p.x + 20,
                  y: p.y - 20,
                  vx: Math.cos(angle + spread) * 8,
                  vy: Math.sin(angle + spread) * 8,
                  owner: 0,
                  bounces: 0
                })
                aiCooldown = 20 + Math.floor(Math.random() * 15)
                p.shootCooldown = 15
              }
            } else {
              aiCooldown--
            }
          }

          if (p.x < 20) p.x = 20
          if (p.x > mid - 60) p.x = mid - 60
        }

        if (i === 1 && p.alive) {
          if (keys[p.controls!.left] && p.x > mid + 20) {
            p.vx -= 0.8
            p.facingRight = false
          }
          if (keys[p.controls!.right] && p.x < canvas.width - 60) {
            p.vx += 0.8
            p.facingRight = true
          }
          if (keys[p.controls!.jump] && onPlatform) {
            p.vy = -12
          }
          if (keys[p.controls!.shoot] && p.shootCooldown <= 0) {
            keys[p.controls!.shoot] = false
            const direction = p.facingRight ? 1 : -1
            
            if (playerShootTimer > 0) {
              projectiles.push({
                x: p.x + 20,
                y: p.y - 20,
                vx: direction * 9,
                vy: 0,
                owner: 1,
                bounces: 0
              })
              p.shootCooldown = 15
            } else if (playerShootBlackTimer > 0) {
              projectiles.push({
                x: p.x + 20,
                y: p.y - 20,
                vx: direction * 9,
                vy: 0,
                owner: 2,
                bounces: 0
              })
              p.shootCooldown = 15
            }
          }

          p.x = Math.max(mid + 20, Math.min(p.x, canvas.width - 60))
        }

        const alpha = !p.alive && i === 0 && p.respawnTimer > 540 
          ? 0.3 + 0.7 * Math.sin((p.respawnTimer - 540) * 0.2) 
          : 1
        
        drawBrain(ctx, p.x, p.y, p.color, p.facingRight, alpha)

        if (p.alive) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)'
          ctx.fillRect(p.x - 5, p.y - 55, 50, 8)
          
          const healthPercent = p.health / p.maxHealth
          const healthColor = healthPercent > 0.5 ? '#10b981' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444'
          ctx.fillStyle = healthColor
          ctx.fillRect(p.x - 5, p.y - 55, 50 * healthPercent, 8)
          
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 1
          ctx.strokeRect(p.x - 5, p.y - 55, 50, 8)
        }

        if (!p.alive && i === 0) {
          const secondsLeft = Math.ceil((600 - p.respawnTimer) / 60)
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fillRect(p.x - 20, p.y - 70, 80, 30)
          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 16px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`Respawn: ${secondsLeft}s`, p.x + 20, p.y - 48)
        }
      })

      projectiles.forEach((proj, idx) => {
        proj.x += proj.vx
        proj.y += proj.vy
        proj.vy += 0.2

        let hitPlatform = false
        platforms.forEach((platform, platIdx) => {
          const screenY = platform.y - cameraY
          const isVisible = screenY > canvasHeight * 0.4 && screenY < canvasHeight
          
          if (isVisible &&
            proj.x > platform.x &&
            proj.x < platform.x + platform.width &&
            proj.y > platform.y &&
            proj.y < platform.y + platform.height
          ) {
            hitPlatform = true
            
            const shouldDamage = 
              (proj.owner === 0 && platform.ownerSide === 'right') ||
              (proj.owner === 1 && platform.ownerSide === 'left')
            
            if (shouldDamage && proj.owner !== 2) {
              platform.hits++
              
              if (platform.hits >= platform.maxHits) {
                createExplosion(proj.x, proj.y, '#8b5cf6')
                createExplosion(platform.x + platform.width / 2, platform.y, '#ef4444')
                platforms.splice(platIdx, 1)
              } else {
                createExplosion(proj.x, proj.y, '#f59e0b')
              }
            } else {
              createExplosion(proj.x, proj.y, '#8b5cf6')
            }
            
            projectiles.splice(idx, 1)
            return
          }
        })
        
        if (hitPlatform) return

        if (proj.y > cameraY + canvasHeight + 100 || proj.y < cameraY - 100) {
          projectiles.splice(idx, 1)
          return
        }

        ctx.shadowBlur = 15
        ctx.shadowColor = proj.owner === 2 ? '#1f2937' : '#fbbf24'
        ctx.fillStyle = proj.owner === 2 ? '#1f2937' : '#fbbf24'
        ctx.beginPath()
        ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.globalAlpha = 0.3
        ctx.fillStyle = proj.owner === 2 ? '#111827' : '#f59e0b'
        ctx.beginPath()
        ctx.arc(proj.x - proj.vx, proj.y - proj.vy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1

        players.forEach((p, i) => {
          if ((i !== proj.owner && proj.owner !== 2 && p.alive) || (proj.owner === 2 && i === 0 && p.alive)) {
            if (
              proj.x > p.x &&
              proj.x < p.x + 40 &&
              proj.y > p.y - 40 &&
              proj.y < p.y
            ) {
              p.health -= 15
              projectiles.splice(idx, 1)
              createExplosion(proj.x, proj.y, p.color)

              if (p.health <= 0) {
                p.alive = false
                p.respawnTimer = 0
                createExplosion(p.x + 20, p.y - 20, p.color)
                
                if (i === 0) {
                  setKills(k => k + 1)
                } else {
                  running = false
                  setGameOver(true)
                }
              }
            }
          }
        })
      })

      ctx.restore()

      coins.forEach((coin) => {
        if (coin.collected) return
        
        const screenY = coin.y - cameraY
        if (screenY > 0 && screenY < canvasHeight) {
          const time = Date.now() / 1000
          const bounce = Math.sin(time * 3) * 3
          const rotation = time * 2
          
          ctx.save()
          ctx.translate(coin.x, screenY + bounce)
          ctx.rotate(rotation)
          
          if (coin.type === 'gold') {
            ctx.shadowBlur = 10
            ctx.shadowColor = '#fbbf24'
            ctx.fillStyle = '#fbbf24'
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.fillStyle = '#f59e0b'
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.shadowBlur = 0
            ctx.fillStyle = '#fbbf24'
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('$', 0, 0)
          } else {
            ctx.shadowBlur = 10
            ctx.shadowColor = '#1f2937'
            ctx.fillStyle = '#1f2937'
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.fillStyle = '#111827'
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.shadowBlur = 0
            ctx.fillStyle = '#6b7280'
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('☠', 0, 0)
          }
          
          ctx.restore()
        }
      })

      if (running) requestAnimationFrame(gameLoop)
    }

    if (gameStarted && !gameOver) {
      gameLoop()
    }

    return () => {
      running = false
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
    }
  }, [gameId, gameStarted, gameOver])

  const resetGame = () => {
    setKills(0)
    setHeight(0)
    setGameOver(false)
    setCanShoot(false)
    setShootTimeLeft(0)
    setCanShootBlack(false)
    setShootBlackTimeLeft(0)
    setGameId(id => id + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-white mb-2">
            Brain Battle: Endless Ascension
          </h1>
          <p className="text-gray-300">Survive and climb as high as you can!</p>
        </div>

        {!gameStarted ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center space-y-6">
            <div className="text-6xl">⬆️🧠</div>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">How to Play</h2>
              <div className="text-left space-y-2 text-gray-300">
                <p>🎮 <strong>Move:</strong> Arrow Left/Right</p>
                <p>⬆️ <strong>Jump:</strong> Arrow Up</p>
                <p>🪙 <strong>Gold Coins:</strong> Destroy enemy platforms (lasts 10s)</p>
                <p>☠️ <strong>Black Coins:</strong> Only damage the enemy, not platforms (lasts 10s)</p>
                <p>💥 <strong>Shoot:</strong> Spacebar (when you have a coin)</p>
                <p>🎯 <strong>Goal:</strong> Destroy enemy floor sections to make them fall!</p>
                <p className="text-red-400 text-sm mt-2 font-bold">⚠️ Screen auto-scrolls UP!</p>
                <p className="text-yellow-300 text-sm">🔨 Each floor segment takes 3 hits to destroy</p>
                <p className="text-blue-300 text-sm">🏆 Red = AI territory, Blue = Your territory</p>
                <p className="text-green-400 text-sm font-bold">♾️ Enemies respawn every 10 seconds - survive as long as you can!</p>
              </div>
            </div>
            <button
              onClick={() => setGameStarted(true)}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-white"
            >
              Start Battle 🚀
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-2xl">
                  🤖
                </div>
                <div>
                  <div className="text-white font-bold">AI Brain</div>
                  <div className="text-sm text-gray-400">Respawns in 10s</div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-white text-sm">Kills</div>
                <div className="text-3xl font-bold text-yellow-400">{kills}</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-white text-sm">Height</div>
                <div className="text-2xl font-bold text-green-400">{height}m</div>
              </div>
              {canShoot && (
                <div className="text-center">
                  <div className="text-white text-sm">Gold Shot</div>
                  <div className="text-2xl font-bold text-yellow-400">{shootTimeLeft}s</div>
                </div>
              )}
              {canShootBlack && (
                <div className="text-center">
                  <div className="text-white text-sm">Black Shot</div>
                  <div className="text-2xl font-bold text-gray-400">{shootBlackTimeLeft}s</div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-white font-bold text-right">Player</div>
                  <div className={`text-sm text-right ${canShoot || canShootBlack ? (canShoot ? 'text-yellow-400' : 'text-gray-400') : 'text-gray-400'}`}>
                    {canShoot ? '💥 Gold!' : canShootBlack ? '☠️ Black!' : '🪙 Find Coin'}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-2xl">
                  🧠
                </div>
              </div>
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="border-4 border-purple-500/50 rounded-2xl w-full shadow-2xl"
                style={{ boxShadow: '0 0 50px rgba(139, 92, 246, 0.5)' }}
              />
              
              {gameOver && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <div className="text-center space-y-4 p-8">
                    <div className="text-6xl mb-4">💀</div>
                    <div className="text-4xl font-bold text-white mb-2">
                      Game Over!
                    </div>
                    <div className="text-2xl text-yellow-400">
                      Kills: {kills}
                    </div>
                    <div className="text-2xl text-green-400">
                      Height: {height}m
                    </div>
                    <button
                      onClick={resetGame}
                      className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 text-white"
                    >
                      Try Again 🔄
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={resetGame}
                className="px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/30 transition-all duration-200 text-white font-semibold"
              >
                Restart Game
              </button>
              <button
                onClick={() => {
                  setGameStarted(false)
                  resetGame()
                }}
                className="px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/30 transition-all duration-200 text-white font-semibold"
              >
                Back to Menu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default BrainBattle