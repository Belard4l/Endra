/**
 * Weekly payouts: every Thursday (no public-holiday exceptions, no minimum),
 * every provider is paid everything released up to Wednesday 23:59 Kigali
 * time, minus any confirmed fines. HUZA covers the transfer fee.
 */
import prisma from "@packages/libs/prisma";
import { notify, notifyAdmins } from "@packages/libs/notify";
import { PayoutDestination, sendTransfer } from "@packages/libs/flutterwave";
import { kigaliStartOfDay, kigaliToday } from "@packages/utils/dates";
import { formatRwf, ledger } from "./money";

// Flutterwave Rwanda transfer pricing (check your dashboard — rates change)
export const PAYOUT_FEE_ESTIMATE = { momo: 500, bank: 2000 };

export const payoutDestination = (seller: any): PayoutDestination | null => {
  if (seller.paymentMethod === "momo" && seller.momoPhoneNumber) {
    return { method: "momo", phone: seller.momoPhoneNumber, name: seller.momoName || seller.name, network: seller.momoNetwork };
  }
  if (seller.paymentMethod === "bank" && seller.bankCode && seller.bankAccountNumber) {
    return { method: "bank", bankCode: seller.bankCode, accountNumber: seller.bankAccountNumber, name: seller.bankAccountName || seller.name };
  }
  return null;
};

const dispatch = async (payoutId: string) => {
  const payout = await prisma.payouts.findUnique({ where: { id: payoutId } });
  if (!payout) return;
  const seller = await prisma.sellers.findUnique({ where: { id: payout.sellerId } });
  const dest = seller ? payoutDestination(seller) : null;
  const attempts = payout.attempts + 1;
  const reference = attempts === 1 ? payout.reference : `${payout.reference.split("-R")[0]}-R${attempts}`;

  if (!dest) {
    await prisma.payouts.update({
      where: { id: payoutId },
      data: { status: "failed", attempts, failureReason: "No payout method (MoMo or bank) on file" },
    });
    await notify({
      recipientId: payout.sellerId,
      recipientType: "seller",
      title: "Payout on hold",
      message: `We couldn't send your payout of ${formatRwf(payout.amount)} because no MoMo or bank details are saved. Add them in Settings and we'll retry.`,
      link: "/settings",
      critical: true,
    });
    return;
  }

  const res = await sendTransfer(reference, payout.amount, dest);
  if (!res.ok) {
    await prisma.payouts.update({
      where: { id: payoutId },
      data: { status: "failed", attempts, reference, failureReason: (res as any).error },
    });
    await notifyAdmins("Payout failed", `Payout ${reference} (${formatRwf(payout.amount)}) failed: ${(res as any).error}`, "/payouts");
    await notify({
      recipientId: payout.sellerId,
      recipientType: "seller",
      title: "Payout failed",
      message: `Your payout of ${formatRwf(payout.amount)} could not be sent. Please check your payout details; our team will retry.`,
      link: "/payouts",
      critical: true,
    });
    return;
  }

  const done = String(res.status).toUpperCase() === "SUCCESSFUL";
  await prisma.payouts.update({
    where: { id: payoutId },
    data: {
      status: done ? "successful" : "processing",
      attempts,
      reference,
      flwTransferId: res.id,
      method: dest.method,
      destination: dest as any,
      failureReason: null,
    },
  });
  if (done) await onPayoutSuccess(payoutId);
};

const onPayoutSuccess = async (payoutId: string) => {
  const payout = await prisma.payouts.findUnique({ where: { id: payoutId } });
  if (!payout) return;
  await ledger({ type: "payout", amount: -payout.amount, description: `Weekly payout ${payout.batchDate}`, sellerId: payout.sellerId, payoutId });
  if (payout.payoutFee) {
    await ledger({ type: "payout_fee", amount: -payout.payoutFee, description: "Transfer fee (paid by HUZA)", payoutId });
  }
  await notify({
    recipientId: payout.sellerId,
    recipientType: "seller",
    title: "Payout sent",
    message: `${formatRwf(payout.amount)} has been sent to your ${payout.method === "momo" ? "MoMo" : "bank account"}.${payout.penaltyDeducted ? ` ${formatRwf(payout.penaltyDeducted)} in fines was deducted.` : ""}`,
    link: "/payouts",
    type: "payout",
    critical: true,
    sms: `HUZA payout of ${formatRwf(payout.amount)} sent.`,
  });
};

