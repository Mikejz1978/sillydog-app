import { storage } from "../storage";
import Stripe from "stripe";
import { calculateServicePrice } from "@shared/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

export async function generateMonthlyInvoices(month: string, year: string): Promise<{
  success: number;
  failed: number;
  charged: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    charged: 0,
    errors: [] as string[],
  };

  try {
    const allCustomers = await storage.getAllCustomers();
    const activeCustomers = allCustomers.filter(c => c.status === "active");
    const scheduleRules = await storage.getAllScheduleRules();

    const invoiceNumber = `INV-${year}${month.padStart(2, '0')}`;
    let invoiceCounter = 1000;

    for (const customer of activeCustomers) {
      const customerSchedules = scheduleRules.filter(
        rule => rule.customerId === customer.id && !rule.paused
      );

      if (customerSchedules.length === 0) continue;

      try {
        const amount = calculateServicePrice(customer.servicePlan, customer.numberOfDogs);
        const dueDate = `${year}-${month.padStart(2, '0')}-15`;

        const invoice = await storage.createInvoice({
          customerId: customer.id,
          invoiceNumber: `${invoiceNumber}-${invoiceCounter++}`,
          amount: amount.toString(),
          status: "unpaid",
          dueDate,
          description: `${customer.servicePlan.charAt(0).toUpperCase() + customer.servicePlan.slice(1)} service for ${month}/${year}`,
        });

        results.success++;

        if (customer.autopayEnabled && customer.stripeCustomerId && customer.stripePaymentMethodId) {
          try {
            const paymentIntent = await stripe.paymentIntents.create({
              amount: Math.round(amount * 100),
              currency: "usd",
              customer: customer.stripeCustomerId,
              payment_method: customer.stripePaymentMethodId,
              off_session: true,
              confirm: true,
              description: `Auto-pay for ${invoice.invoiceNumber}`,
            });

            if (paymentIntent.status === "succeeded") {
              await storage.markInvoicePaid(invoice.id, paymentIntent.id);
              results.charged++;
            }
          } catch (chargeError: any) {
            results.errors.push(`Autopay failed for ${customer.name}: ${chargeError.message}`);
          }
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Failed to create invoice for ${customer.name}: ${error.message}`);
      }
    }

    return results;
  } catch (error: any) {
    results.errors.push(`Monthly billing job failed: ${error.message}`);
    return results;
  }
}
