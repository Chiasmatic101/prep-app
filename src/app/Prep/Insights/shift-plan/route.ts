import { NextRequest, NextResponse } from 'next/server'
import { DateTime } from 'luxon'

type Direction = 'advance' | 'delay'
interface ReqBody {
  tz: string
  currentWake: string   // "HH:mm"
  targetWake: string    // "HH:mm"
  sleepNeedMin?: number // default 540 (9h) for teens
  direction: Direction
  days?: number         // default 7
}

const clamp = (x:number, lo:number, hi:number)=>Math.min(hi, Math.max(lo,x))

function addMinutes(hhmm:string, m:number) {
  const [H,M] = hhmm.split(':').map(Number)
  const dt = DateTime.utc().set({hour:H, minute:M}).plus({ minutes:m })
  return dt.toFormat('HH:mm')
}

export function generatePlan(body: ReqBody) {
  const {
    tz, currentWake, targetWake,
    sleepNeedMin = 9*60,
    direction,
    days = 7,
  } = body

  const stepPerDay = direction==='advance' ? -30 : 30 // 30 min/day
  const plan: any[] = []
  let wake = currentWake

  for (let d=0; d<days; d++) {
    // compute step toward target
    const diffMin =
      DateTime.fromFormat(targetWake,'HH:mm').diff(DateTime.fromFormat(wake,'HH:mm'),'minutes').minutes
    const thisStep = Math.abs(diffMin) < Math.abs(stepPerDay) ? diffMin : stepPerDay
    const nextWake = addMinutes(wake, thisStep)
    const bed = addMinutes(nextWake, -sleepNeedMin)

    // Light windows
    const light_seek = direction==='advance'
      ? [[addMinutes(nextWake, 15), addMinutes(nextWake, 60)]]               // AM light soon after wake
      : [[addMinutes(nextWake, 540), addMinutes(nextWake, 600)]]             // ~9–10h after wake (evening)
    const light_avoid = direction==='advance'
      ? [[addMinutes(bed, -180), bed]]                                       // dim last 3h
      : [[addMinutes(bed, -90), bed]]                                        // shorter dim (still dim before bed)

    // Meals
    const meals = direction==='advance'
      ? { breakfast_by: addMinutes(nextWake, 90), lunch: ["12:00","13:30"], dinner_end_by: addMinutes(bed, -180) }
      : { breakfast: ["08:00","10:00"], lunch: ["12:30","14:00"], dinner_end_by: addMinutes(bed, -120) }

    // Exercise
    const exercise_window = direction==='advance'
      ? [addMinutes(nextWake, 120), addMinutes(nextWake, 240)]               // late morning
      : [addMinutes(nextWake, 540), addMinutes(nextWake, 660)]               // late afternoon/evening

    plan.push({
      date: DateTime.now().setZone(tz).plus({ days: d }).toFormat('yyyy-LL-dd'),
      tz,
      wake: nextWake,
      bed,
      light_seek,
      light_avoid,
      exercise_window,
      meals,
      nap: { allowed: true, latest: addMinutes(nextWake, 480-90), max_minutes: 20 }
    })

    wake = nextWake
  }

  return { plan }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ReqBody
  const result = generatePlan(body)
  return NextResponse.json(result)
}

// (Optional) make sure this route always runs server-side
export const dynamic = 'force-dynamic'
