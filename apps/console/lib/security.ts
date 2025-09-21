export const CSP_REPORT_ENDPOINT = '/api/csp-report';

export type BuildCspOptions = {
  nonce: string;
  environment?: 'development' | 'test' | 'production';
  supabaseUrl?: string;
  posthogHost?: string;
  statuspageEmbedUrl?: string;
  reportUri?: string;
};

const SUPABASE_WILDCARDS = [
  'https://*.supabase.co',
  'https://*.supabase.in',
  'wss://*.supabase.co',
  'wss://*.supabase.in'
];

const DEFAULT_CONNECT = [
  "'self'",
  'https://console.torvussecurity.com',
  'https://platform.torvussecurity.com'
];

export function buildContentSecurityPolicy(options: BuildCspOptions): string {
  const {
    nonce,
    environment = process.env.NODE_ENV === 'production' ? 'production' : 'development',
    supabaseUrl,
    posthogHost,
    statuspageEmbedUrl,
    reportUri
  } = options;

  const connectSrc = new Set<string>(DEFAULT_CONNECT);
  for (const wildcard of SUPABASE_WILDCARDS) {
    connectSrc.add(wildcard);
  }

  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      connectSrc.add(url.origin);
      if (url.protocol === 'https:') {
        connectSrc.add(url.origin.replace('https://', 'wss://'));
      }
    } catch (error) {
      console.warn('Invalid SUPABASE_URL for CSP', error);
    }
  }

  if (posthogHost) {
    connectSrc.add(posthogHost);
  }

  const scriptSrc = new Set<string>(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", 'https:']);
  if (environment !== 'production') {
    scriptSrc.add("'unsafe-eval'");
  }

  const styleSrc = new Set<string>(["'self'", `'nonce-${nonce}'`, 'https:']);
  if (environment !== 'production') {
    styleSrc.add("'unsafe-inline'");
  }

  const imgSrc = ["'self'", 'data:', 'https:', 'blob:'];
  const fontSrc = ["'self'", 'https:', 'data:'];
  const frameSrc = new Set<string>(["'self'"]);

  if (statuspageEmbedUrl) {
    try {
      const { origin } = new URL(statuspageEmbedUrl);
      frameSrc.add(origin);
    } catch (error) {
      console.warn('Invalid STATUSPAGE embed URL for CSP', error);
    }
  } else {
    frameSrc.add('https://*.statuspage.io');
  }

  const reportDirective = `report-uri ${reportUri ?? CSP_REPORT_ENDPOINT}`;

  const directives = [
    "default-src 'self'",
    `script-src ${Array.from(scriptSrc).join(' ')}`,
    `style-src ${Array.from(styleSrc).join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    `font-src ${fontSrc.join(' ')}`,
    `connect-src ${Array.from(connectSrc).join(' ')}`,
    `frame-src ${Array.from(frameSrc).join(' ')}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
    reportDirective
  ];

  return directives.join('; ');
}

export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return encodeBase64(array);
  }

  const nodeCrypto = (globalThis as any).crypto ?? undefined;
  if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
    return encodeBase64(nodeCrypto.randomBytes(16));
  }

  return Math.random().toString(36).slice(2, 22);
}

export function buildReportToHeader(): string {
  return JSON.stringify({
    group: 'torvus-console-csp',
    max_age: 10886400,
    endpoints: [{ url: CSP_REPORT_ENDPOINT }]
  });
}

function encodeBase64(bytes: ArrayBuffer | Uint8Array): string {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const nodeBuffer: typeof Buffer | undefined = (globalThis as any).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(buffer).toString('base64');
  }

  let binary = '';
  buffer.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  if (nodeBuffer) {
    return nodeBuffer.from(binary, 'binary').toString('base64');
  }

  throw new Error('Base64 encoding not supported in this environment.');
}
