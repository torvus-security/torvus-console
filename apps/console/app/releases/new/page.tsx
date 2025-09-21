'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ReleaseRequestResponse = {
  request: {
    id: string;
  };
};

export default function NewReleasePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, description: trimmedDescription || undefined })
      });

      if (!response.ok) {
        const message = response.status === 400 ? 'Check the form fields and try again.' : 'Failed to create release request.';
        setError(message);
        setSubmitting(false);
        return;
      }

      const json = (await response.json()) as ReleaseRequestResponse;
      const requestId = json?.request?.id;

      if (typeof requestId === 'string') {
        router.push(`/releases/${requestId}`);
      } else {
        setError('Release request created but response was unexpected.');
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Failed to create release request', err);
      setError('Failed to create release request.');
      setSubmitting(false);
    }
  }

  return (
    <div className="page max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">New release request</h1>
        <p className="mt-2 text-sm text-slate-300">
          Submit a request for the security admins to review and approve.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6 shadow">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium text-slate-200">
            Title <span className="text-rose-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="block text-sm font-medium text-slate-200">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
          />
          <p className="text-xs text-slate-400">Include rollout details, environment, and any caveats.</p>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-slate-300 hover:text-slate-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
