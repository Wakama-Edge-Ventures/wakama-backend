import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendIotKitNotification(data: {
  coopName: string
  superficie?: number
  culture?: string
  nbMembres?: number
  hasElectricite: boolean
  hasConnexion: boolean
  message?: string
}) {
  await transporter.sendMail({
    from: '"Wakama Farm" <register@wakama.farm>',
    to: 'wakama.onboarding@gmail.com',
    subject: `📡 Demande kit IoT — ${data.coopName}`,
    html: `
      <div style="font-family: Arial; background: #0D1117; color: #dfe2eb; padding: 32px; border-radius: 12px;">
        <img src="https://farmer.wakama.farm/wakama-logo.png" height="48" alt="Wakama" style="margin-bottom: 24px;" />
        <h2 style="color: #ec5b13;">📡 Nouvelle demande de kit IoT</h2>
        <div style="background: #1a120e; border-radius: 8px; padding: 24px; margin: 16px 0;">
          <p><b style="color:#ec5b13">Coopérative:</b> ${data.coopName}</p>
          <p><b style="color:#ec5b13">Superficie:</b> ${data.superficie ?? 'N/A'} ha</p>
          <p><b style="color:#ec5b13">Culture principale:</b> ${data.culture ?? 'N/A'}</p>
          <p><b style="color:#ec5b13">Nombre de membres:</b> ${data.nbMembres ?? 'N/A'}</p>
          <p><b style="color:#ec5b13">Électricité sur site:</b> ${data.hasElectricite ? '✅ Oui' : '❌ Non'}</p>
          <p><b style="color:#ec5b13">WiFi/4G sur site:</b> ${data.hasConnexion ? '✅ Oui' : '❌ Non'}</p>
          <p><b style="color:#ec5b13">Message:</b> ${data.message ?? 'Aucun'}</p>
        </div>
        <hr style="border-color: #374151;" />
        <p style="color: #6b7280; font-size: 12px;">Wakama Edge Ventures Inc. — Wyoming, USA</p>
      </div>
    `
  })
}

export async function sendOnboardingNotification(farmer: {
  id: string
  firstName: string
  lastName: string
  phone: string
  region: string
  village: string
  country?: string
  surface?: number
  cooperativeId?: string | null
  kycStatus: string
  cniUrl?: string | null
  attestationUrl?: string | null
  onboardedAt: Date
}, user: {
  email: string
}) {
  await transporter.sendMail({
    from: '"Wakama Farm" <register@wakama.farm>',
    to: 'wakama.onboarding@gmail.com',
    subject: `🌱 Nouvel agriculteur inscrit — ${farmer.firstName} ${farmer.lastName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1117; color: #dfe2eb; padding: 40px; border-radius: 12px;">
        <img src="https://farmer.wakama.farm/wakama-logo.png" height="48" alt="Wakama" style="margin-bottom: 24px;" />
        <h2 style="color: #ec5b13;">🌱 Nouvel Agriculteur Inscrit</h2>
        <p style="color: #9ca3af;">Un nouvel utilisateur vient de rejoindre la plateforme Wakama Farm.</p>

        <div style="background: #1a120e; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #ec5b13; margin-top: 0;">👤 Informations personnelles</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #9ca3af; width: 40%;">Nom complet</td><td style="padding: 8px 0; font-weight: bold;">${farmer.firstName} ${farmer.lastName}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Email</td><td style="padding: 8px 0;">${user.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Téléphone</td><td style="padding: 8px 0;">${farmer.phone}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Région</td><td style="padding: 8px 0;">${farmer.region}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Village</td><td style="padding: 8px 0;">${farmer.village}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">ID Farmer</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${farmer.id}</td></tr>
          </table>
        </div>

        <div style="background: #1a120e; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #ec5b13; margin-top: 0;">🌾 Exploitation agricole</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #9ca3af; width: 40%;">Surface totale</td><td style="padding: 8px 0; font-weight: bold;">${farmer.surface ?? 0} ha</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Coopérative</td><td style="padding: 8px 0;">${farmer.cooperativeId ?? 'Non affilié'}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Date inscription</td><td style="padding: 8px 0;">${new Date(farmer.onboardedAt).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
          </table>
        </div>

        <div style="background: #1a120e; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #ec5b13; margin-top: 0;">📋 Statut KYC</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #9ca3af; width: 40%;">Statut KYC</td>
              <td style="padding: 8px 0;">
                <span style="background: ${farmer.kycStatus === 'VALIDATED' ? '#065f46' : '#92400e'}; color: white; padding: 4px 12px; border-radius: 999px; font-size: 12px;">
                  ${farmer.kycStatus === 'VALIDATED' ? '✅ VALIDÉ' : farmer.kycStatus === 'PENDING' ? '⏳ EN ATTENTE' : '❌ REJETÉ'}
                </span>
              </td>
            </tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">CNI / Passeport</td><td style="padding: 8px 0;">${farmer.cniUrl ? '✅ Soumis' : '❌ Non soumis'}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Attestation foncière</td><td style="padding: 8px 0;">${farmer.attestationUrl ? '✅ Soumis' : '❌ Non soumis'}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="https://farmer.wakama.farm/coop/cooperants"
             style="background: #ec5b13; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Voir le profil dans le dashboard
          </a>
        </div>

        <hr style="border-color: #374151; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          Wakama Edge Ventures Inc. — Wyoming, USA<br/>
          Notification automatique — Ne pas répondre à cet email
        </p>
      </div>
    `,
  })
}

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
