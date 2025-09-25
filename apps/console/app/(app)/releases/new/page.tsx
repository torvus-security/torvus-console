'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Callout, Card, Flex, Heading, Text, TextArea, TextField } from '@radix-ui/themes';

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
        <Heading as="h1" size="6">
          New release request
        </Heading>
        <Text size="2" color="gray" className="mt-2">
          Submit a request for the security admins to review and approve.
        </Text>
      </div>

      <Card size="5" className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Flex direction="column" gap="2">
            <Text asChild size="2" weight="medium">
              <label htmlFor="title">
                Title{' '}
                <Text as="span" color="crimson" weight="bold">
                  *
                </Text>
              </label>
            </Text>
            <TextField.Root
              id="title"
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Release title"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text asChild size="2" weight="medium">
              <label htmlFor="description">Description</label>
            </Text>
            <TextArea
              id="description"
              name="description"
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Include rollout details, environment, and any caveats."
            />
            <Text size="1" color="gray">
              Include rollout details, environment, and any caveats.
            </Text>
          </Flex>

          {error ? (
            <Callout.Root color="crimson" role="status">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          ) : null}

          <Flex align="center" gap="3" wrap="wrap">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
            <Button type="button" variant="ghost" color="indigo" onClick={() => router.back()}>
              Cancel
            </Button>
          </Flex>
        </form>
      </Card>
    </div>
  );
}
