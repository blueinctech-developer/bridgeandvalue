"use client";

import { useEffect, useState } from "react";

/**
 * Destructive submit button that needs two clicks: the first arms it
 * ("Click again to confirm"), the second submits. Disarms after 4 seconds.
 */
export default function ConfirmButton({
  children,
  confirmLabel = "Click again to confirm",
  className = "btn danger",
  formAction,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      formNoValidate
      aria-live="polite"
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
