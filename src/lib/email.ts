import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInviteEmail(
  to: string, 
  fromName: string, 
  message: string, 
  inviteLink: string
) {
  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to,
    subject: `${fromName} invited you to join SyncLearn!`,
    html: `
      <h2>${fromName} thinks you'd love SyncLearn!</h2>
      <p>${message}</p>
      <p><a href="${inviteLink}">Accept Invitation</a></p>
    `
  })
}