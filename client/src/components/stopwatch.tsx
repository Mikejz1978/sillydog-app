import { useState, useEffect } from "react";
import { Timer, Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface StopwatchProps {
  startTime: string | null;
  onStart: () => void;
  onStop: () => void;
  isStarted: boolean;
  isStopped: boolean;
  showCost?: boolean;
  calculatedCost?: string;
}

export function Stopwatch({ startTime, onStart, onStop, isStarted, isStopped, showCost, calculatedCost }: StopwatchProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isStarted || isStopped) {
      return;
    }

    const interval = setInterval(() => {
      if (startTime) {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000);
        setElapsedSeconds(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isStarted, isStopped]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getEstimatedCost = () => {
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes <= 15) return "Regular price";
    const hours = minutes / 60;
    const cost = hours * 100;
    return `$${cost.toFixed(2)}`;
  };

  if (!isStarted) {
    return (
      <Button
        size="sm"
        onClick={onStart}
        className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
        data-testid="button-start-timer"
      >
        <Play className="w-3 h-3 mr-1" />
        Start Timer
      </Button>
    );
  }

  if (isStopped) {
    return (
      <Card className="p-3 bg-muted">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-green-600" />
            <div>
              <div className="text-sm font-semibold">Service Complete</div>
              {showCost && calculatedCost && (
                <div className="text-xs text-muted-foreground">
                  Cost: ${parseFloat(calculatedCost).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-blue-600 animate-pulse" />
          <div>
            <div className="text-lg font-mono font-bold">{formatTime(elapsedSeconds)}</div>
            {showCost && (
              <div className="text-xs text-muted-foreground">
                Est: {getEstimatedCost()}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={onStop}
          data-testid="button-stop-timer"
        >
          <Square className="w-3 h-3 mr-1" />
          Stop
        </Button>
      </div>
    </Card>
  );
}
