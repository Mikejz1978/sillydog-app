import { storage } from "../storage";
import twilio from "twilio";

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
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

  if (!twilioClient) {
    results.errors.push("Twilio not configured");
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
        const message = await twilioClient.messages.create({
          body: `Hi ${customer.name}! This is a reminder that SillyDog will be servicing your yard tomorrow. We'll text you when we're on the way. Thank you for choosing us!`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customer.phone,
        });

        await storage.createReminderLog({
          customerId: customer.id,
          serviceDate,
          twilioSid: message.sid,
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
