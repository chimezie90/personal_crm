"use client";

import { Message, getSourceIcon } from "@/schemas/message.schema";
import { formatRelativeTime, cn } from "@/lib/utils";

interface ContactTimelineProps {
  messages: Message[];
}

function MessageItem({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";

  return (
    <div
      className={cn(
        "flex gap-3",
        isOutbound ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Source icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full bg-warmGray-100 border border-warmGray-200
                      flex items-center justify-center text-sm"
        title={message.source}
      >
        {getSourceIcon(message.source)}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[70%] px-4 py-2 border-2 border-warmGray-900",
          isOutbound ? "bg-terracotta-50" : "bg-cream"
        )}
      >
        {message.type === "call" ? (
          <p className="text-sm text-warmGray-700">
            📞 {isOutbound ? "Outgoing" : "Incoming"} call
            {message.durationSeconds && (
              <span className="text-warmGray-500">
                {" "}
                • {Math.floor(message.durationSeconds / 60)}:
                {String(message.durationSeconds % 60).padStart(2, "0")}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-warmGray-900 whitespace-pre-wrap">
            {message.content || "(No content)"}
          </p>
        )}

        {/* Timestamp and sentiment */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-warmGray-500">
            {formatRelativeTime(message.timestamp)}
          </span>
          {message.sentimentLabel && (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5",
                message.sentimentLabel === "positive" &&
                  "bg-sage-100 text-sage-700",
                message.sentimentLabel === "negative" &&
                  "bg-terracotta-100 text-terracotta-700",
                message.sentimentLabel === "neutral" &&
                  "bg-warmGray-100 text-warmGray-600"
              )}
            >
              {message.sentimentLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-warmGray-500">
      <div className="text-4xl mb-4">💬</div>
      <p className="font-display">No messages yet</p>
      <p className="text-sm mt-1">
        Messages will appear here once synced from data sources.
      </p>
    </div>
  );
}

export function ContactTimeline({ messages }: ContactTimelineProps) {
  if (messages.length === 0) {
    return <EmptyState />;
  }

  // Group messages by date
  const groupedMessages: Record<string, Message[]> = {};
  for (const message of messages) {
    const dateKey = message.timestamp.toLocaleDateString();
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(message);
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1 bg-warmGray-200" />
            <span className="text-xs text-warmGray-500 font-display uppercase tracking-wide">
              {date}
            </span>
            <div className="h-px flex-1 bg-warmGray-200" />
          </div>

          {/* Messages for this date */}
          <div className="space-y-4">
            {msgs.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
