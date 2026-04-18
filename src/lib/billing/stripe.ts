import Stripe from "stripe";
import { getEnv } from "@/lib/env";

export function getStripe(): Stripe {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function createInvoiceForDeal(args: {
  customerEmail: string;
  amountCents: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<{ stripeInvoiceId: string; hostedUrl: string | null }> {
  const stripe = getStripe();
  const customers = await stripe.customers.list({
    email: args.customerEmail,
    limit: 1,
  });
  const customer =
    customers.data[0] ??
    (await stripe.customers.create({ email: args.customerEmail }));

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 14,
    metadata: args.metadata,
  });

  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    amount: args.amountCents,
    currency: "usd",
    description: args.description,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  return {
    stripeInvoiceId: finalized.id,
    hostedUrl: finalized.hosted_invoice_url ?? null,
  };
}
