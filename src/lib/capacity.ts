/**
 * Rules for the area-capacity dialog that do not need React.
 *
 * Kept out of the component file so it can be tested directly — this project has
 * no jsdom, so a rule living inside a component could only be checked by reading
 * the source as text. Exporting it from the component instead also trips
 * react-refresh/only-export-components, which is the same complaint from the
 * other direction: a module that exports both a component and a helper cannot be
 * hot-reloaded cleanly.
 */

/**
 * Whether a finished capacity check describes something other than what is on screen.
 *
 * The check runs over the network, and the reply that comes back carries the
 * numbers it was asked about, not the numbers in the fields now. When nothing
 * needs re-seating the dialog applies the result without asking again, so a reply
 * that arrived late would rebuild the whole table plan to a layout the user had
 * already changed away from — or to one they abandoned by closing the dialog.
 */
export const capacityReplyIsStale = (
  live: { inside: number; terrace: number; open: boolean },
  checked: { inside: number; terrace: number },
) => !live.open || live.inside !== checked.inside || live.terrace !== checked.terrace;

/**
 * Whether the current tables are exactly what capacity generation creates: in every
 * area, one-seat tables each paired with every other table of that area. Anything
 * else — a table made by hand, even a one-seat one, or a pairing someone edited — is
 * a real plan, and replacing it must show the preview first.
 *
 * "Any table with more than one seat" was the first version of this test, and it let
 * a hand-made plan of paired one-seat tables be replaced on the first click. Found by
 * the review gate, 2026-09-24.
 */
export const isGeneratedCapacityPlan = (
  tables: ReadonlyArray<{ table_number: number; capacity: number; pairing?: number[] | null;
                           area?: string | null }>,
): boolean => {
  const byArea = new Map<string, number[]>();
  for (const table of tables) {
    const area = table.area || "inside";
    byArea.set(area, [...(byArea.get(area) || []), table.table_number]);
  }
  return tables.every((table) => {
    if (table.capacity !== 1) return false;
    const others = (byArea.get(table.area || "inside") || [])
      .filter((n) => n !== table.table_number).sort((a, b) => a - b);
    const paired = [...(table.pairing || [])].sort((a, b) => a - b);
    return others.length === paired.length && others.every((n, i) => n === paired[i]);
  });
};
