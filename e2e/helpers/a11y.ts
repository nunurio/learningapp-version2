import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function checkA11y(page: Page, opts?: { include?: string | string[]; exclude?: string | string[] }) {
  let builder = new AxeBuilder({ page });
  if (opts?.include) {
    const inc = Array.isArray(opts.include) ? opts.include : [opts.include];
    inc.forEach((s) => (builder = builder.include(s)));
  }
  if (opts?.exclude) {
    const exc = Array.isArray(opts.exclude) ? opts.exclude : [opts.exclude];
    exc.forEach((s) => (builder = builder.exclude(s)));
  }
  const results = await builder.analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  const seriousPlus = results.violations.filter((v) => ["serious", "critical"].includes(v.impact || ""));
  return { critical, seriousPlus, all: results.violations };
}
