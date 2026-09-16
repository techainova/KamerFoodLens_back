import { KFL_LOGO_BASE64 } from '../assets/kfl-logo';

export const KFL_LOGO_CID = 'kfl-logo@kmerfoodlens';

// Spread this into nodemailer's `attachments` array on every email that uses renderLayout(),
// so the `cid:` reference in the <img> tag below resolves to real embedded image data.
export const KFL_LOGO_ATTACHMENT = {
  filename: 'kfl-logo.png',
  content: KFL_LOGO_BASE64,
  encoding: 'base64' as const,
  cid: KFL_LOGO_CID,
};

const BRAND_ORANGE = '#E8591A';
const BRAND_GOLD = '#F9A825';
const BRAND_GREEN = '#2E7D32';
const INK = '#2B2622';
const INK_MUTE = '#8C8278';
const CREAM = '#F5F0EB';
const BORDER = '#E7DFD5';

function renderLayout(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background-color:${CREAM}; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CREAM}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; border:1px solid ${BORDER}; overflow:hidden;">
            <tr>
              <td align="center" style="padding:32px 32px 16px 32px;">
                <img src="cid:${KFL_LOGO_CID}" width="80" height="100" alt="KmerFoodLens" style="display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:${CREAM}; border-top:1px solid ${BORDER};">
                <p style="margin:0; font-size:12px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
                  KmerFoodLens — La gastronomie camerounaise, reconnue en un scan.<br />
                  Vous recevez cet email car cette adresse a été utilisée sur KmerFoodLens.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function otpCodeBlock(code: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 24px 0;">
      <tr>
        <td align="center" style="background-color:${CREAM}; border:1px solid ${BORDER}; border-radius:12px; padding:20px;">
          <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:${BRAND_ORANGE}; font-family:'Courier New', monospace;">
            ${code}
          </span>
        </td>
      </tr>
    </table>`;
}

export function renderOtpEmail(otp: string): string {
  return renderLayout(`
    <h1 style="margin:0 0 4px 0; font-size:20px; color:${INK}; text-align:center;">Vérifiez votre adresse email</h1>
    <p style="margin:0 0 24px 0; font-size:14px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
      Voici votre code de vérification KmerFoodLens.
    </p>
    ${otpCodeBlock(otp)}
    <p style="margin:0; font-size:13px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
      Ce code expire dans <strong style="color:${INK};">10 minutes</strong>.<br />
      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
    </p>
  `);
}

export function renderPasswordResetEmail(resetToken: string): string {
  return renderLayout(`
    <h1 style="margin:0 0 4px 0; font-size:20px; color:${INK}; text-align:center;">Réinitialisation du mot de passe</h1>
    <p style="margin:0 0 24px 0; font-size:14px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
      Voici votre code de réinitialisation KmerFoodLens.
    </p>
    ${otpCodeBlock(resetToken)}
    <p style="margin:0; font-size:13px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
      Ce code expire dans <strong style="color:${INK};">1 heure</strong>.<br />
      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.
    </p>
  `);
}

export function renderWelcomeEmail(firstName: string): string {
  return renderLayout(`
    <h1 style="margin:0 0 4px 0; font-size:20px; color:${INK}; text-align:center;">Bienvenue, ${firstName} !</h1>
    <p style="margin:0 0 20px 0; font-size:14px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
      Votre compte KmerFoodLens a été créé avec succès.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0;">
      <tr>
        <td style="background-color:${CREAM}; border-radius:12px; padding:20px 20px;">
          <p style="margin:0 0 10px 0; font-size:14px; color:${INK}; line-height:1.6;">
            <strong style="color:${BRAND_GREEN};">✓</strong>&nbsp; Scannez un plat pour découvrir son nom, ses ingrédients et sa recette
          </p>
          <p style="margin:0 0 10px 0; font-size:14px; color:${INK}; line-height:1.6;">
            <strong style="color:${BRAND_GOLD};">✓</strong>&nbsp; Trouvez les meilleurs restaurants camerounais autour de vous
          </p>
          <p style="margin:0; font-size:14px; color:${INK}; line-height:1.6;">
            <strong style="color:${BRAND_ORANGE};">✓</strong>&nbsp; Rejoignez la communauté et gagnez des XP en explorant la gastronomie locale
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0; font-size:13px; color:${INK_MUTE}; text-align:center; line-height:1.6;">
      Merci de nous rejoindre — bon appétit avec KmerFoodLens !
    </p>
  `);
}
