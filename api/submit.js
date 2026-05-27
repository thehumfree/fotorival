/**
 * Vercel serverless function — POST /api/submit
 *
 * Runs server-side. Holds the bearer token (read from process.env), forwards
 * the form payload to fotorivals, returns a safe response to the browser.
 *
 * The token is NEVER sent to the client. Configure it in Vercel:
 *   Project → Settings → Environment Variables → add FOTORIVALS_TOKEN
 */

const FOTORIVALS_URL =
  process.env.FOTORIVALS_URL ||
  'https://app.fotorivals.com/api/integrations/bizzabo/users/bulk';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickString(v, max = 200) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

export default async function handler(req, res) {
  // CORS / method guard
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = process.env.FOTORIVALS_TOKEN;
  if (!token) {
    console.error('[config] FOTORIVALS_TOKEN env var is missing.');
    return res
      .status(500)
      .json({ error: 'Server is not configured. Please contact the organizer.' });
  }

  // Vercel parses JSON bodies automatically when Content-Type is application/json.
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};

  const email        = pickString(body.email, 254).toLowerCase();
  const firstName    = pickString(body.firstName, 80);
  const lastName     = pickString(body.lastName, 80);
  const ticketNumber = pickString(body.ticketNumber, 120);

  const errors = {};
  if (!email || !EMAIL_RE.test(email)) errors.email = 'Invalid email.';
  if (!firstName)    errors.firstName    = 'Required.';
  if (!lastName)     errors.lastName     = 'Required.';
  if (!ticketNumber) errors.ticketNumber = 'Required.';

  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Invalid input.', fields: errors });
  }

  // Reshape to the upstream contract: { email, firstName, lastName, token }
  // (here `token` is the ticket number, per the API spec).
  const upstreamBody = {users: [{ email, firstName, lastName, token: ticketNumber }]};

  try {
    const upstream = await fetch(FOTORIVALS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    let upstreamPayload = null;
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { upstreamPayload = await upstream.json(); } catch (_) {}
    } else {
      try { upstreamPayload = await upstream.text(); } catch (_) {}
    }

    if (!upstream.ok) {
      console.error('[upstream-error]', upstream.status, upstreamPayload);
      return res.status(502).json({
        error:
          (upstreamPayload && upstreamPayload.message) ||
          `The registration service rejected the request (status ${upstream.status}).`,
      });
    }

    return res.status(200).json({ ok: true, upstream: upstreamPayload });
  } catch (err) {
    console.error('[proxy-fetch-failed]', err);
    return res.status(502).json({
      error: 'Could not reach the registration service. Please try again.',
    });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch (_) { return {}; }
}
