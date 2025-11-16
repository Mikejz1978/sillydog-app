import { storage } from "../storage";
import Stripe from "stripe";

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
    const serviceTypes = await storage.getAllServiceTypes();

    const invoiceNumber = `INV-${year}${month.padStart(2, '0')}`;
    let invoiceCounter = 1000;

    for (const customer of activeCustomers) {
      const customerSchedules = scheduleRules.filter(
        rule => rule.customerId === customer.id && !rule.paused
      );

      if (customerSchedules.length === 0) continue;

      try {
        // Get service type for pricing calculation
        let amount = 0;
        let serviceTypeName = "Service";
        let timesPerWeek = 1;
        
        const serviceType = serviceTypes.find(st => st.id === customer.serviceTypeId);
        if (!serviceType) {
          results.errors.push(`Skipped ${customer.name}: No service type configured`);
          continue;
        }
        
        // Simplified pricing: basePrice × timesPerWeek × 4 weeks
        const basePrice = parseFloat(serviceType.basePrice);
        timesPerWeek = serviceType.timesPerWeek || 1;
        amount = basePrice * timesPerWeek * 4;
        serviceTypeName = serviceType.name;
        
        // Validate calculation
        if (!basePrice || basePrice <= 0 || isNaN(basePrice)) {
          results.errors.push(`Skipped ${customer.name}: Invalid base price in service type "${serviceType.name}"`);
          continue;
        }
        if (!timesPerWeek || timesPerWeek <= 0 || isNaN(timesPerWeek)) {
          results.errors.push(`Skipped ${customer.name}: Invalid times per week in service type "${serviceType.name}"`);
          continue;
        }
        if (isNaN(amount) || amount <= 0) {
          results.errors.push(`Skipped ${customer.name}: Calculated amount is invalid (basePrice: ${basePrice}, timesPerWeek: ${timesPerWeek})`);
          continue;
        }

        const dueDate = `${year}-${month.padStart(2, '0')}-15`;

        const invoice = await storage.createInvoice({
          customerId: customer.id,
          invoiceNumber: `${invoiceNumber}-${invoiceCounter++}`,
          amount: amount.toFixed(2),
          status: "unpaid",
          dueDate,
          description: `${serviceTypeName} (${timesPerWeek}x/week × 4 weeks) - ${month}/${year}`,
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
