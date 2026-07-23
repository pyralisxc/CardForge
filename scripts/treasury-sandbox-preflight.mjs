const stripeSecretKey = process.env.STRIPE_TREASURY_TEST_SECRET_KEY?.trim();

if (!stripeSecretKey) {
  throw new Error("STRIPE_TREASURY_TEST_SECRET_KEY is not configured.");
}

const response = await fetch(
  "https://api.stripe.com/v2/money_management/financial_accounts",
  {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Stripe-Version": "2025-12-15.preview",
    },
  },
);

const body = await response.json();

if (!response.ok) {
  throw new Error(
    `Stripe Treasury preflight failed (${response.status}): ${body.error?.code ?? body.error?.message ?? "unknown error"}`,
  );
}

const accounts = (body.data ?? []).map((account) => ({
  displayName: account.display_name ?? null,
  status: account.status,
  livemode: account.livemode,
}));

console.log(JSON.stringify({ accountCount: accounts.length, accounts }, null, 2));
