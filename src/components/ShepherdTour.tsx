'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css' // Shepherd styles
import { createRoot, Root } from 'react-dom/client'
import { TourMascot, SpeechBubble } from './Tour/TourMascot'

type StepMeta = {
  id: string
  target: string
  on: 'top' | 'bottom' | 'left' | 'right'
  message: string
  emotion?: 'happy' | 'excited' | 'winking'
  point?: 'left' | 'right' | 'up' | 'down'
  color?: 'purple' | 'blue' | 'pink' | 'green'
}

export default function AppTour({
  run,
  onComplete
}: {
  run: boolean
  onComplete?: () => void
}) {
  const tourRef = useRef<Shepherd.Tour | null>(null)
  const rootsRef = useRef<Map<string, Root>>(new Map())

  // Define your steps here (selectors must exist on the page)
  const steps = useMemo<StepMeta[]>(
    () => [
      {
        id: 'welcome',
        target: '.welcome-header h1',
        on: 'bottom',
        message: 'Welcome to your learning hub! We can take a quick tour.',
        emotion: 'excited',
        point: 'right',
        color: 'purple'
      },
      {
        id: 'tabs',
        target: '.navigation-tabs',
        on: 'top',
        message: 'Use these tabs to explore your dashboard.',
        emotion: 'happy',
        point: 'down',
        color: 'blue'
      },
      {
        id: 'profile',
        target: '.profile-tab-content',
        on: 'right',
        message: 'Your Profile shows your chronotype, Sync Score, and timeline.',
        emotion: 'happy',
        point: 'left',
        color: 'pink'
      },
      {
        id: 'sync',
        target: '.sync-score-display',
        on: 'top',
        message:
          'This is your Sync Score. This measures how well your brain performance matches your schedule, we can make this higher by improving sleep, diet and lifestyle through challenges.',
        emotion: 'excited',
        point: 'up',
        color: 'green'
      },
      {
        id: 'peaktime',
        target: '.peak-learning-time',
        on: 'bottom',
        message: 'Your Peak Learning Time—studying here gives you the biggest gains.',
        emotion: 'happy',
        point: 'right',
        color: 'purple'
      },
      {
        id: 'games',
        target: '.brain-games-button',
        on: 'top',
        message:
          'Play brain games to track improvements in focus and memory as you try new habits.',
        emotion: 'happy',
        point: 'up',
        color: 'blue'
      }
    ],
    []
  )

  // --- keep imports and setup as-is ---

  useEffect(() => {
    if (!run) {
      if (tourRef.current) {
        try { tourRef.current.cancel() } catch {}
      }
      document.body.style.overflow = 'auto'
      return
    }

    document.body.style.overflow = 'hidden'

    const tour = new Shepherd.Tour({
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        scrollTo: { behavior: 'smooth', block: 'center' },
        classes: 'bg-transparent p-0 shadow-none border-0'
      },
      useModalOverlay: true
    })
    tourRef.current = tour

    const mount = (id: string) => {
      const step = tour.getCurrentStep()
      if (!step) return
      const el = step.getElement()?.querySelector(`#mascot-container-${id}`)
      if (!el) return

      // Unmount any previous root for this id
      const prev = rootsRef.current.get(id)
      if (prev) {
        try { prev.unmount() } catch {}
      }

      const root = createRoot(el)
      rootsRef.current.set(id, root)

      const meta = steps.find(s => s.id === id)

      // Decide entrance: only for the first step & only once ever
      let enter = false
      try {
        const already = localStorage.getItem('mascotIntroPlayed') === '1'
        const isFirstStep = id === steps[0].id
        enter = isFirstStep && !already
        if (enter) localStorage.setItem('mascotIntroPlayed', '1')
      } catch {}

      // Fly in from the opposite side of attachTo for a nice effect
      const enterFrom = meta?.on === 'left' ? 'right' : 'left'

      // Check if this is the first step
      const isFirstStep = id === steps[0].id

      root.render(
        <div className="flex items-start gap-3">
          <TourMascot
            emotion={meta?.emotion}
            size="lg"
            enter={enter}
            enterFrom={enterFrom}
          />
          <SpeechBubble
            position="right"
            color={meta?.color || 'purple'}
            enter={enter}
            enterFrom={enterFrom}
          >
            <div className="space-y-1">
              {isFirstStep && <div className="font-bold text-sm">Hi, I'm Sync</div>}
              <div className="text-sm leading-relaxed">{meta?.message}</div>
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

    // Add steps with per-step show/hide hooks + placeholder for the portal
    steps.forEach((s) => {
      const containerId = `mascot-container-${s.id}`
      tour.addStep({
        id: s.id,
        attachTo: { element: s.target, on: s.on },
        title: '',
        text: `<div id="${containerId}" style="margin:0;padding:0;"></div>`,
        when: {
          show: () => mount(s.id),
          hide: () => unmount(s.id)
        },
        buttons: [
          ...(s.id !== steps[0].id
            ? [{ text: 'Back', action: tour.back }]
            : [{ text: 'Skip', action: tour.cancel, secondary: true }]),
          ...(s.id !== steps[steps.length - 1].id
            ? [{ text: 'Next', action: tour.next }]
            : [{ text: 'Finish', action: tour.complete }])
        ]
      })
    })

    tour.on('complete', () => {
      document.body.style.overflow = 'auto'
      onComplete?.()
      cleanup()
    })
    tour.on('cancel', () => {
      document.body.style.overflow = 'auto'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, steps])

  return null
}