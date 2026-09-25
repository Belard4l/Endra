/**
 * SMS through Africa's Talking (used for critical events only).
 * Without AT_API_KEY / AT_USERNAME the message is printed to the console.
 */
import axios from "axios";
import { normaliseRwPhone } from "@packages/libs/flutterwave";

const username = process.env.AT_USERNAME;
const apiKey = process.env.AT_API_KEY;
const isSandbox = username === "sandbox";
const endpoint = isSandbox
  ? "https://api.sandbox.africastalking.com/version1/messaging"
  : "https://api.africastalking.com/version1/messaging";

export const sendSms = async (phone: string | null | undefined, message: string): Promise<boolean> => {
  if (!phone) return false;
  const to = "+" + normaliseRwPhone(phone);
  if (!username || !apiKey) {
    console.log(`[sms:dev] to ${to}: ${message}`);
    return true;
  }
  try {
    const body = new URLSearchParams({ username, to, message });
    if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
    await axios.post(endpoint, body.toString(), {
      headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });
    return true;
  } catch (err: any) {
    console.error("[sms] failed", err?.response?.data || err?.message);
    return false;
  }
};
