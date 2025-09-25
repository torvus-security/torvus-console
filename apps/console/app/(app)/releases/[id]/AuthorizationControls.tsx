'use client';

import { useState } from 'react';

const GITHUB_ACTIONS_SNIPPET = `- name: Fetch release authorization
  run: |
    curl -sS -H "CF-Access-Client-Id: \${{ secrets.CF_ACCESS_ID }}" \\
            -H "CF-Access-Client-Secret: \${{ secrets.CF_ACCESS_SECRET }}" \\
            -o auth.json \\
            https://console.torvussecurity.com/api/releases/\${{ env.RELEASE_ID }}/authorization
    node .github/scripts/verify-release-auth.js auth.json`;

type AuthorizationControlsProps = {
  requestId: string;
};

export function AuthorizationControls({ requestId }: AuthorizationControlsProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function downloadAuthorization() {
    if (downloading) return;

    setDownloading(true);
    setDownloadError(null);
    setDownloadMessage(null);

    try {
      const response = await fetch(`/api/releases/${requestId}/authorization`, {
        headers: { accept: 'application/json' }
      });

      if (!response.ok) {
        const message =
          response.status === 403
            ? 'You do not have permission to download the authorization manifest.'
            : response.status === 409
            ? 'This release request is no longer approved.'
            : 'Failed to download the authorization manifest.';
        setDownloadError(message);
        setDownloading(false);
        return;
      }

      const body = await response.json();
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `release-auth-${requestId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadMessage('Authorization manifest downloaded.');
    } catch (error) {
      console.error('Failed to download release authorization', error);
      setDownloadError('Failed to download the authorization manifest.');
    } finally {
      setDownloading(false);
    }
  }

  async function copySnippet() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(GITHUB_ACTIONS_SNIPPET);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy release authorization snippet', error);
      setCopyError('Failed to copy the snippet.');
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Release executor authorization</h2>
          <p className="text-sm text-slate-400">
            Download the signed manifest and use the GitHub Actions snippet to verify it before deployment.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadAuthorization}
          disabled={downloading}
          className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {downloading ? 'Preparing…' : 'Download authorization'}
        </button>
      </div>
      {downloadMessage && <p className="text-sm text-emerald-300">{downloadMessage}</p>}
      {downloadError && <p className="text-sm text-rose-400">{downloadError}</p>}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-200">GitHub Actions validation</h3>
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex items-center rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Copy snippet
          </button>
        </div>
        {copySuccess && <p className="text-xs text-emerald-300">Snippet copied to clipboard.</p>}
        {copyError && <p className="text-xs text-rose-400">{copyError}</p>}
        <pre className="overflow-x-auto rounded-md border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100">
          <code>{GITHUB_ACTIONS_SNIPPET}</code>
        </pre>
      </div>
    </div>
  );
}
