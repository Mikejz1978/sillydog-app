import { storage } from "./storage";

export async function seedServiceTypes() {
  console.log("Seeding service types...");

  const serviceTypes = [
    {
      name: "Weekly Service",
      description: "Keep it spotless with a weekly visit",
      frequency: "weekly",
      timesPerWeek: 1,
      basePrice: "12.50",
      pricePerExtraDog: "1.50",
      active: true,
    },
    {
      name: "Biweekly Service",
      description: "Budget-friendly and tidy",
      frequency: "biweekly",
      timesPerWeek: 1,
      basePrice: "20.00",
      pricePerExtraDog: "5.00",
      active: true,
    },
    {
      name: "2x Weekly",
      description: "Twice weekly service for busy yards",
      frequency: "weekly",
      timesPerWeek: 2,
      basePrice: "25.00",
      pricePerExtraDog: "3.00",
      active: true,
    },
    {
      name: "3x Weekly",
      description: "Three times weekly service for high-traffic areas",
      frequency: "weekly",
      timesPerWeek: 3,
      basePrice: "35.00",
      pricePerExtraDog: "4.00",
      active: true,
    },
    {
      name: "4x Weekly",
      description: "Four times weekly service for maximum cleanliness",
      frequency: "weekly",
      timesPerWeek: 4,
      basePrice: "45.00",
      pricePerExtraDog: "5.00",
      active: true,
    },
  ];

  try {
    const existing = await storage.getAllServiceTypes();
    
    if (existing.length > 0) {
      console.log(`Service types already seeded (${existing.length} found)`);
      return;
    }

    for (const serviceType of serviceTypes) {
      await storage.createServiceType(serviceType);
      console.log(`Created service type: ${serviceType.name}`);
    }

    console.log("Service types seeded successfully!");
  } catch (error) {
    console.error("Error seeding service types:", error);
  }
}
