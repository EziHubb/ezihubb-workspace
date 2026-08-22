/**
 * The small count bubble on a header icon — wishlist, cart, notifications.
 *
 * Its own module rather than living in Navbar, because NotificationBell needs
 * it and Navbar imports NotificationBell: importing it back from Navbar would
 * close a cycle between the two files. Bundlers usually survive that when the
 * value is only read at render time, but "usually" depends on evaluation order,
 * and the failure it produces — an `undefined` component — surfaces as a blank
 * header rather than an error anyone can trace back here.
 *
 * Renders nothing at zero, so callers can pass a count unconditionally.
 */
export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center tabular-nums pointer-events-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}
