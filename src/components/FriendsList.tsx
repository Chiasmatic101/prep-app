'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Circle, BookOpen, Clock, Search } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import { presenceService } from '@/services/presenceService'

interface Friend {
  uid: string
  name: string
  chronotype?: string
  status: 'online' | 'offline' | 'studying' | 'away'
  lastSeen?: Date
  currentActivity?: string
  studySessionStart?: Date
}

export default function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadFriends()
  }, [])

  const loadFriends = async () => {
    if (!auth.currentUser) return

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
      const userData = userDoc.data()
      const friendIds = userData?.friends || []

      if (friendIds.length === 0) {
        setLoading(false)
        return
      }

      const friendsData: Friend[] = []
      
      for (const friendId of friendIds) {
        const friendDoc = await getDoc(doc(db, 'users', friendId))
        if (friendDoc.exists()) {
          const friendData = friendDoc.data()
          friendsData.push({
            uid: friendId,
            name: friendData.name || 'Unknown',
            chronotype: friendData.chronotype?.chronotype,
            status: 'offline'
          })
        }
      }

      setFriends(friendsData)

      const unsubscribe = presenceService.subscribeToFriendsPresence(
        friendIds,
        (presenceData) => {
          setFriends(prevFriends => 
            prevFriends.map(friend => {
              const presence = presenceData.find(p => p.userId === friend.uid)
              if (presence) {
                return {
                  ...friend,
                  status: presence.status,
                  lastSeen: presence.lastSeen?.toDate(),
                  currentActivity: presence.currentActivity,
                  studySessionStart: presence.studySessionStart?.toDate()
                }
              }
              return friend
            })
          )
        }
      )

      setLoading(false)
      return () => unsubscribe()
    } catch (error) {
      console.error('Error loading friends:', error)
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'studying': return 'bg-blue-500'
      case 'away': return 'bg-yellow-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online'
      case 'studying': return 'Studying'
      case 'away': return 'Away'
      default: return 'Offline'
    }
  }

  const getStudyDuration = (startTime?: Date) => {
    if (!startTime) return ''
    const minutes = Math.floor((Date.now() - startTime.getTime()) / 60000)
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  }

  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const onlineFriends = filteredFriends.filter(f => f.status === 'online' || f.status === 'studying')
  const offlineFriends = filteredFriends.filter(f => f.status === 'offline' || f.status === 'away')

  if (loading) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-800">Friends</h2>
          <span className="text-sm text-gray-500">
            ({onlineFriends.length} online)
          </span>
        </div>
      </div>

      {friends.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No friends yet</p>
          <button
            onClick={() => window.location.href = '/Prep/FriendsPage'}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Invite friends to get started
          </button>
        </div>
      ) : (
        <>
          {friends.length > 5 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search friends..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {onlineFriends.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Online</h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {onlineFriends.map(friend => (
                    <motion.div
                      key={friend.uid}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold">
                          {friend.name[0].toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${getStatusColor(friend.status)} rounded-full border-2 border-white`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800 truncate">{friend.name}</p>
                          {friend.chronotype && (
                            <span className="text-xs text-gray-500">{friend.chronotype}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          {friend.status === 'studying' ? (
                            <>
                              <BookOpen className="w-3 h-3" />
                              <span>{friend.currentActivity || 'Studying'}</span>
                              {friend.studySessionStart && (
                                <span className="text-gray-500">{getStudyDuration(friend.studySessionStart)}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <Circle className="w-2 h-2 fill-current text-green-500" />
                              <span>{getStatusText(friend.status)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {offlineFriends.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Offline</h3>
              <div className="space-y-2">
                {offlineFriends.map(friend => (
                  <div
                    key={friend.uid}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg opacity-60"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-semibold">
                        {friend.name[0].toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{friend.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Offline</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}