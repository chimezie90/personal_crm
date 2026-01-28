"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { syncDataSource } from "@/actions/sync.actions";

interface DataSource {
  id: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
}

const DATA_SOURCES: DataSource[] = [
  {
    id: "imessage",
    name: "iMessage",
    description:
      "Import messages from your Mac's Messages app. Requires Full Disk Access permission.",
    icon: "💬",
    available: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description:
      "Import from WhatsApp chat export ZIP files. Export chats from the app first.",
    icon: "📱",
    available: false,
  },
  {
    id: "facebook",
    name: "Facebook Messenger",
    description:
      "Import from Facebook data export. Download your data from Facebook settings.",
    icon: "👤",
    available: false,
  },
  {
    id: "email",
    name: "Email (Gmail)",
    description:
      "Connect your Gmail account via OAuth. Imports emails as messages.",
    icon: "✉️",
    available: false,
  },
  {
    id: "phone",
    name: "Phone Calls",
    description:
      "Import call history from iPhone backup. Requires an iTunes backup.",
    icon: "📞",
    available: false,
  },
];

function DataSourceCard({
  source,
  onSync,
}: {
  source: DataSource;
  onSync: () => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      await onSync();
      setResult({ success: true, message: "Sync completed successfully!" });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="text-3xl">{source.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-warmGray-900">
              {source.name}
            </h3>
            {!source.available && (
              <span className="px-2 py-0.5 text-xs bg-warmGray-200 text-warmGray-600">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-sm text-warmGray-600 mt-1">{source.description}</p>

          {result && (
            <div
              className={`mt-3 p-2 text-sm ${
                result.success
                  ? "bg-sage-50 text-sage-700 border border-sage-200"
                  : "bg-terracotta-50 text-terracotta-700 border border-terracotta-200"
              }`}
            >
              {result.message}
            </div>
          )}
        </div>

        <Button
          variant={source.available ? "primary" : "secondary"}
          disabled={!source.available || syncing}
          onClick={handleSync}
        >
          {syncing ? "Syncing..." : "Sync"}
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const handleSync = async (sourceId: string) => {
    const result = await syncDataSource(sourceId);
    if (!result.success) {
      throw new Error(result.error || "Sync failed");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-warmGray-900">
          Settings
        </h1>
        <p className="text-warmGray-600 mt-1">
          Connect data sources and configure your Personal CRM.
        </p>
      </div>

      {/* Data Sources */}
      <section>
        <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
          Data Sources
        </h2>
        <div className="space-y-4">
          {DATA_SOURCES.map((source) => (
            <DataSourceCard
              key={source.id}
              source={source}
              onSync={() => handleSync(source.id)}
            />
          ))}
        </div>
      </section>

      {/* Permissions Notice */}
      <section>
        <Card className="bg-warmGray-50 border-warmGray-200">
          <h3 className="font-display font-bold text-warmGray-900 mb-2">
            About Permissions
          </h3>
          <p className="text-sm text-warmGray-600">
            To access iMessage data, this app needs{" "}
            <strong>Full Disk Access</strong> on macOS. Go to System Preferences
            → Security & Privacy → Privacy → Full Disk Access, and add this
            application.
          </p>
          <p className="text-sm text-warmGray-600 mt-2">
            All data is stored locally on your computer. No data is sent to any
            servers.
          </p>
        </Card>
      </section>

      {/* Privacy */}
      <section>
        <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
          Privacy & Data
        </h2>
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-medium text-warmGray-900">
                  Export All Data
                </h3>
                <p className="text-sm text-warmGray-600">
                  Download all your contacts and messages as a JSON file.
                </p>
              </div>
              <Button variant="secondary" disabled>
                Export
              </Button>
            </div>
            <hr className="border-warmGray-200" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-medium text-warmGray-900">
                  Delete All Data
                </h3>
                <p className="text-sm text-warmGray-600">
                  Permanently delete all contacts, messages, and settings.
                </p>
              </div>
              <Button variant="ghost" className="text-red-600" disabled>
                Delete
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
