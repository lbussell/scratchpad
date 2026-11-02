import { CalendarDaysIcon, ChevronLeftIcon } from "lucide-react";
import { type ReactElement, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { isTimeOfDay } from "../../../shared/schema.ts";
import {
  dateOf,
  type Day,
  dayOf,
  formatTime,
  isSameWhen,
  snoozeTo,
  SNOOZES,
  type When,
} from "../../todos.ts";

interface DuePopoverProps {
  when: When;
  today: Day;
  onChange: (when: When) => void;
  /** The button that opens it, and what's in it. */
  trigger: ReactElement;
  children: ReactNode;
}

const shortDate = (day: Day) =>
  dateOf(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Where a snooze lands: the time for the ones later today, otherwise the day. */
function describe({ due, time }: When, today: Day): string {
  if (time === undefined) return shortDate(due);
  if (due === today) return formatTime(time);
  return `${dateOf(due).toLocaleDateString(undefined, { weekday: "short" })} ${formatTime(time)}`;
}

/**
 * Snoozes a to-do: a little later, another day, or any day and time from a calendar. Every to-do
 * is due some day, so there's no removing it.
 */
export function DuePopover({ when, today, onChange, trigger, children }: DuePopoverProps) {
  const [isOpen, setOpen] = useState(false);
  const [isPickingDate, setPickingDate] = useState(false);
  // When it opened, to show where the choices for later today land.
  const [openedAt, setOpenedAt] = useState(() => new Date());
  const choose = (next: When) => {
    onChange(next);
    setOpen(false);
  };
  const choices = SNOOZES.map(({ id, label }) => ({ id, label, when: snoozeTo(id, openedAt) }))
    // Already there.
    .filter((choice) => !isSameWhen(choice.when, when));
  const later = choices.filter(({ when: { time } }) => time !== undefined);
  const days = choices.filter(({ when: { time } }) => time === undefined);
  const renderChoice = ({ id, label, when: next }: (typeof choices)[number]) => (
    <li key={id}>
      <Button
        variant="ghost"
        className="w-full justify-between"
        // From the press, so "1 hour" means an hour, however long the menu was open.
        onClick={() => choose(snoozeTo(id, new Date()))}
      >
        {label}
        <span className="font-normal text-muted-foreground">{describe(next, today)}</span>
      </Button>
    </li>
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) return;
        setPickingDate(false);
        setOpenedAt(new Date());
      }}
    >
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-56">
        {isPickingDate ? (
          <DateTimePicker
            when={when}
            today={today}
            onBack={() => setPickingDate(false)}
            onChoose={choose}
          />
        ) : (
          <ul className="flex flex-col" aria-label="Snooze until">
            {later.map(renderChoice)}
            <li aria-hidden="true">
              <Separator className="my-1" />
            </li>
            {days.map(renderChoice)}
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setPickingDate(true)}
              >
                <CalendarDaysIcon data-icon="inline-start" />
                Date and time…
              </Button>
            </li>
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DateTimePickerProps {
  when: When;
  today: Day;
  onBack: () => void;
  onChoose: (when: When) => void;
}

/** Any day from today on, and a time on it if you like. */
function DateTimePicker({ when, today, onBack, onChoose }: DateTimePickerProps) {
  // Snoozing only moves later, starting from today, however overdue it is.
  const [day, setDay] = useState<Day>(when.due < today ? today : when.due);
  const [time, setTime] = useState(when.time ?? "");
  const timeId = useId();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onChoose(isTimeOfDay(time) ? { due: day, time } : { due: day });
      }}
    >
      <Button type="button" variant="ghost" className="justify-start" onClick={onBack}>
        <ChevronLeftIcon data-icon="inline-start" />
        Snooze until…
      </Button>
      <Calendar
        mode="single"
        required
        selected={dateOf(day)}
        defaultMonth={dateOf(day)}
        disabled={{ before: dateOf(today) }}
        onSelect={(date) => setDay(dayOf(date))}
      />
      <div className="px-2">
        <Field>
          <FieldLabel htmlFor={timeId}>Time</FieldLabel>
          <Input
            id={timeId}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
          <FieldDescription>
            Optional. Without one, it’s each person’s reminder time.
          </FieldDescription>
        </Field>
      </div>
      <Button type="submit" className="mx-2 mb-1">
        Snooze
      </Button>
    </form>
  );
}
