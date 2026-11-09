import { describe, expect, it } from "vitest";
import { twimlReply, TWIML_CONTENT_TYPE } from "@/lib/sms/twiml";

describe("the reply envelope Twilio expects", () => {
  it("wraps a message in a Response", () => {
    expect(twimlReply("Your balance is R42.00")).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Your balance is R42.00</Message></Response>',
    );
  });

  it("sends nothing, rather than an empty body, when there is nothing to say", () => {
    // A throttled sender and a delivery receipt both land here. An empty
    // body is what Twilio reads as an application error; an empty Response
    // is how you say "received, say nothing".
    expect(twimlReply("")).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(twimlReply("   ")).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  it("escapes what would otherwise end the document early", () => {
    // An ampersand is the realistic one: it turns up in brand names and in
    // any reply that joins two things. Unescaped it makes the whole
    // document invalid, so the shopper gets silence for a message we
    // successfully composed.
    const out = twimlReply(`Tea & Co <b>"x"</b> it's`);
    expect(out).toContain("Tea &amp; Co &lt;b&gt;&quot;x&quot;&lt;/b&gt; it&#39;s");
    expect(out).not.toContain("<b>");
  });

  it("escapes an ampersand once, not twice", () => {
    // The classic bug in a hand-written escaper is ordering: replacing the
    // angle brackets before the ampersand turns &lt; into &amp;lt;.
    expect(twimlReply("a & b")).toContain("a &amp; b");
    expect(twimlReply("a < b")).toContain("a &lt; b");
    expect(twimlReply("a < b")).not.toContain("&amp;lt;");
  });

  it("is served as xml, because text/plain is what broke it", () => {
    expect(TWIML_CONTENT_TYPE).toContain("text/xml");
  });
});
