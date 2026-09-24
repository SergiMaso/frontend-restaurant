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
