"use client";

import { useState } from "react";

/**
 * One URL and a button that puts it on the clipboard.
 *
 * The whole screen exists because somebody is standing next to a bag of
 * tags with a phone in one hand, so selecting text by dragging is the thing
 * being avoided. The URL is still shown in full and still selectable: a
 * clipboard write can be refused by the browser, and when it is, the answer
 * has to be visible rather than absent.
 */
export function CopyRow({ url, caption }: { url: string; caption: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Long enough to read, short enough that a second tag does not have to
      // wait for it.
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Refused, usually because the page is not on a secure origin. Saying
      // nothing would look like a button that does nothing.
      setCopied(false);
      window.prompt("Copy this to your tag writer", url);
    }
  }

  return (
    <div className="cn-tag-row">
      <div className="cn-tag-url">
        <span className="cn-label">{caption}</span>
        <code className="cn-mono">{url}</code>
      </div>
      <button type="button" className="cn-btn cn-btn-quiet" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
