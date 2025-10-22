// components/WeekendDriftTracker.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'

interface WeekendDriftTrackerProps {
  challengeId: string
  progress: any
}

export const WeekendDriftTracker: React.FC<WeekendDriftTrackerProps> = ({
  challengeId,
  progress
}) => {
  const [weekdayAverage, setWeekdayAverage] = useState<number | null>(null)
  const [weekendTimes, setWeekendTimes] = useState<{ sat?: string; sun?: string }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    calculateWeekdayAverage()
    checkWeekendTimes()
  }, [])

  const calculateWeekdayAverage = async () => {
    if (!auth.currentUser) return

    try {
      // Get last 7 days of sleep data
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const sleepQuery = query(
        collection(db, 'users', auth.currentUser.uid, 'sleepEntries'),
        orderBy('date', 'desc')
      )
      
      const snapshot = await getDocs(sleepQuery)
      const weekdayTimes: number[] = []
      
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        const date = new Date(doc.id)
        const dayOfWeek = date.getDay()
        
        // Tuesday (2), Wednesday (3), Thursday (4)
        if (dayOfWeek >= 2 && dayOfWeek <= 4) {
          const wakeTime = new Date(`2024-01-01T${data.wakeTime}`)
          const minutesSinceMidnight = wakeTime.getHours() * 60 + wakeTime.getMinutes()
          weekdayTimes.push(minutesSinceMidnight)
        }
      })
      
      if (weekdayTimes.length > 0) {
        const average = weekdayTimes.reduce((a, b) => a + b, 0) / weekdayTimes.length
        setWeekdayAverage(average)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error calculating weekday average:', error)
      setLoading(false)
    }
  }

  const checkWeekendTimes = async () => {
    if (!auth.currentUser) return

    try {
      // Get this weekend's sleep data
      const today = new Date()
      const dayOfWeek = today.getDay()
      
      // Calculate dates for last/this weekend
      let satDate = new Date(today)
      let sunDate = new Date(today)
      
      if (dayOfWeek === 0) { // Sunday
        satDate.setDate(today.getDate() - 1)
      } else if (dayOfWeek === 6) { // Saturday
        sunDate.setDate(today.getDate() + 1)
      } else {
        // Find previous Saturday and Sunday
        const daysToSaturday = dayOfWeek === 0 ? 1 : dayOfWeek + 1
        satDate.setDate(today.getDate() - daysToSaturday)
        sunDate.setDate(satDate.getDate() + 1)
      }
      
      const satDoc = await getDocs(
        query(
          collection(db, 'users', auth.currentUser.uid, 'sleepEntries'),
          where('date', '==', satDate.toISOString().split('T')[0])
        )
      )
      
      const sunDoc = await getDocs(
        query(
          collection(db, 'users', auth.currentUser.uid, 'sleepEntries'),
          where('date', '==', sunDate.toISOString().split('T')[0])
        )
      )
      
      const weekend: { sat?: string; sun?: string } = {}
      
      if (!satDoc.empty) {
        weekend.sat = satDoc.docs[0].data().wakeTime
      }
      
      if (!sunDoc.empty) {
        weekend.sun = sunDoc.docs[0].data().wakeTime
      }
      
      setWeekendTimes(weekend)
    } catch (error) {
      console.error('Error checking weekend times:', error)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const calculateDrift = (weekendTime: string) => {
    if (!weekdayAverage) return null
    
    const wakeTime = new Date(`2024-01-01T${weekendTime}`)
    const minutesSinceMidnight = wakeTime.getHours() * 60 + wakeTime.getMinutes()
    return Math.abs(minutesSinceMidnight - weekdayAverage)
  }

  const isWithinTarget = (drift: number | null) => {
    return drift !== null && drift <= 60
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-purple-600 text-white">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Weekend Drift Monitor</h3>
          <p className="text-sm text-gray-600">Keep weekend sleep consistent with weekdays</p>
        </div>
      </div>

      {/* Weekday Average */}
      {weekdayAverage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-800">Your Weekday Average</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {formatTime(weekdayAverage)}
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Based on Tue-Thu wake times
          </p>
        </div>
      )}

      {/* Weekend Progress */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-800">This Weekend</h4>
        
        {/* Saturday */}
        <div className={`rounded-lg p-4 border-2 ${
          weekendTimes.sat
            ? isWithinTarget(calculateDrift(weekendTimes.sat))
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-800 mb-1">Saturday</div>
              {weekendTimes.sat ? (
                <>
                  <div className="text-lg font-bold text-gray-900">
                    Wake: {weekendTimes.sat}
                  </div>
                  {weekdayAverage && (
                    <div className="text-sm text-gray-600 mt-1">
                      Drift: {calculateDrift(weekendTimes.sat)}min from weekday average
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-600">Not logged yet</div>
              )}
            </div>
            {weekendTimes.sat && weekdayAverage && (
              isWithinTarget(calculateDrift(weekendTimes.sat)) ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              )
            )}
          </div>
        </div>

        {/* Sunday */}
        <div className={`rounded-lg p-4 border-2 ${
          weekendTimes.sun
            ? isWithinTarget(calculateDrift(weekendTimes.sun))
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-800 mb-1">Sunday</div>
              {weekendTimes.sun ? (
                <>
                  <div className="text-lg font-bold text-gray-900">
                    Wake: {weekendTimes.sun}
                  </div>
                  {weekdayAverage && (
                    <div className="text-sm text-gray-600 mt-1">
                      Drift: {calculateDrift(weekendTimes.sun)}min from weekday average
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-600">Not logged yet</div>
              )}
            </div>
            {weekendTimes.sun && weekdayAverage && (
              isWithinTarget(calculateDrift(weekendTimes.sun)) ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              )
            )}
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      {weekendTimes.sat && weekendTimes.sun && weekdayAverage && (
        <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">Weekend Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Target:</span>
              <span className="font-medium">Within 60 min of weekday average</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold ${
                isWithinTarget(calculateDrift(weekendTimes.sat)) && 
                isWithinTarget(calculateDrift(weekendTimes.sun))
                  ? 'text-green-600'
                  : 'text-yellow-600'
              }`}>
                {isWithinTarget(calculateDrift(weekendTimes.sat)) && 
                 isWithinTarget(calculateDrift(weekendTimes.sun))
                  ? '✓ Both days on target!'
                  : '⚠ Keep working on consistency'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Educational Content */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-800 mb-2">💡 About Social Jetlag</h4>
        <p className="text-sm text-purple-700">
          Weekend sleep-in creates "social jetlag" - your body thinks it traveled across time zones. 
          Keeping wake times consistent (within 1 hour) helps maintain your circadian rhythm and 
          improves Monday morning alertness.
        </p>
      </div>
    </div>
  )
}