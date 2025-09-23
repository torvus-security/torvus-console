export function formatBreadcrumb(pathname: string | null | undefined): string {
  if (!pathname || pathname === '/') {
    return 'Overview';
  }

  const segments = pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return 'Overview';
  }

  const formattedSegments = segments.map((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // Ignore decode failures and fall back to the raw segment
    }

    return decoded
      .split('-')
      .filter((part) => part.length > 0)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  });

  return formattedSegments.join(' / ');
}
