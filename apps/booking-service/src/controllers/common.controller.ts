import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { notify } from "@packages/libs/notify";
import { kigaliToday } from "@packages/utils/dates";
import { pageParams } from "@packages/utils/server";

type Role = "user" | "seller" | "admin";
const accountId = (req: any, role: Role) => (role === "seller" ? req.seller.id : role === "admin" ? req.admin.id : req.user.id);

// ───── Notifications (per role) ─────

export const listNotifications = (role: Role) => async (req: any, res: Response) => {
  const { skip, limit } = pageParams(req.query, 30);
  const where = { recipientId: accountId(req, role), recipientType: role };
  const [notifications, unread] = await Promise.all([
    prisma.notifications.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.notifications.count({ where: { ...where, isRead: false } }),
  ]);
  res.json({ notifications, unread });
};

export const markRead = (role: Role) => async (req: any, res: Response) => {
  await prisma.notifications.updateMany({
    where: { id: req.params.id, recipientId: accountId(req, role), recipientType: role },
    data: { isRead: true },
  });
  res.json({ success: true });
};

export const markAllRead = (role: Role) => async (req: any, res: Response) => {
  await prisma.notifications.updateMany({
    where: { recipientId: accountId(req, role), recipientType: role, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
};

// ───── Wedding-day chat (opens on the event date only) ─────

const loadForChat = async (req: any, role: "user" | "seller") => {
  const where = role === "user" ? { id: req.params.id, userId: req.user.id } : { id: req.params.id, sellerId: req.seller.id };
  const booking = await prisma.bookings.findFirst({ where });
  if (!booking) throw new NotFoundError("Booking not found");
  return booking;
};

export const listMessages = (role: "user" | "seller") => async (req: any, res: Response) => {
  const booking = await loadForChat(req, role);
  const open = kigaliToday() === booking.eventDate && ["confirmed", "completed"].includes(booking.status);
  const messages = await prisma.messages.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" }, take: 500 });
  res.json({ messages, open });
};

export const sendMessage = (role: "user" | "seller") => async (req: any, res: Response) => {
  const booking = await loadForChat(req, role);
  if (kigaliToday() !== booking.eventDate || !["confirmed", "completed"].includes(booking.status)) {
    throw new ValidationError("Chat opens on the wedding day only. Use the listing's public Q&A before then.");
  }
  const text = String(req.body.text || "").trim();
  if (!text || text.length > 2000) throw new ValidationError("Messages must be 1–2000 characters");
  const message = await prisma.messages.create({
    data: { bookingId: booking.id, senderType: role, senderId: role === "user" ? req.user.id : req.seller.id, text },
  });
  const recent = await prisma.notifications.count({
    where: {
      recipientId: role === "user" ? booking.sellerId : booking.userId,
      type: "chat",
      createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  if (recent === 0) {
    await notify({
      recipientId: role === "user" ? booking.sellerId : booking.userId,
      recipientType: role === "user" ? "seller" : "user",
      title: "New wedding-day message",
      message: `${booking.serviceTitle}: ${text.slice(0, 140)}`,
      link: `/bookings/${booking.id}`,
      type: "chat",
      skipEmail: true,
    });
  }
  res.status(201).json({ message });
};
