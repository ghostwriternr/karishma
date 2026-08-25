import { useState } from "react";
import { z } from "zod";

const ROSTER_KEY = "karishma.roster.v0";

export type Bot = {
  name: string;
  conversationId: string;
  createdAt: string;
};

type RosterState = {
  bots: Bot[];
  selectedId: string | null;
};

const botSchema: z.ZodType<Bot> = z.object({
  name: z.string(),
  conversationId: z.string(),
  createdAt: z.string(),
});
const storedRosterSchema = z.array(z.json());

function loadRoster(): Bot[] {
  try {
    const result = storedRosterSchema.safeParse(
      JSON.parse(localStorage.getItem(ROSTER_KEY) ?? "[]"),
    );
    if (!result.success) return [];
    return result.data.flatMap((entry) => {
      const bot = botSchema.safeParse(entry);
      return bot.success ? [bot.data] : [];
    });
  } catch {
    return [];
  }
}

function saveRoster(bots: Bot[]) {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(bots));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/g, "");
}

function initialState(): RosterState {
  const bots = loadRoster();
  return { bots, selectedId: bots[0]?.conversationId ?? null };
}

export function useRoster() {
  const [state, setState] = useState<RosterState>(initialState);
  const selected =
    state.bots.find((bot) => bot.conversationId === state.selectedId) ?? null;

  function create(nameInput: string): Bot | null {
    const name = nameInput.trim();
    if (!name) return null;
    const bot: Bot = {
      name,
      conversationId: `${slugify(name) || "bot"}-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setState((current) => {
      const bots = [...current.bots, bot];
      saveRoster(bots);
      return { bots, selectedId: bot.conversationId };
    });
    return bot;
  }

  function select(conversationId: string) {
    setState((current) =>
      current.bots.some((bot) => bot.conversationId === conversationId)
        ? { ...current, selectedId: conversationId }
        : current,
    );
  }

  function remove(conversationId: string) {
    setState((current) => {
      const removedIndex = current.bots.findIndex(
        (bot) => bot.conversationId === conversationId,
      );
      if (removedIndex === -1) return current;

      const bots = current.bots.filter(
        (bot) => bot.conversationId !== conversationId,
      );
      const selectedId =
        current.selectedId === conversationId
          ? (bots[removedIndex]?.conversationId ??
            bots[removedIndex - 1]?.conversationId ??
            null)
          : current.selectedId;
      saveRoster(bots);
      return { bots, selectedId };
    });
  }

  return {
    bots: state.bots,
    selected,
    selectedId: state.selectedId,
    create,
    remove,
    select,
  };
}
