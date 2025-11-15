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
        
        if (customer.serviceTypeId) {
          const serviceType = serviceTypes.find(st => st.id === customer.serviceTypeId);
          if (serviceType) {
            // Get the per-visit price
            const basePrice = parseFloat(serviceType.basePrice);
            const pricePerExtraDog = parseFloat(serviceType.pricePerExtraDog);
            timesPerWeek = serviceType.timesPerWeek || 1;
            
            // Calculate per-visit cost: basePrice + (pricePerExtraDog * numberOfDogs)
            const perVisitCost = basePrice + (pricePerExtraDog * customer.numberOfDogs);
            
            // Calculate monthly amount: perVisitCost * timesPerWeek * 4 weeks
            // Assuming ~4 weeks per month for consistent billing
            amount = perVisitCost * timesPerWeek * 4;
            serviceTypeName = serviceType.name;
          }
        }
        
        // Skip if no service type or zero amount
        if (amount === 0) {
          results.errors.push(`Skipped ${customer.name}: No service type configured`);
          continue;
        }

        const dueDate = `${year}-${month.padStart(2, '0')}-15`;

        const invoice = await storage.createInvoice({
          customerId: customer.id,
          invoiceNumber: `${invoiceNumber}-${invoiceCounter++}`,
          amount: amount.toFixed(2),
          status: "unpaid",
          dueDate,
          description: `${serviceTypeName} (${timesPerWeek}x/week × 4 weeks) - ${customer.numberOfDogs} dog${customer.numberOfDogs > 1 ? 's' : ''} - ${month}/${year}`,
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
