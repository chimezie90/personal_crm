import { cn } from "@/lib/utils";

interface EngagementBalanceProps {
  sent: number;
  received: number;
  className?: string;
}

export function EngagementBalance({
  sent,
  received,
  className,
}: EngagementBalanceProps) {
  const total = sent + received;

  if (total === 0) {
    return (
      <div className={cn("text-center py-4 text-warmGray-500 text-sm", className)}>
        No messages yet
      </div>
    );
  }

  const sentRatio = sent / total;
  const sentPercent = Math.round(sentRatio * 100);
  const receivedPercent = 100 - sentPercent;

  const balanceLabel =
    sentRatio > 0.6
      ? "You reach out more"
      : sentRatio < 0.4
        ? "They reach out more"
        : "Balanced conversation";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-warmGray-600">Conversation Balance</span>
        <span className="text-warmGray-500">{balanceLabel}</span>
      </div>

      <div className="h-4 flex border-2 border-warmGray-900 overflow-hidden">
        <div
          className="bg-sage-400 h-full transition-all"
          style={{ width: `${sentPercent}%` }}
          title={`You sent: ${sent.toLocaleString()} messages (${sentPercent}%)`}
        />
        <div
          className="bg-terracotta h-full transition-all"
          style={{ width: `${receivedPercent}%` }}
          title={`They sent: ${received.toLocaleString()} messages (${receivedPercent}%)`}
        />
      </div>

      <div className="flex justify-between text-xs text-warmGray-500">
        <span>You ({sent.toLocaleString()})</span>
        <span>Them ({received.toLocaleString()})</span>
      </div>
    </div>
  );
}
