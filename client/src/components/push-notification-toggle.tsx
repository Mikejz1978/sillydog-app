import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface PushNotificationToggleProps {
  userId?: string;
  customerId?: string;
  variant?: 'switch' | 'button' | 'compact';
}

export function PushNotificationToggle({
  userId,
  customerId,
  variant = 'switch',
}: PushNotificationToggleProps) {
  const { toast } = useToast();
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe,
    error,
  } = usePushNotifications({ userId, customerId });

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast({
          title: 'Notifications disabled',
          description: 'You will no longer receive push notifications.',
        });
      } else {
        toast({
          title: 'Error',
          description: error || 'Failed to disable notifications',
          variant: 'destructive',
        });
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast({
          title: 'Notifications enabled',
          description: 'You will now receive push notifications.',
        });
      } else {
        toast({
          title: 'Error',
          description: error || 'Failed to enable notifications',
          variant: 'destructive',
        });
      }
    }
  };

  if (variant === 'button') {
    return (
      <Button
        variant={isSubscribed ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggle}
        disabled={isLoading}
        data-testid="button-push-notifications"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : isSubscribed ? (
          <BellRing className="h-4 w-4 mr-2" />
        ) : (
          <Bell className="h-4 w-4 mr-2" />
        )}
        {isSubscribed ? 'Notifications On' : 'Enable Notifications'}
      </Button>
    );
  }

  if (variant === 'compact') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        disabled={isLoading}
        title={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
        data-testid="button-push-notifications-compact"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3" data-testid="push-notification-toggle">
      <Switch
        id="push-notifications"
        checked={isSubscribed}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        data-testid="switch-push-notifications"
      />
      <Label
        htmlFor="push-notifications"
        className="flex items-center gap-2 cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span>Push Notifications</span>
      </Label>
      {permission === 'denied' && (
        <span className="text-xs text-muted-foreground">
          (Blocked in browser)
        </span>
      )}
    </div>
  );
}
