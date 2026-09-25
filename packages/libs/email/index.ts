/**
 * Email through Nodemailer + EJS templates in ./templates.
 * Without SMTP settings the email (and any OTP in it) is printed to the console,
 * which is handy while developing.
 */
import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";

const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      service: process.env.SMTP_SERVICE || undefined,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const templatePath = (name: string) =>
  path.join(process.cwd(), "packages", "libs", "email", "templates", `${name}.ejs`);

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  data: Record<string, unknown>
): Promise<boolean> => {
  try {
    const html = await ejs.renderFile(templatePath(templateName), {
      appName: "HUZA",
      userUiUrl: process.env.USER_UI_URL || "http://localhost:3000",
      ...data,
    });
    if (!transporter) {
      console.log(`[email:dev] to ${to} | ${subject} | data: ${JSON.stringify(data)}`);
      return true;
    }
    await transporter.sendMail({ from: `HUZA <${process.env.SMTP_USER}>`, to, subject, html });
    return true;
  } catch (error) {
    console.error("[email] failed", error);
    return false;
  }
};
