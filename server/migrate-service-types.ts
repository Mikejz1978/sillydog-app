import { storage } from "./storage";

/**
 * One-time migration to replace old dynamic-priced service types
 * with the correct 44 fixed-price HouseCall Pro service types
 */
export async function migrateServiceTypes() {
  console.log("🔄 Starting service type migration...");

  try {
    // Get all existing service types
    const existing = await storage.getAllServiceTypes();
    console.log(`Found ${existing.length} existing service types`);

    // Delete ALL existing service types to start fresh
    for (const serviceType of existing) {
      await storage.deleteServiceType(serviceType.id);
      console.log(`Deleted: ${serviceType.name}`);
    }
    console.log(`✅ Deleted ${existing.length} old service types`);

    // Create the 44 correct fixed-price service types matching HouseCall Pro
    const newServiceTypes = [
      // 1 Dog 1x Week
      { name: "1 Dog 1x Week", description: "Once weekly service for 1 dog", frequency: "weekly", timesPerWeek: 1, basePrice: "12.50", pricePerExtraDog: "0.00", category: "1 Dog", active: true },
      
      // 2 Dogs - 1x through 5x weekly
      { name: "2 Dogs 1x Week", description: "Once weekly service for 2 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "13.50", pricePerExtraDog: "0.00", category: "2 Dogs", active: true },
      { name: "2 Dogs 2x Week", description: "Twice weekly service for 2 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "12.25", pricePerExtraDog: "0.00", category: "2 Dogs", active: true },
      { name: "2 Dogs 3x Week", description: "3x weekly service for 2 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "11.15", pricePerExtraDog: "0.00", category: "2 Dogs", active: true },
      { name: "2 Dogs 4x Week", description: "4x weekly service for 2 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "10.38", pricePerExtraDog: "0.00", category: "2 Dogs", active: true },
      { name: "2 Dogs 5x Week", description: "5x weekly service for 2 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "10.00", pricePerExtraDog: "0.00", category: "2 Dogs", active: true },
      
      // 3 Dogs - 1x through 5x weekly
      { name: "3 Dogs 1x Week", description: "Once weekly service for 3 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "15.00", pricePerExtraDog: "0.00", category: "3 Dogs", active: true },
      { name: "3 Dogs 2x Week", description: "Twice weekly service for 3 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "12.38", pricePerExtraDog: "0.00", category: "3 Dogs", active: true },
      { name: "3 Dogs 3x Week", description: "3x weekly service for 3 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "10.42", pricePerExtraDog: "0.00", category: "3 Dogs", active: true },
      { name: "3 Dogs 4x Week", description: "4x weekly service for 3 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "10.69", pricePerExtraDog: "0.00", category: "3 Dogs", active: true },
      { name: "3 Dogs 5x Week", description: "5x weekly service for 3 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "10.25", pricePerExtraDog: "0.00", category: "3 Dogs", active: true },
      
      // 4 Dogs - 1x through 5x weekly
      { name: "4 Dogs 1x Week", description: "Once weekly service for 4 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "16.25", pricePerExtraDog: "0.00", category: "4 Dogs", active: true },
      { name: "4 Dogs 2x Week", description: "Twice weekly service for 4 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "14.50", pricePerExtraDog: "0.00", category: "4 Dogs", active: true },
      { name: "4 Dogs 3x Week", description: "3x weekly service for 4 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "12.50", pricePerExtraDog: "0.00", category: "4 Dogs", active: true },
      { name: "4 Dogs 4x Week", description: "4x weekly service for 4 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "11.50", pricePerExtraDog: "0.00", category: "4 Dogs", active: true },
      { name: "4 Dogs 5x Week", description: "5x weekly service for 4 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "10.50", pricePerExtraDog: "0.00", category: "4 Dogs", active: true },
      
      // 5 Dogs - 1x through 5x weekly
      { name: "5 Dogs 1x Week", description: "Once weekly service for 5 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "17.50", pricePerExtraDog: "0.00", category: "5 Dogs", active: true },
      { name: "5 Dogs 2x Week", description: "Twice weekly service for 5 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "16.43", pricePerExtraDog: "0.00", category: "5 Dogs", active: true },
      { name: "5 Dogs 3x Week", description: "3x weekly service for 5 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "15.25", pricePerExtraDog: "0.00", category: "5 Dogs", active: true },
      { name: "5 Dogs 4x Week", description: "4x weekly service for 4 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "14.31", pricePerExtraDog: "0.00", category: "5 Dogs", active: true },
      { name: "5 Dogs 5x Week", description: "5x weekly service for 5 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "13.75", pricePerExtraDog: "0.00", category: "5 Dogs", active: true },
      
      // 6 Dogs - 1x through 5x weekly
      { name: "6 Dogs 1x Week", description: "Once weekly service for 6 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "18.75", pricePerExtraDog: "0.00", category: "6 Dogs", active: true },
      { name: "6 Dogs 2x Week", description: "Twice weekly service for 6 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "18.25", pricePerExtraDog: "0.00", category: "6 Dogs", active: true },
      { name: "6 Dogs 3x Week", description: "3x weekly service for 6 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "17.00", pricePerExtraDog: "0.00", category: "6 Dogs", active: true },
      { name: "6 Dogs 4x Week", description: "4x weekly service for 6 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "15.88", pricePerExtraDog: "0.00", category: "6 Dogs", active: true },
      { name: "6 Dogs 5x Week", description: "5x weekly service for 6 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "15.25", pricePerExtraDog: "0.00", category: "6 Dogs", active: true },
      
      // 7 Dogs - 1x through 5x weekly
      { name: "7 Dogs 1x Week", description: "Once weekly service for 7 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "20.00", pricePerExtraDog: "0.00", category: "7 Dogs", active: true },
      { name: "7 Dogs 2x Week", description: "Twice weekly service for 7 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "19.25", pricePerExtraDog: "0.00", category: "7 Dogs", active: true },
      { name: "7 Dogs 3x Week", description: "3x weekly service for 7 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "18.50", pricePerExtraDog: "0.00", category: "7 Dogs", active: true },
      { name: "7 Dogs 4x Week", description: "4x weekly service for 7 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "17.25", pricePerExtraDog: "0.00", category: "7 Dogs", active: true },
      { name: "7 Dogs 5x Week", description: "5x weekly service for 7 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "16.75", pricePerExtraDog: "0.00", category: "7 Dogs", active: true },
      
      // 8 Dogs - 1x through 5x weekly
      { name: "8 Dogs 1x Week", description: "Once weekly service for 8 dogs", frequency: "weekly", timesPerWeek: 1, basePrice: "22.50", pricePerExtraDog: "0.00", category: "8 Dogs", active: true },
      { name: "8 Dogs 2x Week", description: "Twice weekly service for 8 dogs", frequency: "weekly", timesPerWeek: 2, basePrice: "21.50", pricePerExtraDog: "0.00", category: "8 Dogs", active: true },
      { name: "8 Dogs 3x Week", description: "3x weekly service for 8 dogs", frequency: "weekly", timesPerWeek: 3, basePrice: "20.00", pricePerExtraDog: "0.00", category: "8 Dogs", active: true },
      { name: "8 Dogs 4x Week", description: "4x weekly service for 8 dogs", frequency: "weekly", timesPerWeek: 4, basePrice: "18.75", pricePerExtraDog: "0.00", category: "8 Dogs", active: true },
      { name: "8 Dogs 5x Week", description: "5x weekly service for 8 dogs", frequency: "weekly", timesPerWeek: 5, basePrice: "18.00", pricePerExtraDog: "0.00", category: "8 Dogs", active: true },
      
      // Biweekly - 1 through 8 dogs
      { name: "Biweekly 1 Dog", description: "Biweekly service for 1 dog", frequency: "biweekly", timesPerWeek: 1, basePrice: "20.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 2 Dogs", description: "Biweekly service for 2 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "25.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 3 Dogs", description: "Biweekly service for 3 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "30.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 4 Dogs", description: "Biweekly service for 4 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "40.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 5 Dogs", description: "Biweekly service for 5 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "50.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 6 Dogs", description: "Biweekly service for 6 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "55.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 7 Dogs", description: "Biweekly service for 7 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "60.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
      { name: "Biweekly 8 Dogs", description: "Biweekly service for 8 dogs", frequency: "biweekly", timesPerWeek: 1, basePrice: "65.00", pricePerExtraDog: "0.00", category: "Biweekly", active: true },
    ];

    // Create all 44 new service types
    let created = 0;
    for (const serviceType of newServiceTypes) {
      await storage.createServiceType(serviceType);
      created++;
      console.log(`Created ${created}/44: ${serviceType.name} - $${serviceType.basePrice}/visit`);
    }

    console.log(`✅ Migration complete! Created ${created} fixed-price service types`);
    console.log("🎉 All service types now match HouseCall Pro pricing");
  } catch (error) {
    console.error("❌ Error during service type migration:", error);
    throw error;
  }
}
