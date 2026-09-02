// Optional: verify Stripe webhook to unlock pro on server
export default function handler(req, res) {
  // For MVP we use client-side ?success=true param to set isPro
  // In production verify signature and set DB
  res.status(200).json({ received: true });
}
