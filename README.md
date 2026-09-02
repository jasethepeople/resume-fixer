# AI Resume Fixer - $1.99 Cheap Paywall - Vercel + Stripe/Lemon/Paddle

## Fees Comparison for $1.99
- Stripe: $1.99 - (2.9% + $0.30) = $1.63 net (18% fee) - BAD for cheap
- Lemon Squeezy: $1.99 - (5% + $0.50) = $1.39 net but handles ALL global tax + VAT - GOOD for $1.99
- Paddle: Same as Lemon, best for $4.99/mo subs

**RECOMMENDATION for cheap:** Use Lemon Squeezy for $1.99 and $12.99, Paddle for $4.99/mo, or keep Stripe but bump to $2.99 to offset fees.

## Deploy
`vercel --prod` or drag to vercel.com/new

## Providers

### Mock (current, for testing)
In src/App.tsx: PAYMENT_PROVIDER='mock'
Clicking Unlock instantly unlocks.

### Lemon Squeezy (recommended for $1.99)
1. Create account lemonsqueezy.com
2. Products > Create 3 products with variants
3. Copy Variant IDs
4. Vercel Env: LEMON_API_KEY, LEMON_STORE_ID, LEMON_STORE
5. In App.tsx: PAYMENT_PROVIDER='lemon', USE_LEMON=true
6. api/lemon-checkout.js will create checkout and redirect

Buy link fallback: https://yourstore.lemonsqueezy.com/buy/VARIANT_ID

### Paddle (for subs)
1. paddle.com > Products > Prices
2. Copy Price IDs pri_...
3. Vercel Env: PADDLE_API_KEY, PADDLE_ENV=live
4. App.tsx: PAYMENT_PROVIDER='paddle'

### Stripe
See previous instructions.

## All checkouts return to /?success=true which auto-unlocks Pro via localStorage signature.

## Cheap Pricing
Free: 2 scans
$1.99: full resume
$4.99/mo: unlimited + premium tools
$12.99 lifetime: everything

Net revenue after fees still ~$1.40 per $1.99 sale - 100 sales = $140, 1000 sales = $1400/mo passive.
