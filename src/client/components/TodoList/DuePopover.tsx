import { CalendarDaysIcon, CalendarXIcon, ChevronLeftIcon } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { dateOf, type Day, dayOf, snoozeTo, SNOOZES } from "../../todos.ts";

interface DuePopoverProps {
  due: Day | undefined;
  today: Day;
  /**
   * Moving a due date that's set (Tomorrow, Next week, Next weekend, a date, or none), rather than
   * setting one (which can also be Today).
   */
  snooze: boolean;
  onChange: (due: Day | null) => void;
  /** The button that opens it, and what's in it. */
  trigger: ReactElement;
  children: ReactNode;
}

const shortDate = (day: Day) =>
  dateOf(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Sets or snoozes a to-do's due date: quick choices first, and a calendar for any other day. */
export function DuePopover({ due, today, snooze, onChange, trigger, children }: DuePopoverProps) {
  const [isOpen, setOpen] = useState(false);
  const [isPickingDate, setPickingDate] = useState(false);
  const choose = (day: Day | null) => {
    onChange(day);
    setOpen(false);
  };
  const choices = SNOOZES.filter(({ id }) => !(snooze && id === "today"))
    .map(({ id, label }) => ({ id, label, day: snoozeTo(id, today) }))
    // Already there.
    .filter(({ day }) => day !== due);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setOpen(open);
        if (open) setPickingDate(false);
      }}
    >
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-56">
        {isPickingDate ? (
          <>
            <Button variant="ghost" className="justify-start" onClick={() => setPickingDate(false)}>
              <ChevronLeftIcon data-icon="inline-start" />
              {snooze ? "Snooze until…" : "Due on…"}
            </Button>
            <Calendar
              mode="single"
              selected={due === undefined ? undefined : dateOf(due)}
              // Snoozing only moves later, starting from today, however overdue it is.
              defaultMonth={dateOf(snooze ? today : (due ?? today))}
              disabled={snooze ? { before: dateOf(today) } : undefined}
              onSelect={(date) => {
                if (date) choose(dayOf(date));
              }}
            />
          </>
        ) : (
          <ul className="flex flex-col" aria-label={snooze ? "Snooze until" : "Due"}>
            {choices.map(({ id, label, day }) => (
              <li key={id}>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => choose(day)}
                >
                  {label}
                  <span className="font-normal text-muted-foreground">{shortDate(day)}</span>
                </Button>
              </li>
            ))}
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setPickingDate(true)}
              >
                <CalendarDaysIcon data-icon="inline-start" />
                Date…
              </Button>
            </li>
            {due !== undefined && (
              <>
                <Separator className="my-1" />
                <li>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => choose(null)}
                  >
                    <CalendarXIcon data-icon="inline-start" />
                    Remove due date
                  </Button>
                </li>
              </>
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
