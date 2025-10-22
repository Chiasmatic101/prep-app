// =============================================================
// src/types/peaks.ts
// =============================================================


export type MetricName = 'attention' | 'concentration' | 'memory'


export type PeakPoint = {
time: string // 'HH:mm'
attention: number // 0–100
concentration: number // 0–100
memory: number // 0–100
}


export type ScheduleBlock = {
id: string
title: string
start: string // 'HH:mm'
end: string // 'HH:mm'
type?: 'class' | 'study' | 'break' | 'exam' | 'other'
location?: string
}