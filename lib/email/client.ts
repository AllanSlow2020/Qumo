import nodemailer, { type Transporter } from "nodemailer";
import { isPreviewDeployment } from "@/lib/env/deployment";
import { logger } from "@/lib/security/logger";

/**
 * Outbound email, used only for staff password resets.
 *
 * Written as an interface with a logging fallback for the same reason
 * SmsClient is: the flow has to be runnable and testable before any
 * credentials exist, and with none set the message is logged instead of
 * sent so `pnpm dev` can complete a reset by reading the console.
 *
 * ── Why Google Workspace, and for how long ───────────────────────────────
 *
 * Workspace is a mailbox product, not a transactional email product, and
 * using it as one is a trade rather than a mistake. It is the right trade
 * here and it is worth writing down why, because the answer changes.
 *
 * The entire volume this sends is staff password resets. Shoppers never get
 * email at all - their whole identity is a phone number and a one-time
 * passcode - so this is a handful of messages a month to people who work
 * for a brand. Workspace already exists, costs nothing more, sends as the
 * company's own domain with its DKIM already in place, and is configured in
 * minutes.
 *
 * What it does not give: deliverability visibility, bounce and complaint
 * webhooks, or reputation separate from the company's human mail. Those
 * matter the moment anything here mails shoppers, or mails anybody in
 * volume, and that is the point at which this class is replaced by a
 * transactional provider. Replacing it is one class and one environment
 * variable, which is the reason it is an interface.
 *
 * Two Workspace routes exist and either works:
 *   - smtp.gmail.com with an app password on a dedicated mailbox. No admin
 *     console needed, 2,000 recipients a day, and the simplest thing that
 *     works.
 *   - smtp-relay.gmail.com, configured in the admin console with SMTP
 *     authentication, 10,000 a day. Vercel has no static egress IPs, so it
 *     has to be authentication rather than IP allowlisting.
 *
 * Both are plain SMTP, so the code below does not care which.
 */

export interface EmailClient {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export class EmailSendError extends Error {}

export class SmtpEmailClient implements EmailClient {
  private transporter: Transporter;

  constructor(
    private readonly from: string,
    options: { host: string; port: number; user: string; pass: string },
  ) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      // 465 is implicit TLS; 587 starts plaintext and upgrades with
      // STARTTLS. Deriving it from the port rather than asking for a third
      // setting removes a way to configure this into sending credentials in
      // the clear.
      secure: options.port === 465,
      auth: { user: options.user, pass: options.pass },
    });
  }

  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } catch (err) {
      // The provider's error can carry the recipient address, so it is
      // deliberately not echoed into the thrown message. The caller turns
      // this into something a person reads anyway.
      logger.error("email send failed", { err: String(err) });
      throw new EmailSendError("The email could not be sent.");
    }
  }
}

/**
 * Stands in whenever no SMTP credentials are configured. Logs the message
 * rather than sending it, so a reset can be completed locally by reading
 * the console - the same role LoggingSmsClient plays for passcodes, and
 * held to the same standard: dev-only console output, never a path that
 * runs in production with real credentials absent by accident.
 */
export class LoggingEmailClient implements EmailClient {
  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    logger.info("email (simulated) send", message);
  }
}

let cachedClient: EmailClient | undefined;

export function getEmailClient(): EmailClient {
  if (!cachedClient) {
    // Preview deployments share Production's credentials, so a preview build
    // must never put a real email in a real inbox. Same guard as the SMS
    // client, and the same reason.
    const host = isPreviewDeployment() ? undefined : process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM ?? user;
    const port = Number(process.env.SMTP_PORT ?? 587);

    cachedClient =
      host && user && pass && from && Number.isFinite(port)
        ? new SmtpEmailClient(from, { host, port, user, pass })
        : new LoggingEmailClient();
  }
  return cachedClient;
}
