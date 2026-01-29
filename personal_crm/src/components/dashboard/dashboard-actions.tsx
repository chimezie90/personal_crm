"use client";

import { useState } from "react";
import {
  syncDataSource,
  syncContactNames,
  updateRelationshipScores,
} from "@/actions/sync.actions";

export function DashboardActions() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFullSync() {
    setIsSyncing(true);
    setStatus("Syncing messages...");

    try {
      // 1. Sync iMessage data
      const syncResult = await syncDataSource("imessage");
      if (!syncResult.success) {
        setStatus(`Sync failed: ${syncResult.error}`);
        return;
      }

      setStatus(
        `Imported ${syncResult.contactsImported} contacts, ${syncResult.messagesImported} messages. Matching names...`
      );

      // 2. Sync contact names from macOS Contacts
      const namesResult = await syncContactNames();
      if (namesResult.success) {
        setStatus(`Updated ${namesResult.updated} contact names. Calculating scores...`);
      }

      // 3. Update relationship scores
      const scoresResult = await updateRelationshipScores();
      if (scoresResult.success) {
        setStatus(
          `Done! Updated ${scoresResult.updated} relationship scores.`
        );
      }

      // Clear status after 5 seconds
      setTimeout(() => setStatus(null), 5000);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {status && (
        <span className="text-sm text-warmGray-600">{status}</span>
      )}
      <button
        onClick={handleFullSync}
        disabled={isSyncing}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSyncing ? "Syncing..." : "Sync Now"}
      </button>
    </div>
  );
}