export const runWeeklyPayouts = async (now: Date = new Date()) => {
  const batchDate = kigaliToday(now);
  const cutoff = kigaliStartOfDay(batchDate); // released before Thursday 00:00 = up to Wednesday 23:59

  const due = await prisma.bookings.findMany({
    where: { releasedAt: { lt: cutoff }, payoutId: null, providerAmount: { gt: 0 } },
    orderBy: { releasedAt: "asc" },
  });
  const bySeller = new Map<string, typeof due>();
  due.forEach((b) => bySeller.set(b.sellerId, [...(bySeller.get(b.sellerId) || []), b]));

  let created = 0;
  for (const [sellerId, bookings] of bySeller) {
    const seller = await prisma.sellers.findUnique({ where: { id: sellerId } });
    if (!seller) continue;
    const gross = bookings.reduce((s, b) => s + b.providerAmount, 0);

    // Deduct confirmed fines (oldest first). Any remainder carries to next week.
    let deducted = 0;
    const fines = await prisma.penalties.findMany({ where: { sellerId, status: "confirmed" }, orderBy: { createdAt: "asc" } });
    for (const fine of fines) {
      const outstanding = fine.amount - fine.deductedAmount;
      const take = Math.min(outstanding, gross - deducted);
      if (take <= 0) break;
      deducted += take;
      await prisma.penalties.update({
        where: { id: fine.id },
        data: { deductedAmount: fine.deductedAmount + take, status: fine.deductedAmount + take >= fine.amount ? "deducted" : "confirmed" },
      });
      await ledger({ type: "penalty_deduction", amount: -take, description: `Fine: ${fine.reason}`, sellerId });
    }

    const amount = gross - deducted;
    const dest = payoutDestination(seller);
    const payout = await prisma.payouts.create({
      data: {
        sellerId,
        batchDate,
        gross,
        penaltyDeducted: deducted,
        amount,
        payoutFee: amount > 0 && dest ? PAYOUT_FEE_ESTIMATE[dest.method] : 0,
        method: dest?.method || "none",
        destination: (dest as any) || {},
        status: amount > 0 ? "pending" : "settled",
        reference: `HUZA-${batchDate}-${sellerId.slice(-8)}`,
        bookingIds: bookings.map((b) => b.id),
      },
    });
    await prisma.bookings.updateMany({ where: { id: { in: bookings.map((b) => b.id) } }, data: { payoutId: payout.id } });
    created++;

    if (amount > 0) await dispatch(payout.id);
    else
      await notify({
        recipientId: sellerId,
        recipientType: "seller",
        title: "This week's earnings covered your fines",
        message: `Your earnings of ${formatRwf(gross)} were used to pay outstanding fines, so there is no transfer this week.`,
        link: "/payouts",
      });
  }
  console.log(`[payouts] ${batchDate}: ${created} payouts created from ${due.length} bookings`);
  return { batchDate, payouts: created, bookings: due.length };
};

export const retryPayout = async (payoutId: string) => {
  const payout = await prisma.payouts.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status !== "failed") return payout;
  await prisma.payouts.update({ where: { id: payoutId }, data: { status: "pending" } });
  await dispatch(payoutId);
  return prisma.payouts.findUnique({ where: { id: payoutId } });
};

/** Flutterwave `transfer.completed` webhook */
export const handleTransferEvent = async (data: { reference?: string; status?: string; complete_message?: string }) => {
  if (!data?.reference) return;
  const payout = await prisma.payouts.findFirst({ where: { reference: data.reference } });
  if (!payout || payout.status === "successful") return;
  const status = String(data.status || "").toUpperCase();
  if (status === "SUCCESSFUL") {
    await prisma.payouts.update({ where: { id: payout.id }, data: { status: "successful" } });
    await onPayoutSuccess(payout.id);
  } else if (status === "FAILED") {
    await prisma.payouts.update({ where: { id: payout.id }, data: { status: "failed", failureReason: data.complete_message || "Transfer failed" } });
    await notifyAdmins("Payout failed", `Payout ${payout.reference} failed: ${data.complete_message || "unknown reason"}`, "/payouts");
  }
};
