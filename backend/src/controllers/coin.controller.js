'use strict';

const { prisma } = require('../config/database');
const { sendSuccess, sendBadRequest, sendPaginated } = require('../utils/apiResponse');
const config  = require('../config');
const logger  = require('../utils/logger');

// ── Get balance & transaction history ────────────────────────
exports.getWallet = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { coinBalance: true, totalSessions: true },
  });

  const [transactions, total] = await Promise.all([
    prisma.coinTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.coinTransaction.count({ where: { userId: req.user.id } }),
  ]);

  const stats = await prisma.coinTransaction.aggregate({
    where: { userId: req.user.id },
    _sum: { amount: true },
  });

  return sendSuccess(res, {
    balance: user.coinBalance,
    totalEarned: stats._sum.amount || 0,
    recentTransactions: transactions,
    totalTransactions: total,
  });
};

// ── Spend coins (learn from someone) ─────────────────────────
exports.spendCoins = async (req, res) => {
  const { amount, swapId, description } = req.body;

  if (amount < 1) return sendBadRequest(res, 'Amount must be at least 1');

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { coinBalance: true },
  });

  if (user.coinBalance < amount) {
    return sendBadRequest(res, `Insufficient SkillCoins. You have ${user.coinBalance}, need ${amount}.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: req.user.id },
      data: { coinBalance: { decrement: amount } },
      select: { coinBalance: true },
    });

    const tx_record = await tx.coinTransaction.create({
      data: {
        userId: req.user.id,
        type: 'SPEND',
        amount: -amount,
        balanceAfter: updated.coinBalance,
        description: description || 'SkillCoin spent',
        swapId,
      },
    });

    return { newBalance: updated.coinBalance, transaction: tx_record };
  });

  return sendSuccess(res, result, `${amount} SkillCoin${amount > 1 ? 's' : ''} spent`);
};

// ── Purchase coins via Stripe ─────────────────────────────────
exports.purchaseCoins = async (req, res) => {
  const { package: pkg } = req.body;

  const PACKAGES = {
    starter:     { coins: 5,   priceId: 'price_starter',   amount: 499,   currency: 'usd' },
    standard:    { coins: 12,  priceId: 'price_standard',  amount: 999,   currency: 'usd' },
    value:       { coins: 25,  priceId: 'price_value',     amount: 1799,  currency: 'usd' },
    power:       { coins: 50,  priceId: 'price_power',     amount: 2999,  currency: 'usd' },
  };

  const selected = PACKAGES[pkg];
  if (!selected) return sendBadRequest(res, 'Invalid package. Choose: starter, standard, value, or power');

  // In production: create Stripe checkout session
  // Returning a mock payment intent for now
  const mockClientSecret = `pi_mock_${Date.now()}_secret_${req.user.id}`;

  return sendSuccess(res, {
    clientSecret: mockClientSecret,
    package: { ...selected, name: pkg },
    instructions: 'Use the clientSecret with Stripe.js to complete payment',
  }, 'Payment session created');
};

// ── Webhook: credit coins after successful Stripe payment ─────
exports.creditCoinsAfterPayment = async (userId, coins, stripeId) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { coinBalance: { increment: coins } },
    select: { coinBalance: true },
  });

  await prisma.coinTransaction.create({
    data: {
      userId,
      type: 'PURCHASE',
      amount: coins,
      balanceAfter: user.coinBalance,
      description: `Purchased ${coins} SkillCoins`,
      stripeId,
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: 'COIN_EARNED',
      title: `${coins} SkillCoins added!`,
      body: 'Your purchase was successful. Start learning!',
    },
  });

  logger.info(`Credited ${coins} coins to user ${userId} via Stripe ${stripeId}`);
};

// ── Transfer coins (peer-to-peer, for paid sessions) ─────────
exports.transferCoins = async (req, res) => {
  const { recipientId, amount, swapId } = req.body;

  if (amount < 1) return sendBadRequest(res, 'Transfer amount must be at least 1');
  if (recipientId === req.user.id) return sendBadRequest(res, 'Cannot transfer to yourself');

  const sender = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { coinBalance: true, displayName: true },
  });

  if (sender.coinBalance < amount) {
    return sendBadRequest(res, `Insufficient balance. You have ${sender.coinBalance} SkillCoins.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Debit sender
    const updatedSender = await tx.user.update({
      where: { id: req.user.id },
      data: { coinBalance: { decrement: amount } },
      select: { coinBalance: true },
    });

    // Credit recipient
    const updatedRecipient = await tx.user.update({
      where: { id: recipientId },
      data: { coinBalance: { increment: amount } },
      select: { coinBalance: true, displayName: true },
    });

    // Log both sides
    await tx.coinTransaction.createMany({
      data: [
        {
          userId: req.user.id,
          type: 'SPEND',
          amount: -amount,
          balanceAfter: updatedSender.coinBalance,
          description: `Transferred to ${updatedRecipient.displayName}`,
          swapId,
        },
        {
          userId: recipientId,
          type: 'EARN',
          amount,
          balanceAfter: updatedRecipient.coinBalance,
          description: `Received from ${sender.displayName}`,
          swapId,
        },
      ],
    });

    // Notify recipient
    await tx.notification.create({
      data: {
        userId: recipientId,
        type: 'COIN_EARNED',
        title: `You received ${amount} SkillCoin${amount > 1 ? 's' : ''}!`,
        body: `${sender.displayName} transferred coins to you`,
        data: { swapId, amount },
      },
    });

    return { newBalance: updatedSender.coinBalance };
  });

  return sendSuccess(res, result, `${amount} SkillCoin${amount > 1 ? 's' : ''} transferred`);
};
