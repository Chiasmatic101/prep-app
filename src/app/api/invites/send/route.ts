import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import * as admin from 'firebase-admin'  // Add this import
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { emails, message, userId } = await request.json()
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'No email addresses provided' }, { status: 400 })
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user data using Admin SDK
    const userDoc = await adminDb.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const userData = userDoc.data()
    const inviteCode = userData?.inviteCode || userId.substring(0, 8)
    const fromName = userData?.name || 'A friend'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${appUrl}/join?ref=${inviteCode}`
    
    const invitePromises = emails.map(async (email) => {
      // Store in database using Admin SDK
      const inviteRef = await adminDb.collection('invites').add({
        from: userId,
        fromName: fromName,
        to: email.trim(),
        message: message || 'Join me on SyncLearn!',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),  // Now admin is defined
        inviteCode: inviteCode
      })
      
      // Send email via Resend
      try {
        await resend.emails.send({
          from: 'SyncLearn <onboarding@resend.dev>',
          to: email.trim(),
          subject: `${fromName} invited you to join SyncLearn!`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited to SyncLearn!</h1>
                </div>
                
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 18px; color: #667eea; font-weight: 600;">Hey there!</p>
                  
                  <p style="font-size: 16px; margin: 20px 0;">${fromName} thinks you'd love SyncLearn - a platform that helps optimize your study time based on your unique chronotype.</p>
                  
                  ${message ? `
                    <div style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; font-style: italic;">
                      "${message}"
                    </div>
                  ` : ''}
                  
                  <div style="margin: 30px 0; text-align: center;">
                    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">Join SyncLearn</a>
                  </div>
                  
                  <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c5282; margin-top: 0;">What is SyncLearn?</h3>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                      <li>Discover your chronotype (are you a night owl or early bird?)</li>
                      <li>Get personalized learning schedules</li>
                      <li>Track sleep and cognitive performance</li>
                      <li>Challenge friends in brain training games</li>
                    </ul>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">If the button doesn't work, copy and paste this link: <a href="${inviteLink}" style="color: #667eea;">${inviteLink}</a></p>
                  
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                  
                  <p style="font-size: 12px; color: #999; text-align: center;">This invitation was sent by ${fromName}. If you don't want to receive invitations, you can safely ignore this email.</p>
                </div>
              </body>
            </html>
          `
        })
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError)
      }
      
      return inviteRef
    })
    
    await Promise.all(invitePromises)
    
    return NextResponse.json({ 
      success: true, 
      message: `${emails.length} invite(s) sent successfully` 
    })
  } catch (error) {
    console.error('Error sending invites:', error)
    return NextResponse.json({ 
      error: 'Failed to send invites',
    details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
