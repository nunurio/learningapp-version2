import type { Locator, Page } from "@playwright/test";

export async function dnd(page: Page, from: Locator, to: Locator) {
  await from.hover();
  await page.mouse.down();
  const box = await to.boundingBox();
  if (!box) throw new Error("drop target not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.up();
}

