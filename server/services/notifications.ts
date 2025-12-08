import { storage } from "../storage";
import type { BookingRequest, InsertNotification } from "@shared/schema";

const telnyxApiKey = process.env.TELNYX_API_KEY;
const ADMIN_PHONE = process.env.TELNYX_PHONE_NUMBER;

// Helper function to send SMS via Telnyx REST API
async function sendTelnyxSMS(from: string, to: string, text: string): Promise<{ id: string }> {
  if (!telnyxApiKey) {
    throw new Error("Telnyx API key not configured");
  }

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, text })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telnyx API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  return { id: result.data.id };
}

/**
 * Send a new booking request notification to admin via SMS and create in-app notification
 */
export async function notifyAdminOfNewBooking(booking: BookingRequest): Promise<{
  smsDelivered: boolean;
  notificationCreated: boolean;
  error?: string;
}> {
  const result = {
    smsDelivered: false,
    notificationCreated: false,
    error: undefined as string | undefined,
  };

  let notificationId: string | undefined;

  // Create in-app notification
  try {
    const notification: InsertNotification = {
      type: "booking_request",
      title: "New Booking Request",
      message: `${booking.name} requested service at ${booking.address}. ${booking.numberOfDogs} dog(s). ${booking.preferredServicePlan || 'No plan specified'}.`,
      bookingRequestId: booking.id,
      customerId: null,
      smsDelivered: false,
      readAt: null,
    };

    const createdNotification = await storage.createNotification(notification);
    notificationId = createdNotification.id;
    result.notificationCreated = true;
  } catch (error) {
    console.error("Failed to create in-app notification:", error);
    result.error = error instanceof Error ? error.message : "Unknown error creating notification";
  }

  // Send SMS if Telnyx is configured
  if (telnyxApiKey && ADMIN_PHONE) {
    try {
      const message = `NEW BOOKING REQUEST from ${booking.name}\n\n` +
                     `Address: ${booking.address}\n` +
                     `Dogs: ${booking.numberOfDogs}\n` +
                     `Service: ${booking.preferredServicePlan || 'Not specified'}\n` +
                     `Phone: ${booking.phone}\n\n` +
                     `View in admin dashboard to schedule.`;

      await sendTelnyxSMS(ADMIN_PHONE, ADMIN_PHONE, message);

      result.smsDelivered = true;

      // Update notification to mark SMS as delivered (not creating a duplicate)
      if (notificationId) {
        try {
          await storage.updateNotificationSMSStatus(notificationId, true);
        } catch (error) {
          console.warn("Failed to update notification SMS status:", error);
        }
      }
    } catch (error) {
      console.error("Failed to send SMS notification:", error);
      if (!result.error) {
        result.error = error instanceof Error ? error.message : "Unknown error sending SMS";
      }
    }
  } else {
    console.log("Telnyx not configured, skipping SMS notification");
  }

  return result;
}

/**
 * Send a general notification to admin
 */
export async function sendAdminNotification(
  title: string,
  message: string,
  type: string = "system",
  sendSMS: boolean = false
): Promise<void> {
  // Create in-app notification
  await storage.createNotification({
    type,
    title,
    message,
    bookingRequestId: null,
    customerId: null,
    smsDelivered: sendSMS && !!telnyxApiKey,
    readAt: null,
  });

  // Optionally send SMS
  if (sendSMS && telnyxApiKey && ADMIN_PHONE) {
    try {
      await sendTelnyxSMS(ADMIN_PHONE, ADMIN_PHONE, `${title}\n\n${message}`);
    } catch (error) {
      console.error("Failed to send admin SMS:", error);
    }
  }
}

/**
 * Send "On My Way" notification to a customer
 */
export async function sendOnMyWayNotification(customerId: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (!telnyxApiKey) {
    return { success: false, message: "Telnyx not configured" };
  }

  try {
    const customer = await storage.getCustomer(customerId);
    if (!customer) {
      return { success: false, message: "Customer not found" };
    }

    if (!customer.smsOptIn) {
      return { success: false, message: "Customer has not opted in for SMS" };
    }

    if (!customer.phone) {
      return { success: false, message: "Customer has no phone number" };
    }

    const smsMessage = `Hi ${customer.name}! SillyDog Pooper Scooper is on the way to your location. We'll be there shortly! 🐕`;

    await sendTelnyxSMS(process.env.TELNYX_PHONE_NUMBER!, customer.phone, smsMessage);

    return { success: true, message: `On My Way notification sent to ${customer.name}` };
  } catch (error: any) {
    console.error("Failed to send On My Way notification:", error);
    return { success: false, message: error.message || "Failed to send SMS" };
  }
}
