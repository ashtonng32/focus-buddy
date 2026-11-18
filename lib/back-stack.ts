"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the phone's back swipe / back button work inside the app.
 *
 * The screens are state, not pages, so by default there is nothing to go "back" to and the swipe closes
 * the app. This keeps the browser history in step with what is on screen:
 *  - `overlay` (e.g. the suggested-task screen) gets its own history entry: back closes it.
 *  - `hold` (a block is running, or a Done/Stuck follow-up is waiting) keeps one entry under the screen,
 *    so back never closes the app mid-block.
 * On the plain Start screen nothing is added, so back leaves the app as usual.
 */
export function useBackStack({ overlay, hold, onOverlayBack }: { overlay: boolean; hold: boolean; onOverlayBack: () => void }) {
  const desired = (hold ? 1 : 0) + (overlay ? 1 : 0);
  const depth = useRef(0); // history entries this hook has added
  const suppress = useRef(0); // popstates we caused ourselves
  const live = useRef({ overlay, hold, onOverlayBack });

  useEffect(() => {
    live.current = { overlay, hold, onOverlayBack };
  });

  // Add or remove entries to match what is on screen.
  useEffect(() => {
    if (desired > depth.current) {
      while (depth.current < desired) {
        // Keep the router's own history state (it needs it to handle back correctly).
        window.history.pushState({ ...window.history.state, fbDepth: depth.current + 1 }, "", window.location.href);
        depth.current++;
      }
    } else if (desired < depth.current) {
      suppress.current++;
      window.history.go(desired - depth.current);
      depth.current = desired;
    }
  }, [desired]);

  // The user swiped back.
  useEffect(() => {
    function onPop() {
      if (suppress.current > 0) {
        suppress.current--;
        return;
      }
      depth.current = Math.max(0, depth.current - 1);
      const s = live.current;
      if (s.overlay) {
        s.onOverlayBack();
      } else if (s.hold && depth.current < 1) {
        // Stay in the app: put the held entry back.
        window.history.pushState({ ...window.history.state, fbDepth: 1 }, "", window.location.href);
        depth.current = 1;
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
