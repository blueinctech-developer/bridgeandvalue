import "server-only";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

/**
 * Enquiry notification emails through Amazon SES. Configured with SES_REGION,
 * SES_ACCESS_KEY_ID and SES_SECRET_ACCESS_KEY; one AWS key can serve several things,
 * so each falls back to its S3_* twin. bridgeandvalue.com must be a verified SES
 * identity in that region. Without these settings nothing is sent (enquiries are
 * still saved in the admin inbox).
 */
const SES = {
  region: process.env.SES_REGION || process.env.S3_REGION || "",
  accessKeyId: process.env.SES_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.SES_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "",
};

export const mailConfigured = Boolean(SES.region && SES.accessKeyId && SES.secretAccessKey);

/** Sender on the verified domain; EMAIL_FROM can override it. */
const FROM = process.env.EMAIL_FROM || "Bridge & Value website <no-reply@bridgeandvalue.com>";

let client: SESv2Client | null = null;

/** Keeps a header value on one line. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export async function sendMail({ to, subject, text, replyTo }: { to: string; subject: string; text: string; replyTo?: string }): Promise<void> {
  if (!mailConfigured) throw new Error("Email is not set up (SES_* settings)");
  client ??= new SESv2Client({ region: SES.region, credentials: { accessKeyId: SES.accessKeyId, secretAccessKey: SES.secretAccessKey } });
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: oneLine(FROM),
      Destination: { ToAddresses: [oneLine(to)] },
      ReplyToAddresses: replyTo ? [oneLine(replyTo)] : undefined,
      Content: { Simple: { Subject: { Data: oneLine(subject).slice(0, 200), Charset: "UTF-8" }, Body: { Text: { Data: text, Charset: "UTF-8" } } } },
    }),
  );
}

const LABELS: Record<string, string> = { name: "Name", email: "Email", phone: "Phone", subject: "Subject", message: "Message" };
const FORM_NAMES: Record<string, string> = { contact: "Contact form", quote: "Get A Free Quote" };

/** The notification for one enquiry: who sent it, from which page, every field, and where to find it in the admin. */
export function enquiryEmail(e: { id: number; form: string; page: string; fields: Record<string, string>; siteUrl: string }) {
  const who = e.fields.name || e.fields.email || "a visitor";
  const lines = Object.entries(e.fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${LABELS[k] ?? k.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase())}:\n${v}`);
  return {
    subject: `New enquiry from ${who} (${FORM_NAMES[e.form] ?? e.form})`,
    text: [
      `A new enquiry was sent through the ${FORM_NAMES[e.form] ?? e.form} on ${e.siteUrl}${e.page || "/"}.`,
      "",
      ...lines.flatMap((l) => [l, ""]),
      `Open it in the admin: ${e.siteUrl}/admin/enquiries/${e.id}/`,
      e.fields.email ? "Reply to this email to answer the sender directly." : "",
    ].join("\n"),
  };
}
