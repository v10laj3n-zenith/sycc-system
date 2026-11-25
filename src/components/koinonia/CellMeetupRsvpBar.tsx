"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rsvpCellMeetupAction } from "@/actions/koinonia";
import { Button } from "@/components/ui/button";
import type { RsvpStatus } from "@/types/database.types";

const OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Can't Go" },
];

export function CellMeetupRsvpBar({
  meetupId,
  initialStatus,
}: {
  meetupId: string;
  initialStatus: RsvpStatus | null;
}) {
  const [status, setStatus] = useState<RsvpStatus | null>(initialStatus);
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: RsvpStatus) {
    setStatus(next);
    startTransition(async () => {
      const res = await rsvpCellMeetupAction({ id: meetupId, status: next });
      if (!res.success) {
        toast.error(res.error ?? "Could not save RSVP.");
      } else {
        toast.success(`RSVP updated: ${next.replace("_", " ")}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={status === opt.value ? "default" : "outline"}
          disabled={isPending}
          onClick={() => handleSelect(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
