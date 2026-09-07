/**
 * smsService — SMS delivery via SMS API PH
 *
 * Sends SMS messages using the smsapiph.onrender.com API.
 * API key is read from EXPO_PUBLIC_SMS_API_KEY in .env
 *
 * The API has intelligent fallback:
 *   1. Try SMS
 *   2. If SMS fails → Try Email
 *   3. If Email fails → Send Push Notification
 */

const SMS_API_URL = 'https://smsapiph.onrender.com/api/v1/send/sms';
const API_KEY = process.env.EXPO_PUBLIC_SMS_API_KEY ?? '';

export async function sendSms(
  recipient: string,
  message: string
): Promise<void> {
  if (!API_KEY) {
    throw new Error('SMS API key is not configured. Set EXPO_PUBLIC_SMS_API_KEY in .env');
  }

  const response = await fetch(SMS_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient, message }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SMS API error ${response.status}: ${body}`);
  }
}
