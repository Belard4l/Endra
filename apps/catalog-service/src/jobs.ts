import cron from "node-cron";
import prisma from "@packages/libs/prisma";
import { deleteFile } from "@packages/libs/imagekit";
import { notify } from "@packages/libs/notify";

const safely = (name: string, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[catalog-jobs] ${name} failed`, err);
  }
};

export const startCatalogJobs = () => {
  // Hourly: permanently delete services soft-deleted more than 24h ago
  cron.schedule(
    "15 * * * *",
    safely("purge-deleted-services", async () => {
      const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
      const old = await prisma.services.findMany({ where: { isDeleted: true, deletedAt: { lt: cutoff } } });
      for (const s of old) {
        const hasBookings = await prisma.bookings.count({ where: { serviceId: s.id } });
        if (hasBookings) continue; // keep for booking history, it stays hidden
        for (const img of s.images) await deleteFile(img.fileId);
        await prisma.questions.deleteMany({ where: { serviceId: s.id } });
        await prisma.services.delete({ where: { id: s.id } });
      }
    }),
    { timezone: "Africa/Kigali" }
  );

  // Every 6 hours: remind providers about questions unanswered for 24h
  cron.schedule(
    "0 */6 * * *",
    safely("question-reminders", async () => {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
      const pending = await prisma.questions.findMany({
        where: { answer: null, isHidden: false, createdAt: { lt: dayAgo }, remindedAt: null },
      });
      const bySeller = new Map<string, number>();
      pending.forEach((q) => bySeller.set(q.sellerId, (bySeller.get(q.sellerId) || 0) + 1));
      for (const [sellerId, count] of bySeller) {
        await notify({
          recipientId: sellerId,
          recipientType: "seller",
          title: "Questions waiting for you",
          message: `${count} couple question(s) have been waiting more than a day. Answering quickly helps you win bookings.`,
          link: "/questions",
          type: "question",
        });
      }
      await prisma.questions.updateMany({ where: { id: { in: pending.map((q) => q.id) } }, data: { remindedAt: new Date() } });
    }),
    { timezone: "Africa/Kigali" }
  );
};
