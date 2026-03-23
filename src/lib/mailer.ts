import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendVerificationEmail(to: string, code: string, firstName: string) {
  await transporter.sendMail({
    from: '"Wakama Farm" <register@wakama.farm>',
    to,
    subject: 'Code de vérification Wakama',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1117; color: #dfe2eb; padding: 40px; border-radius: 12px;">
        <img src="https://farmer.wakama.farm/wakama-logo.png" height="48" alt="Wakama" style="margin-bottom: 24px;" />
        <h2 style="color: #ec5b13;">Bienvenue ${firstName} !</h2>
        <p>Votre code de vérification Wakama est :</p>
        <div style="background: #1a120e; border: 2px solid #ec5b13; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; color: #ec5b13; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">Ce code expire dans 15 minutes. Ne le partagez avec personne.</p>
        <hr style="border-color: #374151; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">Wakama Edge Ventures Inc. — Wyoming, USA</p>
      </div>
    `,
  })
}
