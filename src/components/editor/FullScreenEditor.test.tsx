import * as React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FullScreenEditor } from "@/components/editor/FullScreenEditor";
import type { UUID } from "@/lib/types";
import type { SaveCardDraftInput } from "@/lib/data";

// Mock next/navigation router
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/state/workspace-store", () => ({
  workspaceStore: {
    setDraft: vi.fn(),
    clearDraft: vi.fn(),
    bumpVersion: vi.fn(),
    setLevel: vi.fn(),
    setActivePane: vi.fn(),
    subscribe: () => () => {},
    getSnapshot: () => ({ drafts: {}, activePane: "center", version: 0, levels: {} }),
  },
  useWorkspace: () => ({ drafts: {}, activePane: "center", version: 0, levels: {} }),
  useWorkspaceSelector: () => 0,
}));

vi.mock("@/lib/data", () => ({
  saveCardDraft: vi.fn(async (_i: SaveCardDraftInput) => ({ updatedAt: new Date().toISOString() })),
  loadCardDraft: vi.fn(async (_id: UUID) => undefined),
  publishCard: vi.fn(async (_id: UUID) => {}),
}));

describe("FullScreenEditor (text card)", () => {
  it("autosaves body after debounce and calls publish", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD" as unknown as UUID}
        cardType="text"
        title={null}
        body=""
      />
    );
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(ta, "Hello Markdown");

    // advance debounce (500ms)
    await waitFor(async () => {
      const { saveCardDraft } = await import("@/lib/data");
      expect(saveCardDraft).toHaveBeenCalled();
    }, { timeout: 2000 });

    const { saveCardDraft, publishCard } = await import("@/lib/data");
    expect(saveCardDraft).toHaveBeenCalled();
    const last = vi.mocked(saveCardDraft).mock.calls.at(-1);
    expect(last).toBeTruthy();
    if (last) {
      const [args] = last as [SaveCardDraftInput];
      expect(args).toMatchObject({ cardId: "CARD", cardType: "text", body: "Hello Markdown" });
    }

    // publish button triggers publish + workspace mutations
    const publishBtn = screen.getByRole("button", { name: "公開" });
    await user.click(publishBtn);
    expect(publishCard).toHaveBeenCalledWith("CARD");

    const { workspaceStore } = await import("@/lib/state/workspace-store");
    expect(workspaceStore.clearDraft).toHaveBeenCalledWith("CARD");
    expect(workspaceStore.bumpVersion).toHaveBeenCalled();
  });

  it("toggles preview on/off via toolbar", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD2" as unknown as UUID}
        cardType="text"
        title={null}
        body={"# Title"}
      />
    );

    // initially preview is enabled (split view)
    expect(screen.getByRole("article")).toBeInTheDocument();

    const previewBtn = screen.getByRole("button", { name: /Preview/i });
    await user.click(previewBtn); // disable preview
    expect(screen.queryByRole("article")).toBeNull();

    await user.click(previewBtn); // enable again
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("undo/redo navigates history snapshots", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD3" as unknown as UUID}
        cardType="text"
        title={null}
        body=""
      />
    );
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;

    // type two snapshots
    await user.type(ta, "Hello");
    expect(ta.value).toBe("Hello");
    await user.type(ta, " World");
    expect(ta.value).toBe("Hello World");

    // Undo step-by-step (per keystroke history)
    await user.click(screen.getByRole("button", { name: /Undo/i }));
    expect(ta.value).toBe("Hello Worl");
    await user.click(screen.getByRole("button", { name: /Undo/i }));
    expect(ta.value).toBe("Hello Wor");
    // Redo twice -> return to "Hello World"
    await user.click(screen.getByRole("button", { name: /Redo/i }));
    expect(ta.value).toBe("Hello Worl");
    await user.click(screen.getByRole("button", { name: /Redo/i }));
    expect(ta.value).toBe("Hello World");
  });
});
