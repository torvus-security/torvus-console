'use client';

import { useId, useMemo, useState } from 'react';

type AuditMetaDetailsProps = {
  meta: unknown;
};

function serialiseMeta(meta: unknown): string {
  if (meta === null || typeof meta === 'undefined') {
    return '';
  }

  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return meta;
    }
  }

  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export function AuditMetaDetails({ meta }: AuditMetaDetailsProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const pretty = useMemo(() => serialiseMeta(meta), [meta]);

  if (meta === null || typeof meta === 'undefined') {
    return null;
  }

  return (
    <div className="audit-meta__container">
      <button
        type="button"
        className="button ghost small"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={detailsId}
      >
        {open ? 'Hide JSON' : 'View JSON'}
      </button>
      <details id={detailsId} open={open} className="audit-meta__details">
        <summary className="sr-only">Audit metadata</summary>
        <pre className="metadata audit-meta__pre">{pretty}</pre>
      </details>
    </div>
  );
}
