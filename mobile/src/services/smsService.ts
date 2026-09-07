/**
 * smsService — SMS delivery via Android SMS Gateway
 *
 * Uses https://github.com/capcom6/android-sms-gateway
 * A dedicated Android phone with a SIM card acts as the SMS gateway.
 * The app on that phone exposes an API that sends real SMS via the device's SIM.
 *
 * Two modes:
 *   - Cloud mode: phone connects to api.sms-gate.app, accessible from anywhere
 *   - Local mode: phone runs a local server, only accessible on same Wi-Fi
 *
 * We use Cloud mode so the Emergo app can reach the gateway from any network.
 *
 * Credentials are stored in .env:
 *   EXPO_PUBLIC_SMS_GATEWAY_USER=your_username
 *   EXPO_PUBLIC_SMS_GATEWAY_PASS=your_password
 */

const SMS_GATEWAY_URL = 'https://api.sms-gate.app/3rdparty/v1/message';

const GATEWAY_USER = process.env.EXPO_PUBLIC_SMS_GATEWAY_USER ?? '';
const GATEWAY_PASS = process.env.EXPO_PUBLIC_SMS_GATEWAY_PASS ?? '';

export async function sendSms(
  recipient: string,
  message: string
): Promise<void> {
  if (!GATEWAY_USER || !GATEWAY_PASS) {
    throw new Error(
      'SMS Gateway credentials not configured. Set EXPO_PUBLIC_SMS_GATEWAY_USER and EXPO_PUBLIC_SMS_GATEWAY_PASS in .env'
    );
  }

  // Basic auth: base64(username:password)
  const credentials = btoa(`${GATEWAY_USER}:${GATEWAY_PASS}`);

  const response = await fetch(SMS_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
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
