import webPush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@sillydogpoopscoop.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  console.log('Web Push notifications configured successfully');
} else {
  console.warn('VAPID keys not configured - push notifications will not work');
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  actions?: Array<{ action: string; title: string }>;
}

export async function sendPushNotification(
  customerId: string,
  payload: PushPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('Push notifications not configured');
    return { success: false, sent: 0, failed: 0 };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.customerId, customerId));

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (error: any) {
      console.error(`Failed to send push notification:`, error.message);
      
      if (error.statusCode === 404 || error.statusCode === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, subscription.id));
        console.log(`Removed expired subscription for customer ${customerId}`);
      }
      failed++;
    }
  }

  return { success: sent > 0, sent, failed };
}

export async function saveSubscription(
  customerId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  const existingSubscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

  if (existingSubscriptions.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({
        customerId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      })
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
  } else {
    await db.insert(pushSubscriptions).values({
      customerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  }
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getCustomerSubscriptions(customerId: string) {
  return await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.customerId, customerId));
}
