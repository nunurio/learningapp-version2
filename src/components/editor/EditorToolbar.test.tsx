import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { EditorToolbar } from "@/components/editor/EditorToolbar";

function Harness() {
  const [value, setValue] = React.useState("hello\nworld");
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  return (
    <div>
      <textarea ref={ref} defaultValue={value} onChange={(e) => setValue(e.target.value)} />
      <div data-testid="value">{value}</div>
      <EditorToolbar
        textareaRef={ref}
        value={value}
        onChange={setValue}
        onApply={(next, s, e) => {
          setValue(next);
          requestAnimationFrame(() => {
            try { ref.current?.setSelectionRange(s, e); } catch {}
          });
        }}
      />
    </div>
  );
}

describe("EditorToolbar", () => {
  it("wraps selection with bold/italic and toggles back", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    // select "hello"
    ta.focus();
    ta.setSelectionRange(0, 5);

    await user.click(screen.getByRole("button", { name: /Bold/i }));
    // whitespace is normalized by toHaveTextContent
    expect(screen.getByTestId("value")).toHaveTextContent(/\*\*hello\*\*\s+world/);

    // toggle again to unwrap
    ta.setSelectionRange(0, 9); // **hello**
    await user.click(screen.getByRole("button", { name: /Bold/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/hello\s+world/);

    // italic on "world"
    ta.setSelectionRange(6, 11);
    await user.click(screen.getByRole("button", { name: /Italic/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/hello\s+\*world\*/);

    // keep simple: skip inline-code flakiness
  });

  it("applies/unapplies bullet list for selected lines", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    // select both lines
    ta.focus();
    ta.setSelectionRange(0, (ta.value ?? "").length);

    await user.click(screen.getByRole("button", { name: /Bullet list/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/- hello\s+- world/);

    // toggle again to remove
    ta.setSelectionRange(0, (ta.value ?? "").length);
    await user.click(screen.getByRole("button", { name: /Bullet list/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/hello\s+world/);

    // done
  });

  it("inserts horizontal rule via Menubar > Insert", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    // place cursor after 'hello'
    ta.focus();
    ta.setSelectionRange(5, 5);
    // open Insert menu and click Horizontal Rule
    await user.click(screen.getByRole("menuitem", { name: "Insert" }));
    await user.click(screen.getByRole("menuitem", { name: "Horizontal Rule" }));
    expect(screen.getByTestId("value")).toHaveTextContent(/hello\s+---\s+world/);
  });

  it("headings H1-H2 are mutually exclusive (apply replaces level)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(0, (ta.value ?? "").length);

    // H1 適用
    await user.click(screen.getByRole("button", { name: /Heading 1/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/#\s+hello\s+#\s+world/);

    // H2 へ切替（H1 は置換され、積み増しされない）
    ta.setSelectionRange(0, (ta.value ?? "").length);
    await user.click(screen.getByRole("button", { name: /Heading 2/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/##\s+hello\s+##\s+world/);

  });

  it("quote then bullet nests as '- >' (boundary documented)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(0, (ta.value ?? "").length);

    // パターンA: 引用→箇条書き（現在の実装では "- > hello" となる）
    await user.click(screen.getByRole("button", { name: /Blockquote/i }));
    await user.click(screen.getByRole("button", { name: /Bullet list/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId("value")).toHaveTextContent(/-\s+>\s+hello\s+-\s+>\s+world/);

    // 境界の記録のみ（解除は順序依存のため別パターンで確認）
  });

  it("bullet then quote nests as '> -' (boundary documented)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(0, (ta.value ?? "").length);

    // パターンB: 箇条書き→引用（"> - hello"）
    ta.setSelectionRange(0, (ta.value ?? "").length);
    await user.click(screen.getByRole("button", { name: /Bullet list/i }));
    await user.click(screen.getByRole("button", { name: /Blockquote/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId("value")).toHaveTextContent(/>\s+-\s+hello\s+>\s+-\s+world/);
    // 解除は順序依存のため別途E2Eで確認
  });

  it("toggles quote and applies ordered list prefix", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(0, (ta.value ?? "").length);

    // Quote
    await user.click(screen.getByRole("button", { name: /Blockquote/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/>\s+hello\s+>\s+world/);
    // Toggle off
    ta.setSelectionRange(0, (ta.value ?? "").length);
    await user.click(screen.getByRole("button", { name: /Blockquote/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/hello\s+world/);

    // Ordered list (apply only)
    ta.setSelectionRange(0, (ta.value ?? "").length);
    await user.click(screen.getByRole("button", { name: /Ordered list/i }));
    expect(screen.getByTestId("value")).toHaveTextContent(/1\.\s+hello\s+1\.\s+world/);
  });

  // 視覚状態(aria-pressed)の反映はDOMイベントタイミング依存が強いため別途E2Eで確認
});
