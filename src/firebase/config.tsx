// src/firebase/config.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyBnr_f2FBBnyiHlaj3j0MNEn_g-EQPHSEw',
  authDomain: 'prepapp-fae61.firebaseapp.com',
  projectId: 'prepapp-fae61',
  storageBucket: 'prepapp-fae61.appspot.com',
  messagingSenderId: '522030173751',
  appId: '1:522030173751:web:89bd03c223761375d979b2',
  measurementId: 'G-CHR2E9ZSF2',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null
