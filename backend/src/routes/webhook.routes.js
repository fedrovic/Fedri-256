'use strict';

const router = require('express').Router();
const logger = require('../config/logger');
const { prisma } = require('../config/database');

// NOTE: app.js sets express.raw() on this route path for Stripe signature verification
router.post('/stripe', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn('STRIPE_WEBHOOK_SECRET not configured — accepting all webhook events in dev');
  }

  let event;

  try {
    if (secret && sig) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      // Dev mode — parse raw body manually
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {

      // ── Checkout session completed ───────────────────────
      case 'checkout.session.completed': {
        const session  = event.data.object;
        const userId   = session.metadata?.userId;
        const coins    = parseInt(session.metadata?.coins, 10);

        if (userId && coins > 0) {
          const updated = await prisma.user.update({
            where: { id: userId },
            data: { coinBalance: { increment: coins } },
            select: { coinBalance: true },
          });
          await prisma.coinTransaction.create({
            data: {
              userId,
              type:        'PURCHASE',
              amount:      coins,
              balanceAfter: updated.coinBalance,
              description: `Purchased ${coins} SkillCoins`,
              stripeId:    session.id,
            },
          });
          await prisma.notification.create({
            data: {
              userId,
              type:  'COIN_EARNED',
              title: `${coins} SkillCoins added to your wallet!`,
              body:  'Your purchase was successful. Start learning!',
              data:  { coins, stripeSessionId: session.id },
            },
          });
          logger.info(`Credited ${coins} coins to user ${userId}`);
        }
        break;
      }

      // ── Premium subscription created ─────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub    = event.data.object;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const isActive = sub.status === 'active' || sub.status === 'trialing';
        await prisma.user.update({
          where: { id: userId },
          data: {
            isPremium:        isActive,
            premiumExpiresAt: isActive ? new Date(sub.current_period_end * 1000) : null,
          },
        });
        if (isActive) {
          await prisma.notification.create({
            data: {
              userId,
              type:  'SYSTEM',
              title: '⚡ Premium activated!',
              body:  'You now have unlimited swaps, HD video, and priority matching.',
              data:  { premiumUntil: sub.current_period_end },
            },
          });
        }
        logger.info(`Premium status updated for user ${userId}: ${isActive}`);
        break;
      }

      // ── Subscription cancelled ────────────────────────────
      case 'customer.subscription.deleted': {
        const sub    = event.data.object;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await prisma.user.update({
          where: { id: userId },
          data: { isPremium: false, premiumExpiresAt: null },
        });
        logger.info(`Premium cancelled for user ${userId}`);
        break;
      }

      // ── Payment failed ────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const userId  = invoice.metadata?.userId;
        if (!userId) break;
        await prisma.notification.create({
          data: {
            userId,
            type:  'SYSTEM',
            title: 'Payment failed',
            body:  'Your premium subscription payment failed. Please update your payment method.',
            data:  { invoiceId: invoice.id },
          },
        });
        break;
      }

      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    logger.error('Webhook processing error', { error: err.message, eventType: event.type });
    // Return 200 anyway — Stripe will retry if we return non-2xx
  }

  res.json({ received: true });
});

module.exports = router;
