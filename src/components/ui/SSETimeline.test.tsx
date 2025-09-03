import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { SSETimeline } from "@/components/ui/SSETimeline";

describe("SSETimeline", () => {
  it("待機中のときは role=status と '待機中…' を表示する", () => {
    render(<SSETimeline logs={[]} />);
    const region = screen.getByRole("status");
    expect(region).toBeInTheDocument();
    expect(screen.getByText("待機中…")).toBeInTheDocument();
  });

  it("エラーログがあると alert を発生させる", () => {
    const now = Date.now();
    render(<SSETimeline logs={[{ ts: now, text: "エラー: 失敗" }]} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
