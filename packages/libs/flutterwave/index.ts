/**
 * Flutterwave (v3 API) — collections in RWF (MoMo + card), refunds and payouts
 * to MoMo / Rwandan bank accounts.
 *
 * MOCK MODE: when FLUTTERWAVE_SECRET_KEY is not set, nothing leaves the server.
 * Checkout redirects to a local "mock payment" page and payouts/refunds succeed
 * instantly. This lets you test the whole booking flow before you have keys.
 */
import axios from "axios";

const BASE = "https://api.flutterwave.com/v3";
const SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
export const isMockMode = !SECRET;

const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
});

const describe = (err: any) => err?.response?.data?.message || err?.message || "Flutterwave request failed";

export type InitiatePaymentInput = {
  txRef: string;
  amount: number;
  redirectUrl: string;
  customer: { email: string; name: string; phone?: string | null };
  title: string;
  description: string;
};

/** Returns the hosted checkout link the couple is redirected to */
export const initiatePayment = async (input: InitiatePaymentInput): Promise<string> => {
  if (isMockMode) {
    const ui = process.env.USER_UI_URL || "http://localhost:3000";
    return `${ui}/checkout/mock?tx_ref=${encodeURIComponent(input.txRef)}&amount=${input.amount}`;
  }
  try {
    const { data } = await client.post("/payments", {
      tx_ref: input.txRef,
      amount: input.amount,
      currency: "RWF",
      redirect_url: input.redirectUrl,
      payment_options: "mobilemoneyrwanda,card",
      customer: {
        email: input.customer.email,
        name: input.customer.name,
        phonenumber: input.customer.phone || undefined,
      },
      customizations: { title: input.title, description: input.description },
    });
    return data.data.link;
  } catch (err) {
    throw new Error(describe(err));
  }
};

export type VerifiedTransaction = {
  id: string;
  txRef: string;
  status: "successful" | "failed" | "pending";
  amount: number;
  currency: string;
  fee: number;
};

export const verifyTransaction = async (transactionId: string): Promise<VerifiedTransaction> => {
  const { data } = await client.get(`/transactions/${transactionId}/verify`);
  const t = data.data;
  return {
    id: String(t.id),
    txRef: t.tx_ref,
    status: t.status === "successful" ? "successful" : t.status === "failed" ? "failed" : "pending",
    amount: Math.round(Number(t.amount)),
    currency: t.currency,
    fee: Math.round(Number(t.app_fee || 0)),
  };
};

export const verifyByReference = async (txRef: string): Promise<VerifiedTransaction | null> => {
  try {
    const { data } = await client.get(`/transactions/verify_by_reference`, { params: { tx_ref: txRef } });
    const t = data.data;
    return {
      id: String(t.id),
      txRef: t.tx_ref,
      status: t.status === "successful" ? "successful" : t.status === "failed" ? "failed" : "pending",
      amount: Math.round(Number(t.amount)),
      currency: t.currency,
      fee: Math.round(Number(t.app_fee || 0)),
    };
  } catch {
    return null;
  }
};

export const refundTransaction = async (transactionId: string, amount: number) => {
  if (isMockMode) return { ok: true, mock: true };
  try {
    const { data } = await client.post(`/transactions/${transactionId}/refund`, { amount });
    return { ok: true, data: data.data };
  } catch (err) {
    return { ok: false, error: describe(err) };
  }
};

export type PayoutDestination =
  | { method: "momo"; phone: string; name: string; network?: string | null }
  | { method: "bank"; bankCode: string; accountNumber: string; name: string };

/** Normalises a Rwandan MoMo number to 2507XXXXXXXX */
export const normaliseRwPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("250")) return digits;
  if (digits.startsWith("0")) return "250" + digits.slice(1);
  return "250" + digits;
};

export const sendTransfer = async (reference: string, amount: number, dest: PayoutDestination) => {
  if (isMockMode) return { ok: true, id: `mock-${reference}`, status: "SUCCESSFUL" as const };
  const payload: Record<string, unknown> =
    dest.method === "momo"
      ? {
          account_bank: "MPS",
          account_number: normaliseRwPhone(dest.phone),
          beneficiary_name: dest.name,
        }
      : {
          account_bank: dest.bankCode,
          account_number: dest.accountNumber,
          beneficiary_name: dest.name,
          meta: [{ sender: "HUZA", sender_country: "RW", mobile_number: process.env.HUZA_SUPPORT_PHONE || "" }],
        };
  try {
    const { data } = await client.post("/transfers", {
      ...payload,
      amount,
      currency: "RWF",
      reference,
      narration: "HUZA weekly payout",
      debit_currency: "RWF",
      callback_url: process.env.FLUTTERWAVE_TRANSFER_CALLBACK_URL || undefined,
    });
    return { ok: true, id: String(data.data.id), status: String(data.data.status) };
  } catch (err) {
    return { ok: false, error: describe(err) };
  }
};

export const getRwandaBanks = async (): Promise<{ code: string; name: string }[]> => {
  if (isMockMode) {
    return [
      { code: "BK", name: "Bank of Kigali" },
      { code: "EQUITY", name: "Equity Bank Rwanda" },
      { code: "IM", name: "I&M Bank Rwanda" },
      { code: "BPR", name: "BPR Bank Rwanda" },
      { code: "GTB", name: "GT Bank Rwanda" },
      { code: "ECOBANK", name: "Ecobank Rwanda" },
      { code: "ACCESS", name: "Access Bank Rwanda" },
    ];
  }
  const { data } = await client.get("/banks/RW");
  return (data.data || []).map((b: any) => ({ code: String(b.code), name: b.name }));
};

/** Webhook authenticity: Flutterwave sends your secret hash in the `verif-hash` header */
export const isValidWebhook = (headerValue: string | undefined): boolean => {
  const expected = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!expected) return false;
  return headerValue === expected;
};
