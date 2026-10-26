"use client";

import { useEffect, useRef, useState } from "react";
import { ACCEPTED_LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/brand/logo";

/**
 * Choosing the picture that goes at the top of a brand's shopper pages.
 *
 * One component, used by the first-run setup screen and by the appearance
 * screen, because they ask the same question and a brand that learns the
 * answer on one should not meet a different control on the other.
 *
 * Nothing is uploaded when a file is picked. The file rides the form it sits
 * in and is written by the same save as the colours, which means a brand who
 * changes their mind before pressing the button has changed nothing - and
 * that a failed save leaves the old logo exactly where it was rather than
 * half-replaced.
 */

/** What the file picker offers, kept in step with what the server accepts. */
const ACCEPT = "image/png,image/jpeg,image/webp";

export function LogoField({
  /** Where the logo already on file can be fetched, or null if there isn't one. */
  existing,
  /**
   * The parent's preview follows this: an object URL while a file is picked,
   * the stored one otherwise, null once it is marked for removal. The
   * preview is the only reason a brand can tell whether they picked the
   * right file, so it has to move the moment they pick it.
   */
  onPreview,
  /** Shown under the field. Different on setup, where the logo is optional and new. */
  help,
}: {
  existing: string | null;
  onPreview: (url: string | null) => void;
  help?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ url: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The object URL is a handle on a blob the browser is holding for us, and
  // it is held until it is released. Revoking on unmount is what stops a
  // brand who tries six logos leaving six of them in memory.
  useEffect(() => {
    return () => {
      if (picked) URL.revokeObjectURL(picked.url);
    };
  }, [picked]);

  function show(url: string | null) {
    onPreview(url);
  }

  function choose(file: File | null) {
    if (picked) URL.revokeObjectURL(picked.url);

    if (!file) {
      setPicked(null);
      setError(null);
      show(removing ? null : existing);
      return;
    }

    // Two checks here and the real ones on the server, which reads the
    // file's own bytes. These exist to answer immediately rather than after
    // a round trip carrying a file we were always going to refuse.
    if (file.size > MAX_LOGO_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setPicked(null);
      if (input.current) input.current.value = "";
      setError(`That file is ${mb}MB. Logos have to be under 512KB - it is shown about 40px tall, so a small one loses nothing.`);
      return;
    }

    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
      setPicked(null);
      if (input.current) input.current.value = "";
      setError(
        "We can't take SVG. An SVG can contain code, and this one would be served from your own address where your customers are signed in. Export it as a PNG at about twice the size it is shown and it will look identical.",
      );
      return;
    }

    const url = URL.createObjectURL(file);
    setPicked({ url, name: file.name });
    setRemoving(false);
    setError(null);
    show(url);
  }

  function markRemoved() {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
    if (input.current) input.current.value = "";
    setRemoving(true);
    setError(null);
    show(null);
  }

  function undoRemove() {
    setRemoving(false);
    show(existing);
  }

  const shown = picked?.url ?? (removing ? null : existing);

  return (
    <div className="cn-field">
      <label htmlFor="logoFile">Your logo</label>

      <div className="cn-logo-row">
        {/* A checkerboard behind it, because most logos are transparent PNGs
            and a white one on a white card looks like a failed upload. */}
        <div className="cn-logo-well" aria-hidden={shown ? undefined : true}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="cn-logo-shot" />
          ) : (
            <span className="cn-logo-none">No logo</span>
          )}
        </div>

        <div className="cn-logo-controls">
          {/* Always mounted, never conditional. React unmounting a file
              input is React dropping the file the brand chose, and the only
              sign of it would be a save that quietly kept the old logo. */}
          <input
            ref={input}
            id="logoFile"
            name="logoFile"
            type="file"
            accept={ACCEPT}
            className="cn-logo-input"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />

          {picked && (
            <p className="cn-label">
              <strong>{picked.name}</strong> is ready. It is saved with the rest of this form.
            </p>
          )}

          {removing ? (
            <p className="cn-label cn-warn-note">
              Your logo is removed when you save.{" "}
              <button type="button" className="cn-linkish" onClick={undoRemove}>
                Keep it
              </button>
            </p>
          ) : (
            existing &&
            !picked && (
              <button type="button" className="cn-btn cn-btn-quiet" onClick={markRemoved}>
                Remove logo
              </button>
            )
          )}
        </div>
      </div>

      {/* The tick box the server reads. Hidden rather than shown, because
          the visible control is the button above - a tick box labelled
          "remove my logo" sitting permanently under a logo is an invitation
          to an accident. */}
      {removing && <input type="hidden" name="removeLogo" value="1" />}

      {error && <p className="cn-err" role="alert">{error}</p>}

      <p className="cn-label">
        {help ?? "Optional. Without one your name is set in type, which is a perfectly good answer."}{" "}
        {ACCEPTED_LOGO_TYPES}, under 512KB. It is shown about 40px tall, so export it at roughly twice that and it
        will be sharp on every phone.
      </p>
    </div>
  );
}
