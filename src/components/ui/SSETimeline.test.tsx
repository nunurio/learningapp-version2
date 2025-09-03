import { describe, it, expect, vi } from "vitest";
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

  it("準備/生成/検証/保存 の各グループが順に開始し、最後だけ進行中として表示される", () => {
    const base = 1_000_000_000;
    vi.setSystemTime(new Date(base + 2000));
    render(
      <SSETimeline
        logs={[
          { ts: base + 0, text: "received" },
          { ts: base + 200, text: "expandContext" },
          { ts: base + 400, text: "planCourse" },
          { ts: base + 800, text: "validateSchema" },
          { ts: base + 1200, text: "persistPreview" },
        ]}
      />
    );
    // 先頭3グループは完了マーク、最後は進行中マーク
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(/✔︎ .*準備/);
    expect(region).toHaveTextContent(/✔︎ .*生成/);
    expect(region).toHaveTextContent(/✔︎ .*検証/);
    expect(region).toHaveTextContent(/⏳ .*保存/);
  });
});
