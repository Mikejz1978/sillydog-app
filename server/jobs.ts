import cron from "node-cron";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { generateMonthlyInvoices } from "./services/billing";
import { sendNightBeforeReminders } from "./services/reminders";
import { storage } from "./storage";

const TIMEZONE = "America/Chicago";

export function startScheduledJobs() {
  cron.schedule("0 0 1 * *", async () => {
    console.log("Running monthly billing job...");
    
    const nowUTC = new Date();
    const month = formatInTimeZone(nowUTC, TIMEZONE, "M");
    const year = formatInTimeZone(nowUTC, TIMEZONE, "yyyy");
    
    try {
      const results = await generateMonthlyInvoices(month, year);
      console.log("Monthly billing completed:", results);
    } catch (error) {
      console.error("Monthly billing job failed:", error);
    }
  }, {
    timezone: TIMEZONE
  });

  cron.schedule("0 18 * * *", async () => {
    console.log("Running night-before reminder job...");
    
    const nowUTC = new Date();
    const tomorrowUTC = addDays(nowUTC, 1);
    const serviceDate = formatInTimeZone(tomorrowUTC, TIMEZONE, "yyyy-MM-dd");
    
    console.log(`Sending reminders for service date: ${serviceDate} (America/Chicago timezone)`);
    
    try {
      const results = await sendNightBeforeReminders(serviceDate);
      console.log("Night-before reminders sent:", results);
    } catch (error) {
      console.error("Reminder job failed:", error);
    }
  }, {
    timezone: TIMEZONE
  });

  console.log("Scheduled jobs started:");
  console.log("- Monthly billing: 1st of month at midnight CST");
  console.log("- Night-before reminders: Daily at 6 PM CST");
}
