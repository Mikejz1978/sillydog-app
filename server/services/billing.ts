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
        const serviceType = serviceTypes.find(st => st.id === customer.serviceTypeId);
        if (!serviceType) {
          results.errors.push(`Skipped ${customer.name}: No service type configured`);
          continue;
        }
        
        // Validate service type pricing
        const basePrice = parseFloat(serviceType.basePrice);
        const pricePerExtraDog = parseFloat(serviceType.pricePerExtraDog || "0");
        if (!basePrice || basePrice <= 0 || isNaN(basePrice)) {
          results.errors.push(`Skipped ${customer.name}: Invalid base price in service type "${serviceType.name}"`);
          continue;
        }
        
        // Get completed routes for this customer in the billing period
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        
        const allRoutes = await storage.getRoutesByCustomerAndDateRange(
          customer.id,
          startDate,
          endDate
        );
        
        // Filter to only billable completed routes
        const completedRoutes = allRoutes.filter(
          (route) => route.status === "completed" && route.billable
        );
        
        if (completedRoutes.length === 0) {
          results.errors.push(`Skipped ${customer.name}: No completed routes in ${month}/${year}`);
          continue;
        }
        
        // Calculate price per visit: basePrice + (numberOfDogs - 1) × pricePerExtraDog
        const numberOfDogs = customer.numberOfDogs || 1;
        const pricePerVisit = basePrice + Math.max(0, numberOfDogs - 1) * pricePerExtraDog;
        
        // Total amount = price per visit × number of completed visits
        const amount = pricePerVisit * completedRoutes.length;
        const serviceTypeName = serviceType.name;
        
        if (isNaN(amount) || amount <= 0) {
          results.errors.push(`Skipped ${customer.name}: Calculated amount is invalid`);
          continue;
        }

        const dueDate = `${year}-${month.padStart(2, '0')}-15`;

        const invoice = await storage.createInvoice({
          customerId: customer.id,
          invoiceNumber: `${invoiceNumber}-${invoiceCounter++}`,
          amount: amount.toFixed(2),
          status: "unpaid",
          dueDate,
          description: `${serviceTypeName} - ${completedRoutes.length} visits × $${pricePerVisit.toFixed(2)} (${numberOfDogs} dog${numberOfDogs > 1 ? 's' : ''}) - ${month}/${year}`,
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
