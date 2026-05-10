const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const FIREBASE_PROJECT_ID = 'my-first-project-55c1a';
const FIREBASE_API_KEY    = 'AIzaSyA0VmEmpIoC3LCAi-M2Rh9Y-fSi6qh7iFY';
const ORG_ID              = 'dronehub_main';
const JOBS_DOC_ID         = ORG_ID + ':jobs';

// Firestore REST helpers
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function firestoreGet(collection, docId) {
  const url = `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const doc = await res.json();
  // Extract string fields from Firestore format
  const fields = doc.fields || {};
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = parseInt(v.integerValue);
    else if (v.doubleValue !== undefined) out[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
  }
  return out;
}

async function firestorePatch(collection, docId, data) {
  // Build Firestore field map
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string')  fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  const url = `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return { statusCode: 500, body: 'Webhook secret not configured' };
  }

  // Verify Stripe signature
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Only handle successful checkouts
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Ignored' };
  }

  const session = stripeEvent.data.object;
  const jobId   = parseInt(session.metadata?.job_id || '0');

  if (!jobId) {
    console.warn('No job_id in Stripe session metadata, skipping mark-paid');
    return { statusCode: 200, body: 'No job_id — skipped' };
  }

  try {
    // Read current jobs from Firestore
    const doc = await firestoreGet('orgs', JOBS_DOC_ID);
    if (!doc || !doc.data) {
      console.error('Could not read jobs from Firestore');
      return { statusCode: 500, body: 'Could not read jobs' };
    }

    const jobs = JSON.parse(doc.data);
    const job  = jobs.find(j => j.id === jobId);

    if (!job) {
      console.warn(`Job ${jobId} not found in Firestore`);
      return { statusCode: 200, body: 'Job not found — skipped' };
    }

    if (job.markedPaid) {
      // Already marked — idempotent, ignore
      return { statusCode: 200, body: 'Already paid' };
    }

    // Mark as paid
    job.markedPaid  = true;
    job.paidAt      = new Date().toISOString().slice(0, 10);
    job.paidVia     = 'stripe';
    job.stripeSessionId = session.id;

    // Write back to Firestore
    const ok = await firestorePatch('orgs', JOBS_DOC_ID, {
      data:      JSON.stringify(jobs),
      updatedAt: Date.now(),
    });

    if (!ok) {
      console.error('Firestore write failed');
      return { statusCode: 500, body: 'Firestore write failed' };
    }

    console.log(`✅ Job ${jobId} marked as paid via Stripe session ${session.id}`);
    return { statusCode: 200, body: 'Invoice marked as paid' };

  } catch (err) {
    console.error('Error marking job paid:', err);
    return { statusCode: 500, body: err.message };
  }
};
