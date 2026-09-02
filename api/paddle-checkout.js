// Paddle - Great for $4.99/mo SaaS, handles tax, lower chargeback risk
// Docs: https://developer.paddle.com/

import { Paddle } from '@paddle/paddle-node-sdk';

export default async function handler(req, res) {
  const priceId = req.query.priceId || req.body?.priceId;
  if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

  const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
  const PADDLE_ENV = process.env.PADDLE_ENV || 'sandbox'; // 'live' or 'sandbox'

  try {
    if (PADDLE_API_KEY) {
      const paddle = new Paddle(PADDLE_API_KEY, { environment: PADDLE_ENV });
      const transaction = await paddle.transactions.create({
        items: [{ priceId, quantity: 1 }],
        details: { tax: { included: true } },
        customData: { origin: req.headers.origin },
      });
      // Paddle returns checkout URL
      const url = transaction?.data?.details?.checkout?.url || transaction?.data?.checkout?.url;
      if (url) {
        if (req.query.redirect === '1') return res.redirect(303, url);
        return res.status(200).json({ url, id: transaction.data.id });
      }
    }
    // Fallback - redirect to Paddle checkout link you create in dashboard
    // Example: https://yourstore.paddle.com/checkout/custom?priceId=...
    const fallback = `https://buy.paddle.com/checkout?priceId=${priceId}&success_url=${encodeURIComponent((req.headers.origin || 'http://localhost:3000') + '/?success=true&provider=paddle')}`;
    return res.redirect(303, fallback);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
