/**
 * One call to notify someone: in-app notification + email for everything,
 * plus SMS when `critical` is set (8: A + B).
 */
import prisma from "@packages/libs/prisma";
import { sendEmail } from "@packages/libs/email";
import { sendSms } from "@packages/libs/sms";

export type RecipientType = "user" | "seller" | "admin";

type NotifyInput = {
  recipientId: string;
  recipientType: RecipientType;
  title: string;
  message: string;
  link?: string;
  type?: string;
  critical?: boolean;
  sms?: string; // optional shorter SMS text
  skipEmail?: boolean;
};

const uiBase = (type: RecipientType) =>
  type === "seller"
    ? process.env.SELLER_UI_URL || "http://localhost:3001"
    : type === "admin"
    ? process.env.ADMIN_UI_URL || "http://localhost:3002"
    : process.env.USER_UI_URL || "http://localhost:3000";

export const notify = async (input: NotifyInput) => {
  try {
    await prisma.notifications.create({
      data: {
        recipientId: input.recipientId,
        recipientType: input.recipientType,
        title: input.title,
        message: input.message,
        link: input.link,
        type: input.type || "info",
      },
    });

    let contact: { name: string; email: string; phone?: string | null } | null = null;
    if (input.recipientType === "seller") {
      const s = await prisma.sellers.findUnique({ where: { id: input.recipientId } });
      if (s) contact = { name: s.name, email: s.email, phone: s.phone_number };
    } else {
      const u = await prisma.users.findUnique({ where: { id: input.recipientId } });
      if (u) contact = { name: u.name, email: u.email, phone: u.phone };
    }
    if (!contact) return;

    const link = input.link ? `${uiBase(input.recipientType)}${input.link}` : undefined;
    if (!input.skipEmail) {
      await sendEmail(contact.email, `HUZA: ${input.title}`, "notification", {
        name: contact.name,
        title: input.title,
        message: input.message,
        link,
      });
    }
    if (input.critical && contact.phone) {
      await sendSms(contact.phone, `HUZA: ${input.sms || input.title}`);
    }
  } catch (err) {
    console.error("[notify] failed", err);
  }
};

/** Sends the same in-app notification to every admin */
export const notifyAdmins = async (title: string, message: string, link?: string, type = "admin") => {
  const admins = await prisma.users.findMany({ where: { role: "admin" }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      notify({ recipientId: a.id, recipientType: "admin", title, message, link, type, skipEmail: true })
    )
  );
};
