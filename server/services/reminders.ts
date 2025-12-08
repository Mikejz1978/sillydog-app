import { storage } from "../storage";
import Telnyx from "telnyx";

const telnyxClient = process.env.TELNYX_API_KEY
  ? new Telnyx(process.env.TELNYX_API_KEY)
  : null;

export async function sendNightBeforeReminders(serviceDate: string): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  if (!telnyxClient) {
    results.errors.push("Telnyx not configured");
    return results;
  }

  try {
    const existingLogs = await storage.getReminderLogsByDate(serviceDate);
    const alreadySentCustomerIds = new Set(existingLogs.map(log => log.customerId));

    const routes = await storage.getRoutesByDate(serviceDate);
    const allCustomers = await storage.getAllCustomers();

    for (const route of routes) {
      if (alreadySentCustomerIds.has(route.customerId)) {
        results.skipped++;
        continue;
      }

      const customer = allCustomers.find(c => c.id === route.customerId);
      if (!customer || !customer.smsOptIn) {
        results.skipped++;
        continue;
      }

      try {
        const message = await telnyxClient.messages.create({
          from: process.env.TELNYX_PHONE_NUMBER,
          to: customer.phone,
          text: `Hi ${customer.name}! This is a reminder that SillyDog will be servicing your yard tomorrow (${serviceDate}). Thank you for choosing us!`,
        });

        await storage.createReminderLog({
          customerId: customer.id,
          serviceDate,
          twilioSid: message.data.id,
          status: "sent",
        });

        results.sent++;
      } catch (error: any) {
        await storage.createReminderLog({
          customerId: customer.id,
          serviceDate,
          status: "failed",
          errorMessage: error.message,
        });

        results.failed++;
        results.errors.push(`Failed to send reminder to ${customer.name}: ${error.message}`);
      }
    }

    return results;
  } catch (error: any) {
    results.errors.push(`Reminder job failed: ${error.message}`);
    return results;
  }
}
