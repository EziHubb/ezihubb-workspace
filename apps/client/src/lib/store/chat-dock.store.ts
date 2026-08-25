import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * How many conversations the dock will hold at once.
 *
 * Three, because the collapsed launcher shows them as a stack of avatars and a
 * fourth is no longer readable at that size — the same reason Messenger caps
 * its own heads rather than letting them accumulate.
 */
export const MAX_DOCKED = 3;

interface ChatDockState {
  /** Docked conversations, oldest first. The last one is the most recently opened. */
  openIds:  string[];
  /** Which docked conversation the panel is showing. */
  activeId: string | null;
  /** Whether the panel is showing at all, as opposed to just the launcher. */
  expanded: boolean;

  openConversation:  (conversationId: string) => void;
  closeConversation: (conversationId: string) => void;
  setActive:         (conversationId: string) => void;
  collapse:          () => void;
  toggleExpanded:    () => void;
  /** Drop anything the server no longer lists. */
  prune:             (liveIds: Set<string>) => void;
  /** Everything out — used when the session ends. */
  reset: () => void;
}

export const useChatDock = create<ChatDockState>()(
  persist(
    (set) => ({
      openIds:  [],
      activeId: null,
      expanded: false,

      openConversation: (conversationId) =>
        set((s) => {
          // Re-opening one already docked promotes it rather than duplicating.
          const rest = s.openIds.filter((id) => id !== conversationId);
          const next = [...rest, conversationId].slice(-MAX_DOCKED);
          return { openIds: next, activeId: conversationId, expanded: true };
        }),

      closeConversation: (conversationId) =>
        set((s) => {
          const next = s.openIds.filter((id) => id !== conversationId);
          if (s.activeId !== conversationId) return { ...s, openIds: next };
          // Closing the one on screen falls back to the most recent of what is
          // left, so the panel does not blank out with conversations still
          // docked beside it.
          const fallback = next[next.length - 1] ?? null;
          return { openIds: next, activeId: fallback, expanded: fallback !== null };
        }),

      prune: (liveIds) =>
        set((s) => {
          const openIds     = s.openIds.filter((id) => liveIds.has(id));
          const activeAlive = s.activeId !== null && liveIds.has(s.activeId);
          // Returning the SAME state object when there is nothing to drop is
          // what keeps this from looping: the caller runs it from an effect
          // keyed on the conversation list, so a fresh array here would be a
          // new render, a new prune, and no way out.
          if (openIds.length === s.openIds.length && (s.activeId === null || activeAlive)) return s;

          const activeId = activeAlive ? s.activeId : (openIds[openIds.length - 1] ?? null);
          return { openIds, activeId, expanded: activeId === null ? false : s.expanded };
        }),

      setActive:      (conversationId) => set({ activeId: conversationId, expanded: true }),
      collapse:       () => set({ expanded: false }),
      toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
      reset:          () => set({ openIds: [], activeId: null, expanded: false }),
    }),
    {
      name: 'ezihubb-chat-dock',
      // `expanded` is deliberately not persisted. Which conversations someone
      // had docked is worth carrying across a reload; having a chat panel
      // spring open over the page they just loaded is not — that is the app
      // interrupting them rather than resuming them.
      partialize: (s) => ({ openIds: s.openIds, activeId: s.activeId }),
    },
  ),
);
