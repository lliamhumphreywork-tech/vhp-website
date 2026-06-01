/**
 * VHP Content Submit API
 * POST /api/submit
 *
 * Called by the Cowork content engine to push generated posts
 * directly into the marketing dashboard Pending queue.
 *
 * Required env vars (set in Vercel dashboard):
 *   FIREBASE_SERVICE_ACCOUNT  — service account JSON as a single-line string
 *   VHP_SUBMIT_KEY            — a secret you choose (e.g. "vhp-submit-2026")
 *
 * Body: { platform, content, scheduledAt?, imageUrl?, apiKey }
 * Returns: { id, status: "pending" }
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Initialise once (Vercel may reuse the function instance)
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = getFirestore();

module.exports = async function handler(req, res) {
  // CORS — only allow the VHP workspace origin
  res.setHeader('Access-Control-Allow-Origin', 'https://vonhartmannpartners.co.za');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, content, scheduledAt, imageUrl, apiKey } = req.body || {};

  // Auth
  if (!apiKey || apiKey !== process.env.VHP_SUBMIT_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate
  if (!platform || !content) {
    return res.status(400).json({ error: 'platform and content are required' });
  }

  const validPlatforms = ['LINKEDIN POST', 'LINKEDIN CAROUSEL', 'X POST', 'X THREAD'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({
      error: 'Invalid platform. Use: ' + validPlatforms.join(', ')
    });
  }

  try {
    const ref = await db.collection('marketing_posts').add({
      platform,
      content,
      scheduledAt:  scheduledAt  || null,
      imageUrl:     imageUrl     || null,
      status:       'pending',
      source:       'cowork-engine',
      createdAt:    FieldValue.serverTimestamp()
    });

    return res.status(200).json({ id: ref.id, status: 'pending' });

  } catch (err) {
    console.error('Firestore write failed:', err);
    return res.status(500).json({ error: 'Failed to submit content' });
  }
};
