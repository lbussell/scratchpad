import { useEffect, useState } from "react";
import { addDays, dateOf, type Day, dayOf } from "../todos.ts";

/** Today, here. Changes at midnight, and when the page comes back after being hidden. */
export function useToday(): Day {
  const [today, setToday] = useState(() => dayOf(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const now = dayOf(new Date());
      setToday(now);
      clearTimeout(timer);
      // Timers don't run while a device sleeps, hence also checking when the page is shown again.
      const untilTomorrow = dateOf(addDays(now, 1)).getTime() - Date.now();
      timer = setTimeout(update, untilTomorrow + 1000);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return today;
}
