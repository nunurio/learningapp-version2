import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ChatWidget from "./ChatWidget";

describe("ChatWidget", () => {
  it("opens and closes the chat panel", () => {
    render(<ChatWidget />);
    const btn = screen.getByRole("button", { name: "AIチャットを開く" });
    fireEvent.click(btn);
    const dialog = screen.getByRole("dialog", { name: "AI チャット" });
    expect(dialog).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "閉じる" });
    fireEvent.click(close);
    expect(screen.queryByRole("dialog", { name: "AI チャット" })).toBeNull();
  });
});
