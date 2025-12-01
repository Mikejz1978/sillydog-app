import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

export interface Coordinates {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn("GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  try {
    const response = await client.geocode({
      params: {
        address: address,
        key: apiKey,
      },
    });

    if (response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371;
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

export interface NearbyCustomer {
  lat: number;
  lng: number;
  distanceMiles: number;
  dayOfWeek: number;
}

export interface DayDistance {
  dayOfWeek: number;
  dayName: string;
  averageDistance: number;
  nearbyCount: number;
  nearbyCustomers: NearbyCustomer[];
}

const NEARBY_RADIUS_MILES = 5;

export async function findBestFitDay(
  newCustomerCoords: Coordinates,
  existingCustomersWithSchedules: Array<{
    lat: string | null;
    lng: string | null;
    dayOfWeek: number;
  }>
): Promise<DayDistance[]> {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  const nearbyByDay: Record<number, NearbyCustomer[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  for (const customer of existingCustomersWithSchedules) {
    if (customer.lat && customer.lng) {
      const customerCoords: Coordinates = {
        lat: parseFloat(customer.lat),
        lng: parseFloat(customer.lng),
      };
      
      const distanceKm = calculateDistance(newCustomerCoords, customerCoords);
      const distanceMiles = kmToMiles(distanceKm);
      
      if (distanceMiles <= NEARBY_RADIUS_MILES) {
        nearbyByDay[customer.dayOfWeek].push({
          lat: customerCoords.lat,
          lng: customerCoords.lng,
          distanceMiles: Math.round(distanceMiles * 10) / 10,
          dayOfWeek: customer.dayOfWeek,
        });
      }
    }
  }

  const results: DayDistance[] = [];
  
  for (let day = 0; day < 7; day++) {
    const nearby = nearbyByDay[day];
    const avgDistance = nearby.length > 0
      ? nearby.reduce((sum, c) => sum + c.distanceMiles, 0) / nearby.length
      : 999;
    
    results.push({
      dayOfWeek: day,
      dayName: dayNames[day],
      averageDistance: avgDistance,
      nearbyCount: nearby.length,
      nearbyCustomers: nearby,
    });
  }

  return results.sort((a, b) => {
    if (a.nearbyCount === 0 && b.nearbyCount === 0) return 0;
    if (a.nearbyCount === 0) return 1;
    if (b.nearbyCount === 0) return -1;
    return b.nearbyCount - a.nearbyCount || a.averageDistance - b.averageDistance;
  });
}
