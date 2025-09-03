import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("cn (clsx + tailwind-merge)", () => {
  it("falsyを除外しつつ結合する", () => {
    expect(cn("p-2", false && "hidden", undefined, "text-sm")).toBe("p-2 text-sm");
  });

  it("競合するTailwindクラスをマージする", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("px-2", "px-4", "px-1")).toBe("px-1");
  });
});
