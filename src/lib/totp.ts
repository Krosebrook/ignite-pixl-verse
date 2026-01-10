import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const TOTP_ISSUER = 'FlashFusion';
const TOTP_ALGORITHM = 'SHA1';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;

/**
 * Generate a random base32 secret for TOTP
 */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Create a TOTP instance from a secret
 */
export function createTotp(secret: string, accountName: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: accountName,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/**
 * Generate a TOTP URI for authenticator apps
 */
export function generateTotpUri(secret: string, accountName: string): string {
  const totp = createTotp(secret, accountName);
  return totp.toString();
}

/**
 * Generate a QR code data URL from a TOTP secret
 */
export async function generateQrCodeDataUrl(secret: string, accountName: string): Promise<string> {
  const uri = generateTotpUri(secret, accountName);
  return QRCode.toDataURL(uri, {
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Verify a TOTP token against a secret
 * Uses a window of 1 period before and after to account for time drift
 */
export function verifyTotpToken(secret: string, token: string, accountName: string = ''): boolean {
  try {
    const totp = createTotp(secret, accountName);
    // Allow for 1 period time drift (30 seconds before or after)
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate the current TOTP code (useful for testing)
 */
export function generateTotpCode(secret: string, accountName: string = ''): string {
  const totp = createTotp(secret, accountName);
  return totp.generate();
}
