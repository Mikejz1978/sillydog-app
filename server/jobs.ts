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

  // Generate routes from recurring schedules daily
  cron.schedule("0 0 * * *", async () => {
    console.log("Running automatic route generation job...");
    
    try {
      const allRules = await storage.getAllScheduleRules();
      const activeRules = allRules.filter(rule => !rule.paused);
      
      let totalRoutesGenerated = 0;
      
      // Generate routes for the next 7 days for each active schedule
      for (const rule of activeRules) {
        const startDate = new Date(rule.dtStart);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const generateFrom = startDate > today ? startDate : today;
        
        // Generate routes for the next 7 days
        for (let i = 0; i < 7; i++) {
          const targetDate = new Date(generateFrom);
          targetDate.setDate(generateFrom.getDate() + i);
          
          const dayOfWeek = targetDate.getDay();
          const targetDateStr = targetDate.toISOString().split("T")[0];
          
          if (!rule.byDay || !rule.byDay.includes(dayOfWeek)) {
            continue;
          }
          
          const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let shouldGenerate = false;
          if (rule.frequency === "weekly") {
            shouldGenerate = daysDiff >= 0;
          } else if (rule.frequency === "biweekly") {
            shouldGenerate = daysDiff >= 0 && Math.floor(daysDiff / 7) % 2 === 0;
          }
          
          if (shouldGenerate) {
            const existingRoutes = await storage.getRoutesByDate(targetDateStr);
            const alreadyExists = existingRoutes.some(r => r.customerId === rule.customerId);
            
            if (!alreadyExists) {
              await storage.createRoute({
                date: targetDateStr,
                customerId: rule.customerId,
                scheduledTime: rule.windowStart,
                status: "scheduled",
                orderIndex: 0,
              });
              totalRoutesGenerated++;
            }
          }
        }
      }
      
      console.log(`Auto-generated ${totalRoutesGenerated} routes for the next 7 days`);
    } catch (error) {
      console.error("Automatic route generation job failed:", error);
    }
  }, {
    timezone: TIMEZONE
  });

  console.log("Scheduled jobs started:");
  console.log("- Monthly billing: 1st of month at midnight CST");
  console.log("- Night-before reminders: Daily at 6 PM CST");
  console.log("- Automatic route generation: Daily at midnight CST");
}
