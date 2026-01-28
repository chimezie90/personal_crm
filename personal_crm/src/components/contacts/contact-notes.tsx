"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContactNotesProps {
  contactId: string;
  initialNotes: string | null;
  onSave?: (notes: string) => Promise<void>;
}

export function ContactNotes({
  contactId,
  initialNotes,
  onSave,
}: ContactNotesProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(notes);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(initialNotes || "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="bg-warmGray-50 border-2 border-warmGray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-medium text-warmGray-900">Notes</h3>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        </div>
        {notes ? (
          <p className="text-sm text-warmGray-700 whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-sm text-warmGray-400 italic">
            No notes yet. Click edit to add notes about this contact.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-warmGray-50 border-2 border-warmGray-200 p-4">
      <h3 className="font-display font-medium text-warmGray-900 mb-2">Notes</h3>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this contact..."
        rows={4}
        className="mb-3"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
