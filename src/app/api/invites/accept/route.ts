import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import * as admin from 'firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const { userId, inviteCode } = await request.json()

    if (!userId || !inviteCode) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Find the invite
    const invitesSnapshot = await adminDb
      .collection('invites')
      .where('inviteCode', '==', inviteCode)
      .where('status', '==', 'pending')
      .get()

    if (invitesSnapshot.empty) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const inviteDoc = invitesSnapshot.docs[0]
    const inviteData = inviteDoc.data()
    const friendUserId = inviteData.from

    // Update invite status
    await inviteDoc.ref.update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    // Add to both users' friend lists
    await adminDb.collection('users').doc(userId).update({
      friends: admin.firestore.FieldValue.arrayUnion(friendUserId)
    })

    await adminDb.collection('users').doc(friendUserId).update({
      friends: admin.firestore.FieldValue.arrayUnion(userId)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error accepting invite:', error)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}