import webpush from 'web-push';
import type { PushSubscription as PushSubscriptionType } from '@shared/schema';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@sillydogpoopscoop.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('Web Push initialized successfully');
} else {
  console.log('Web Push not configured - missing VAPID keys');
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

// Send push notification to subscriptions
export async function sendPushNotification(
  subscriptions: PushSubscriptionType[],
  payload: PushPayload,
  onExpired?: (endpoint: string) => Promise<void>
): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('Push notifications not configured - skipping');
    return 0;
  }

  if (subscriptions.length === 0) {
    return 0;
  }

  const pushPayload = JSON.stringify({
    ...payload,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-72x72.png',
  });

  let successCount = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        pushPayload
      );
      successCount++;
    } catch (error: any) {
      // If subscription is expired or invalid, call cleanup callback
      if (error.statusCode === 404 || error.statusCode === 410) {
        if (onExpired) {
          await onExpired(sub.endpoint);
        }
        console.log(`Removed expired subscription: ${sub.endpoint}`);
      } else {
        console.error(`Push notification error: ${error.message}`);
      }
    }
  }

  return successCount;
}

// Notification types for common service events
export const PushNotifications = {
  // Notify customer that technician is on the way
  onMyWay: (customerName: string): PushPayload => ({
    title: 'SillyDog is On The Way!',
    body: `Hi ${customerName}! Your technician is heading to your location now.`,
    url: '/portal',
    tag: 'on-my-way',
    requireInteraction: false,
    actions: [
      { action: 'view', title: 'View Details' }
    ]
  }),

  // Notify customer that service is complete
  serviceComplete: (customerName: string): PushPayload => ({
    title: 'Service Complete!',
    body: `Hi ${customerName}! Your yard has been cleaned. Thank you for choosing SillyDog!`,
    url: '/portal',
    tag: 'service-complete',
    requireInteraction: false,
    actions: [
      { action: 'review', title: 'Leave Review' }
    ]
  }),

  // Reminder for upcoming service
  serviceReminder: (customerName: string, date: string): PushPayload => ({
    title: 'Service Tomorrow',
    body: `Hi ${customerName}! Just a reminder that your SillyDog service is scheduled for tomorrow.`,
    url: '/portal',
    tag: 'service-reminder',
    requireInteraction: false,
  }),

  // Invoice ready notification
  invoiceReady: (customerName: string, amount: string): PushPayload => ({
    title: 'Invoice Ready',
    body: `Hi ${customerName}! Your invoice for $${amount} is ready. View it in your portal.`,
    url: '/portal',
    tag: 'invoice-ready',
    requireInteraction: true,
    actions: [
      { action: 'pay', title: 'Pay Now' },
      { action: 'view', title: 'View Invoice' }
    ]
  }),

  // Payment received
  paymentReceived: (customerName: string, amount: string): PushPayload => ({
    title: 'Payment Received',
    body: `Hi ${customerName}! Thank you for your payment of $${amount}.`,
    url: '/portal',
    tag: 'payment-received',
    requireInteraction: false,
  }),

  // New booking notification for admin
  newBookingRequest: (customerName: string): PushPayload => ({
    title: 'New Booking Request',
    body: `${customerName} has submitted a new service request.`,
    url: '/booking-requests',
    tag: 'new-booking',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Request' }
    ]
  }),
};

// Get VAPID public key for frontend
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}
