const stripeEnvironmentVariables = Object.keys(process.env)
  .filter((name) => name.startsWith("STRIPE_"))
  .sort();

console.error(
  JSON.stringify(
    {
      stripeEnvironmentVariables,
      treasuryTestKeyLength:
        process.env.STRIPE_TREASURY_TEST_SECRET_KEY?.trim().length ?? 0,
    },
    null,
    2,
  ),
);
