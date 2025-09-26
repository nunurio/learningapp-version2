import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { NotesDialog } from "@/components/notes/NotesDialog";
import type { Note } from "@/lib/types";

const now = new Date("2024-01-01T00:00:00.000Z");
const iso = (offsetMinutes: number) => new Date(now.getTime() + offsetMinutes * 60_000).toISOString();

vi.mock("@/lib/client-api", () => ({
  listNotes: vi.fn(async () => []),
  createNote: vi.fn(async () => ({ noteId: "created-note", createdAt: iso(1), updatedAt: iso(1) })),
  updateNote: vi.fn(async () => ({ updatedAt: iso(2) })),
  deleteNote: vi.fn(async () => {}),
}));

vi.mock("@/components/ui/toaster", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    toast: vi.fn(),
  };
});

const clientApi = await import("@/lib/client-api");
const { toast } = await import("@/components/ui/toaster");

describe("NotesDialog", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(clientApi.listNotes).mockReset().mockResolvedValue([]);
    vi.mocked(clientApi.updateNote).mockReset().mockResolvedValue({ updatedAt: iso(10) });
    vi.mocked(clientApi.createNote).mockReset().mockResolvedValue({ noteId: "created-note", createdAt: iso(1), updatedAt: iso(1) });
    vi.mocked(clientApi.deleteNote).mockReset().mockResolvedValue();
    vi.mocked(toast).mockClear();
  });

  it("openしたらノートを読み込み、作成日時降順で表示する", async () => {
    const notes: Note[] = [
      { id: "n-1", cardId: "card-1", text: "first", createdAt: iso(5), updatedAt: iso(6) },
      { id: "n-2", cardId: "card-1", text: "second", createdAt: iso(10), updatedAt: iso(11) },
    ];
    vi.mocked(clientApi.listNotes).mockResolvedValue(notes);

    render(
      <NotesDialog
        cardId={"card-1"}
        trigger={<button type="button">メモ</button>}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "メモ" }));

    await waitFor(() => {
      expect(clientApi.listNotes).toHaveBeenCalledWith("card-1");
    });

    const items = await screen.findAllByTestId("notes-dialog-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("second");
    expect(items[1]).toHaveTextContent("first");
  });

  it("既存メモを更新すると updateNote を呼び出し、フォームをリセットする", async () => {
    vi.mocked(clientApi.listNotes).mockResolvedValue([
      { id: "n-1", cardId: "card-1", text: "original", createdAt: iso(1), updatedAt: iso(1) },
    ]);

    render(
      <NotesDialog
        cardId={"card-1"}
        trigger={<button type="button">ノート</button>}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "ノート" }));

    const textarea = await screen.findByDisplayValue("original");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "updated");

    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(clientApi.updateNote).toHaveBeenCalledWith("n-1", { text: "updated" });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    });
  });

  it("新規メモを追加してフォーカスし、onNotesChange で通知する", async () => {
    const notes: Note[] = [];
    vi.mocked(clientApi.listNotes).mockResolvedValue(notes);
    const handleNotesChange = vi.fn();

    render(
      <NotesDialog
        cardId={"card-1"}
        trigger={<button type="button">メモ</button>}
        onNotesChange={handleNotesChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "メモ" }));

    const input = await screen.findByPlaceholderText("新しいメモを入力…");
    await userEvent.type(input, "created note");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(clientApi.createNote).toHaveBeenCalledWith("card-1", "created note");
    });

    const newTextarea = await screen.findByDisplayValue("created note");
    expect(document.activeElement).toBe(newTextarea);
    expect(input).toHaveValue("");
    expect(handleNotesChange).toHaveBeenCalled();
  });

  it("メモを削除できる", async () => {
    vi.mocked(clientApi.listNotes).mockResolvedValue([
      { id: "n-1", cardId: "card-1", text: "keep", createdAt: iso(1), updatedAt: iso(1) },
    ]);

    render(
      <NotesDialog
        cardId={"card-1"}
        trigger={<button type="button">メモ</button>}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "メモ" }));

    const deleteButton = await screen.findByRole("button", { name: "削除" });
    await userEvent.click(deleteButton);
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(clientApi.deleteNote).toHaveBeenCalledWith("n-1");
    });
  });

  it("削除失敗時は toast を表示する", async () => {
    vi.mocked(clientApi.listNotes).mockResolvedValue([
      { id: "n-1", cardId: "card-1", text: "keep", createdAt: iso(1), updatedAt: iso(1) },
    ]);
    vi.mocked(clientApi.deleteNote).mockRejectedValueOnce(new Error("fail"));

    render(
      <NotesDialog
        cardId={"card-1"}
        trigger={<button type="button">メモ</button>}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "メモ" }));

    const deleteButton = await screen.findByRole("button", { name: "削除" });
    await userEvent.click(deleteButton);
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalled();
    });
  });
});
