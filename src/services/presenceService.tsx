import { auth, db } from '@/firebase/config'
import { doc, setDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'

export type UserStatus = 'online' | 'offline' | 'studying' | 'away'

export class PresenceService {
  private unsubscribe: (() => void) | null = null

  async setStatus(status: UserStatus, activity?: string) {
    if (!auth.currentUser) return

    const presenceRef = doc(db, 'userPresence', auth.currentUser.uid)
    await setDoc(presenceRef, {
      userId: auth.currentUser.uid,
      status,
      lastSeen: serverTimestamp(),
      currentActivity: activity || null,
      studySessionStart: status === 'studying' ? serverTimestamp() : null
    }, { merge: true })
  }

  startTracking() {
    if (!auth.currentUser) return

    this.setStatus('online')

    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.setStatus('away')
      } else {
        this.setStatus('online')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    window.addEventListener('beforeunload', () => {
      this.setStatus('offline')
    })

    const heartbeat = setInterval(() => {
      if (!document.hidden) {
        this.setStatus('online')
      }
    }, 30000)

    this.unsubscribe = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(heartbeat)
    }
  }

  stopTracking() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.setStatus('offline')
    }
  }

  subscribeToFriendsPresence(
    friendIds: string[], 
    callback: (presence: any[]) => void
  ) {
    if (friendIds.length === 0) return () => {}

    const presenceQuery = query(
      collection(db, 'userPresence'),
      where('userId', 'in', friendIds.slice(0, 10))
    )

    return onSnapshot(presenceQuery, (snapshot) => {
      const presenceData = snapshot.docs.map(doc => doc.data())
      callback(presenceData)
    })
  }
}

export const presenceService = new PresenceService()