import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const priceId = req.query.priceId || req.body?.priceId;
  if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

  // Map your cheap pricing - REPLACE THESE WITH YOUR REAL PRICE IDS FROM STRIPE DASHBOARD
  // Create in Stripe: Products > Add product > $1.99, $4.99/mo recurring, $12.99 lifetime
  const isSubscription = priceId === process.env.STRIPE_PRICE_MONTHLY; // $4.99/mo
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin || process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : req.headers.referer?.split('?')[0] || 'http://localhost:3000'}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?canceled=true`,
      allow_promotion_codes: true,
    });
    // For client-side: return url, for direct redirect: 303
    if (req.query.redirect === '1') {
      return res.redirect(303, session.url);
    }
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
