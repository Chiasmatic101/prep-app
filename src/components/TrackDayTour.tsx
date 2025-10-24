'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'
import { createRoot, Root } from 'react-dom/client'
import { TourMascot, SpeechBubble } from './Tour/TourMascot'

type TrackStepMeta = {
  id: string
  target: string
  on: 'top' | 'bottom' | 'left' | 'right'
  message: string
  color?: 'purple' | 'blue' | 'pink' | 'green'
}

export default function TrackDayTour({
  run,
  onComplete
}: {
  run: boolean
  onComplete?: () => void
}) {
  const tourRef = useRef<any>(null)
  const rootsRef = useRef<Map<string, Root>>(new Map())

  // ✅ Define steps for Track My Day here
  const steps = useMemo<TrackStepMeta[]>(() => [
    {
      id: 'nutrition',
      target: '.nutrition-button',
      on: 'top',
      message: 'Start here to log your meals and hydration.',
      color: 'green'
    },
    {
      id: 'activity',
      target: '.activity-button',
      on: 'top',
      message: 'Track your daily exercise and movement here.',
      color: 'blue'
    },
    {
      id: 'sleep',
      target: '.sleep-button',
      on: 'top',
      message: 'Record your sleep duration and quality.',
      color: 'purple'
    },
    {
      id: 'reset',
      target: '.reset-button',
      on: 'top',
      message: 'Use reset to clear your daily entries and start fresh.',
      color: 'pink'
    }
  ], [])

  useEffect(() => {
    if (!run) {
      if (tourRef.current) {
        try { tourRef.current.cancel() } catch {}
      }
      return
    }

    const tour = new Shepherd.Tour({
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        scrollTo: { behavior: 'smooth', block: 'center' },
        classes: 'bg-transparent p-0 shadow-none border-0'
      },
      useModalOverlay: true
    })
    tourRef.current = tour

    const mount = (id: string, meta: TrackStepMeta) => {
      const step = tour.getCurrentStep()
      if (!step) return
      const el = step.getElement()?.querySelector(`#mascot-container-${id}`)
      if (!el) return

      // Clean up previous
      const prev = rootsRef.current.get(id)
      if (prev) {
        try { prev.unmount() } catch {}
      }

      const root = createRoot(el)
      rootsRef.current.set(id, root)

      // Mascot enter-from side (opposite of attach side)
      const enterFrom = meta.on === 'left' ? 'right' : 'left'

      root.render(
        <div className="flex items-start gap-3">
          <TourMascot emotion="happy" size="lg" pointDirection={meta.on} />
          <SpeechBubble position="right" color={meta.color || 'purple'} enterFrom={enterFrom}>
            <div className="space-y-1">
              {id === steps[0].id && (
                <div className="font-bold text-sm">Hi, I’m Sync!</div>
              )}
              <div className="text-sm leading-relaxed">{meta.message}</div>
            </div>
          </SpeechBubble>
        </div>
      )
    }

    const unmount = (id: string) => {
      const root = rootsRef.current.get(id)
      if (root) {
        try { root.unmount() } catch {}
        rootsRef.current.delete(id)
      }
    }

    steps.forEach((s, index) => {
      const containerId = `mascot-container-${s.id}`
      tour.addStep({
        id: s.id,
        attachTo: { element: s.target, on: s.on },
        title: '',
        text: `<div id="${containerId}" style="margin:0;padding:0;"></div>`,
        when: {
          show: () => mount(s.id, s),
          hide: () => unmount(s.id)
        },
        buttons: [
          ...(index > 0
            ? [{ text: 'Back', action: tour.back }]
            : [{ text: 'Skip', action: tour.cancel, secondary: true }]),
          ...(index < steps.length - 1
            ? [{ text: 'Next', action: tour.next }]
            : [{ text: 'Finish', action: tour.complete }])
        ]
      })
    })

    tour.on('complete', () => {
      onComplete?.()
      cleanup()
    })
    tour.on('cancel', () => {
      onComplete?.()
      cleanup()
    })

    tour.start()

    function cleanup() {
      rootsRef.current.forEach((root) => {
        try { root.unmount() } catch {}
      })
      rootsRef.current.clear()
      try { tour.cancel() } catch {}
      tourRef.current = null
    }

    return cleanup
  }, [run, steps, onComplete])

  return null
}
