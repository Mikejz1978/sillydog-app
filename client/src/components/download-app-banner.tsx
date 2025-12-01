import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DownloadAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedKey = "sillydog-install-dismissed";
    const dismissedTime = localStorage.getItem(dismissedKey);
    
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("User response to install prompt:", outcome);

    setDeferredPrompt(null);
    setCanInstall(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("sillydog-install-dismissed", Date.now().toString());
    setDismissed(true);
    setCanInstall(false);
  };

  if (!canInstall || dismissed) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-3 border-t bg-card/95 backdrop-blur-sm shadow-lg"
      data-testid="download-app-banner"
    >
      <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">Install SillyDog App</p>
            <p className="text-xs text-muted-foreground truncate">
              Quick access from your home screen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={handleInstallClick}
            size="sm"
            data-testid="button-install-app"
          >
            Install
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            data-testid="button-dismiss-install"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
