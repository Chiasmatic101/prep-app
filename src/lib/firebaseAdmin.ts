import * as admin from 'firebase-admin'

// Only initialize if we're not in a build environment
const isBuilding = process.env.NODE_ENV === 'production' && !process.env.FIREBASE_ADMIN_PROJECT_ID

if (!admin.apps.length && !isBuilding) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      } as admin.ServiceAccount),
    })
  } catch (error) {
    console.error('Firebase admin initialization error:', error)
  }
}

// Export with safe fallback for build time
export const adminDb = admin.apps.length ? admin.firestore() : null as any
export const adminAuth = admin.apps.length ? admin.auth() : null as any
