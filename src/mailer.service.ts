import { Resend } from 'resend';

export class MailerService {
  private readonly mailer: Resend;
  constructor() {
    this.mailer = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmailFromRegister({
    recipient,
    firstName,
  }: {
    recipient: string;
    firstName?: string;
  }) {
    try {
      const safeName = firstName?.trim() ? firstName.trim() : '👋';
      const data = await this.mailer.emails.send({
        from: 'Acme <onboarding@resend.dev>',
        to: [recipient],
        subject: 'Bienvenue sur la plateforme',
        html: `Bonjour ${safeName} et bienvenue dans notre application, <strong>It works!</strong>`,
      });

      console.log({ data });
    } catch (error) {
      console.log(error);
    }
  }

  async sendRequestPasswordEmail({
    recipient,
    firstName,
    token,
  }: {
    recipient: string;
    firstName?: string;
    token: string;
  }) {
    try {
      const safeName = firstName?.trim() ? firstName.trim() : '👋';
      const baseUrl = process.env.FRONTEND_BASE_URL?.trim();
      const link = baseUrl
        ? `${baseUrl}/reset-password?token=${token}`
        : `http://localhost:3000/reset-password?token=${token}`;

      const data = await this.mailer.emails.send({
        from: 'Auth App <onboarding@resend.dev>',
        to: [recipient],
        subject: 'Pour reinitialiser votre mot de passe',
        html: `Bonjour ${safeName}, voici votre lien de réinitialisation de mot de passe: ${link}`,
      });

      console.log({ data });
    } catch (error) {
      console.log(error);
    }
  }

  /** Envoie le code de connexion (email sans mot de passe). */
  async sendLoginCodeEmail({
    recipient,
    firstName,
    code,
  }: {
    recipient: string;
    firstName?: string;
    code: string;
  }) {
    try {
      const safeName = firstName?.trim() ? firstName.trim() : '👋';
      await this.mailer.emails.send({
        from: 'Aniverse <onboarding@resend.dev>',
        to: [recipient],
        subject: 'Votre code de connexion Aniverse',
        html: `Bonjour ${safeName},<br><br>Votre code de connexion est : <strong>${code}</strong><br><br>Il est valide 10 minutes. Ne le partagez avec personne.`,
      });
    } catch (error) {
      console.log(error);
    }
  }
}
