// Lemon Squeezy - Best for $1.99 impulse (handles global tax, cheaper than Stripe for low ticket)
// Docs: https://docs.lemonsqueezy.com/api/checkouts

export default async function handler(req, res) {
  const variant = req.query.variant || req.body?.variant;
  if (!variant) return res.status(400).json({ error: 'Missing variant ID' });

  // Option A: Use Lemon Squeezy API to create checkout
  // Option B: Simpler - just redirect to your Lemon Squeezy buy link: https://yourstore.lemonsqueezy.com/buy/<variant>?embed=1
  // For MVP we do Option B + API fallback

  const STORE = process.env.LEMON_STORE; // e.g. 'yourstore'
  const API_KEY = process.env.LEMON_API_KEY;

  try {
    if (API_KEY) {
      // Create checkout via API
      const resp = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              product_options: { redirect_url: `${req.headers.origin}/?success=true&provider=lemon` },
              checkout_options: { embed: false, media: false },
              checkout_data: { custom: { user_id: 'guest' } }
            },
            relationships: {
              store: { data: { type: 'stores', id: process.env.LEMON_STORE_ID } },
              variant: { data: { type: 'variants', id: variant } }
            }
          }
        })
      });
      const data = await resp.json();
      const url = data?.data?.attributes?.url;
      if (url) {
        if (req.query.redirect === '1') return res.redirect(303, url);
        return res.status(200).json({ url });
      }
    }
    // Fallback: direct buy link (create in Lemon Dashboard > Products > Share > Buy Button)
    const buyUrl = `https://${STORE || 'yourstore'}.lemonsqueezy.com/buy/${variant}?embed=0&success_url=${encodeURIComponent((req.headers.origin || 'http://localhost:3000') + '/?success=true')}`;
    return res.redirect(303, buyUrl);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
