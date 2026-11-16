import { createServer, type Server, type Socket } from "node:net";
import { domainToASCII } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EmailSendError, SmtpEmailClient } from "@/lib/email/client";

/**
 * SmtpEmailClient against a real SMTP conversation, with no mocks.
 *
 * Nothing exercised this path before: the reset flow is tested with a fake
 * EmailClient, which proves the flow and says nothing about what nodemailer
 * puts on the wire. That gap mattered when nodemailer 10.4.1 fixed two cases
 * where the domain it delivered to differed from the domain an application
 * had checked, so this reads the one thing that cannot be argued with: the
 * RCPT TO the server actually received.
 *
 * The server is thirty lines of the protocol, enough for EHLO, AUTH PLAIN,
 * MAIL, RCPT, DATA and QUIT. It advertises no STARTTLS, so the client sends
 * in the clear to a socket on this machine; the TLS choice in the client is
 * derived from the port and is not what is under test.
 */

type Received = { from: string; rcpt: string[]; data: string; authed: boolean };

let server: Server;
let port: number;
let received: Received[];
let rejectRecipients = false;

function speak(socket: Socket) {
  let current: Received = { from: "", rcpt: [], data: "", authed: false };
  let inData = false;
  let buffer = "";

  socket.write("220 test ESMTP\r\n");
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    for (;;) {
      if (inData) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        current.data = buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        inData = false;
        received.push(current);
        current = { from: "", rcpt: [], data: "", authed: current.authed };
        socket.write("250 queued\r\n");
        continue;
      }
      const eol = buffer.indexOf("\r\n");
      if (eol === -1) return;
      const line = buffer.slice(0, eol);
      buffer = buffer.slice(eol + 2);
      const verb = line.split(" ")[0]?.toUpperCase();

      if (verb === "EHLO") socket.write("250-test\r\n250 AUTH PLAIN\r\n");
      else if (verb === "AUTH") {
        current.authed = true;
        socket.write("235 ok\r\n");
      } else if (verb === "MAIL") {
        current.from = /<([^>]*)>/.exec(line)?.[1] ?? "";
        socket.write("250 ok\r\n");
      } else if (verb === "RCPT") {
        if (rejectRecipients) {
          socket.write("550 no such user\r\n");
        } else {
          current.rcpt.push(/<([^>]*)>/.exec(line)?.[1] ?? "");
          socket.write("250 ok\r\n");
        }
      } else if (verb === "DATA") {
        inData = true;
        socket.write("354 go\r\n");
      } else if (verb === "QUIT") {
        socket.write("221 bye\r\n");
        socket.end();
      } else socket.write("250 ok\r\n");
    }
  });
  socket.on("error", () => {});
}

beforeAll(async () => {
  server = createServer(speak);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  received = [];
  rejectRecipients = false;
});

function client() {
  return new SmtpEmailClient("Qumo <noreply@qumo.test>", {
    host: "127.0.0.1",
    port,
    user: "mailbox",
    pass: "app-password",
  });
}

describe("SmtpEmailClient over a real SMTP conversation", () => {
  it("delivers to the address it was given, signed in, from the configured sender", async () => {
    await client().send({ to: "owner@brand.test", subject: "Reset your Qumo password", text: "Open the link." });

    expect(received).toHaveLength(1);
    const mail = received[0];
    if (!mail) throw new Error("the server received nothing");
    expect(mail.rcpt).toEqual(["owner@brand.test"]);
    expect(mail.from).toBe("noreply@qumo.test");
    expect(mail.authed).toBe(true);
    expect(mail.data).toContain("Subject: Reset your Qumo password");
    expect(mail.data).toContain("Open the link.");
  });

  it("puts a plain-text body on the wire and no html part", async () => {
    await client().send({ to: "owner@brand.test", subject: "s", text: "just text" });
    expect(received[0]?.data).toMatch(/Content-Type: text\/plain/i);
    expect(received[0]?.data).not.toMatch(/text\/html/i);
  });

  /**
   * The two cases nodemailer 10.4.1 fixed, each confirmed to fail on 10.0.8
   * before being written down here. In both, an application that checked an
   * address and then sent through a library that read it differently would be
   * mailing a domain it never approved.
   *
   * A capital sharp S: 10.0.8 handed the domain to the UTS-46 mapper without
   * lowercasing it first and delivered to xn--example-3va.com, where
   * `url.domainToASCII`, which is what most validators use, says examssple.com.
   */
  it("delivers to the domain that url.domainToASCII computes, not a different one", async () => {
    const domain = "examẞple.com";
    expect(domainToASCII(domain)).toBe("examssple.com");

    await client().send({ to: `owner@${domain}`, subject: "s", text: "t" });

    expect(received[0]?.rcpt).toEqual(["owner@examssple.com"]);
  });

  /**
   * Whitespace or a comment around a dot of the domain: 10.0.8 stopped
   * reading at it and delivered to `owner@example`, a bare host, instead of
   * example.com.
   */
  it.each(["owner@example .com", "owner@example. com", "owner@example(note).com"])(
    "does not truncate the domain of %j to a different host",
    async (to) => {
      await client().send({ to, subject: "s", text: "t" });

      expect(received[0]?.rcpt).toEqual(["owner@example.com"]);
    },
  );

  it("sends an internationalised domain as its punycode form", async () => {
    await client().send({ to: "owner@bücher.example", subject: "s", text: "t" });
    expect(received[0]?.rcpt).toEqual([`owner@${domainToASCII("bücher.example")}`]);
  });

  it("turns a refused recipient into EmailSendError without echoing the address", async () => {
    rejectRecipients = true;
    const error = await client()
      .send({ to: "gone@brand.test", subject: "s", text: "t" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmailSendError);
    expect((error as Error).message).not.toContain("gone@brand.test");
    expect(received).toHaveLength(0);
  });
});
