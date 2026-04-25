import { existsSync, readFileSync } from "node:fs";
import Stripe from "stripe";
import { subscriptionTiers } from "../src/lib/billing/tiers";

function loadDotEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

loadDotEnvLocal();

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is required to create Stripe products.");
}

const stripe = new Stripe(secretKey);

async function main() {
  for (const tier of Object.values(subscriptionTiers)) {
    const products = await stripe.products.search({
      query: `metadata['creatrops_tier']:'${tier.lookupKey}'`,
      limit: 1,
    });
    const product =
      products.data[0] ??
      (await stripe.products.create({
        name: tier.name,
        metadata: { creatrops_tier: tier.lookupKey },
      }));

    const prices = await stripe.prices.list({
      active: true,
      lookup_keys: [tier.lookupKey],
      limit: 1,
    });
    const price =
      prices.data[0] ??
      (await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: tier.amountCents,
        recurring: { interval: "month" },
        lookup_key: tier.lookupKey,
        metadata: { creatrops_tier: tier.lookupKey },
      }));

    console.log(`${tier.name}: product=${product.id} price=${price.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
