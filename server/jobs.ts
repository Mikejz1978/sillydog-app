import cron from "node-cron";
import { generateMonthlyInvoices } from "./services/billing";
import { sendNightBeforeReminders } from "./services/reminders";
import { storage } from "./storage";

export function startScheduledJobs() {
  cron.schedule("0 0 1 * *", async () => {
    console.log("Running monthly billing job...");
    const now = new Date();
    const month = (now.getMonth() + 1).toString();
    const year = now.getFullYear().toString();
    
    try {
      const results = await generateMonthlyInvoices(month, year);
      console.log("Monthly billing completed:", results);
    } catch (error) {
      console.error("Monthly billing job failed:", error);
    }
  }, {
    timezone: "America/Chicago"
  });

  cron.schedule("0 18 * * *", async () => {
    console.log("Running night-before reminder job...");
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const serviceDate = tomorrow.toISOString().split("T")[0];
    
    try {
      const results = await sendNightBeforeReminders(serviceDate);
      console.log("Night-before reminders sent:", results);
    } catch (error) {
      console.error("Reminder job failed:", error);
    }
  }, {
    timezone: "America/Chicago"
  });

  console.log("Scheduled jobs started:");
  console.log("- Monthly billing: 1st of month at midnight CST");
  console.log("- Night-before reminders: Daily at 6 PM CST");
}
