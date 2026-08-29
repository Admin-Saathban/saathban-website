/* Seven-day calendar strip across the top of the Icon home.

   Each day is a ≥48px tap target. Logged days carry a ✓ mark and rest
   days a moon mark — a shape, never colour alone. Today and yesterday
   are tappable (48-hour backfill window, SPEC.md "Daily logs"); older
   days are shown settled, not as failures. */

import { useEffect, useRef } from "react";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarStrip({ days, selectedOffset, onSelect }) {
  const scrollRef = useRef(null);

  // On very narrow screens the strip scrolls sideways; start it at
  // the right so today is always in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <nav aria-label="Recent days" style={{ marginBottom: 8 }}>
      <div
        ref={scrollRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${days.length}, minmax(${A11Y.minTapTargetPx}px, 1fr))`,
          gap: 6,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {days.map((day) => {
          const selected = day.offset === selectedOffset;
          const isToday = day.offset === 0;
          const editable = day.offset >= -2; // 48-hour backfill window
          const mark = day.restDay ? "☾" : day.logged ? "✓" : "";
          const markLabel = day.restDay
            ? ", rest day"
            : day.logged
            ? ", logged"
            : "";
          return (
            <button
              key={day.offset}
              type="button"
              onClick={() => editable && onSelect(day.offset)}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${isToday ? "Today, " : ""}${WEEKDAYS[day.date.getDay()]} ${day.date.getDate()}${markLabel}`}
              aria-disabled={!editable}
              style={{
                minHeight: 76,
                minWidth: A11Y.minTapTargetPx,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                borderRadius: 16,
                border: selected
                  ? `3px solid ${C.green}`
                  : `2px solid ${isToday ? C.greenMuted : "transparent"}`,
                background: selected ? C.white : editable ? "rgba(255,255,255,0.55)" : "transparent",
                color: editable ? C.textMain : C.textMuted,
                fontFamily: FONTS.sans,
                cursor: editable ? "pointer" : "default",
                padding: "6px 2px",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 500, color: C.textMuted }}>
                {isToday ? "Today" : WEEKDAYS[day.date.getDay()]}
              </span>
              <span style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15 }}>
                {day.date.getDate()}
              </span>
              <span
                aria-hidden="true"
                style={{
                  fontSize: 18,
                  lineHeight: "20px",
                  height: 20,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                {mark}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
