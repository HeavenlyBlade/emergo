/**
 * smsService — SMS delivery via Android SMS Gateway
 *
 * Uses https://github.com/capcom6/android-sms-gateway
 * Credentials stored in .env:
 *   EXPO_PUBLIC_SMS_GATEWAY_USER=your_username
 *   EXPO_PUBLIC_SMS_GATEWAY_PASS=your_password
 */

const SMS_GATEWAY_URL = 'https://api.sms-gate.app/3rdparty/v1/message';

const GATEWAY_USER = process.env.EXPO_PUBLIC_SMS_GATEWAY_USER ?? '';
const GATEWAY_PASS = process.env.EXPO_PUBLIC_SMS_GATEWAY_PASS ?? '';

/**
 * React Native / Hermes does not guarantee btoa() is available.
 * Use a manual base64 encoder to avoid ReferenceError at runtime.
 */
function toBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = Array.from(str).map((c) => c.charCodeAt(0));
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return result;
}

export async function sendSms(
  recipient: string,
  message: string
): Promise<void> {
  if (!GATEWAY_USER || !GATEWAY_PASS) {
    throw new Error(
      'SMS Gateway credentials not configured. Set EXPO_PUBLIC_SMS_GATEWAY_USER and EXPO_PUBLIC_SMS_GATEWAY_PASS in .env'
    );
  }

  const credentials = toBase64(`${GATEWAY_USER}:${GATEWAY_PASS}`);

  const response = await fetch(SMS_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      textMessage: { text: message },
      phoneNumbers: [recipient],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SMS Gateway error ${response.status}: ${body}`);
  }
}
