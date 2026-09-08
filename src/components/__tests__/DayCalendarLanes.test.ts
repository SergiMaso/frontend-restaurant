import { describe, it, expect } from "vitest";
import { packIntoLanes } from "../DayCalendar";

/**
 * Lane packing for the capacity-mode schedule.
 *
 * With assigned tables each booking has its own column and can never collide with
 * another. Without them the columns are areas, so the layout has to keep concurrent
 * bookings apart itself — that is what this does, and it is the only thing standing
 * between a busy service and five cards drawn on top of each other.
 */
const item = (id: number, startIndex: number, endIndex: number) => ({ id, startIndex, endIndex });
const asIds = (lanes: Set<number>[]) => lanes.map((l) => [...l].sort((a, b) => a - b));

describe("packIntoLanes", () => {
  it("puts nothing in no lanes", () => {
    expect(packIntoLanes([])).toEqual([]);
  });

  it("keeps bookings that never overlap in a single lane", () => {
    const lanes = packIntoLanes([item(1, 0, 6), item(2, 6, 12), item(3, 12, 18)]);
    expect(asIds(lanes)).toEqual([[1, 2, 3]]);
  });

  it("treats a booking starting exactly when another ends as non-overlapping", () => {
    // Slot ranges are half-open: a 13:00-14:30 booking occupies up to but not including
    // the 14:30 slot, so the next sitting reuses the lane instead of widening the grid.
    expect(packIntoLanes([item(1, 4, 10), item(2, 10, 16)])).toHaveLength(1);
  });

  it("opens a second lane for an overlap of a single slot", () => {
    expect(packIntoLanes([item(1, 4, 10), item(2, 9, 15)])).toHaveLength(2);
  });

  it("uses exactly as many lanes as the busiest moment needs", () => {
    // Four at once, then the room empties and refills: still four columns, not eight.
    const lanes = packIntoLanes([
      item(1, 0, 8), item(2, 0, 8), item(3, 0, 8), item(4, 0, 8),
      item(5, 8, 16), item(6, 8, 16), item(7, 8, 16), item(8, 8, 16),
    ]);
    expect(lanes).toHaveLength(4);
    expect(asIds(lanes)).toEqual([[1, 5], [2, 6], [3, 7], [4, 8]]);
  });

  it("does not depend on the order it receives them in", () => {
    const forwards = packIntoLanes([item(1, 0, 6), item(2, 3, 9), item(3, 6, 12)]);
    const backwards = packIntoLanes([item(3, 6, 12), item(2, 3, 9), item(1, 0, 6)]);
    expect(asIds(forwards)).toEqual(asIds(backwards));
  });

  it("places every booking exactly once", () => {
    const items = Array.from({ length: 40 }, (_, i) => item(i, i % 7, (i % 7) + 5));
    const lanes = packIntoLanes(items);
    const placed = lanes.flatMap((l) => [...l]);
    expect(placed.sort((a, b) => a - b)).toEqual(items.map((i) => i.id));
    expect(new Set(placed).size).toBe(items.length);
  });

  it("never puts two overlapping bookings in the same lane", () => {
    const items = [
      item(1, 0, 10), item(2, 2, 4), item(3, 3, 12), item(4, 11, 20), item(5, 5, 6),
    ];
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const lane of packIntoLanes(items)) {
      const inLane = [...lane].map((id) => byId.get(id)!).sort((a, b) => a.startIndex - b.startIndex);
      for (let i = 1; i < inLane.length; i++) {
        expect(inLane[i].startIndex).toBeGreaterThanOrEqual(inLane[i - 1].endIndex);
      }
    }
  });
});
