#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const min = Number(process.argv.find((a) => a.startsWith("--min="))?.split("=")[1] ?? 85);
const summaryPath = path.resolve("coverage/coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  console.error(`[check-lib-coverage] Not found: ${summaryPath}. Run \"pnpm coverage\" first.`);
  process.exit(2);
}
const json = JSON.parse(fs.readFileSync(summaryPath, "utf8"));

let covered = { lines: 0, statements: 0, functions: 0, branches: 0 };
let total = { lines: 0, statements: 0, functions: 0, branches: 0 };
for (const [file, data] of Object.entries(json)) {
  if (file === "total") continue;
  if (!file.includes("src/lib/")) continue; // lib のみ
  const d = /** @type {{ lines:{covered:number,total:number}, statements:{covered:number,total:number}, functions:{covered:number,total:number}, branches:{covered:number,total:number} }} */ (data);
  covered.lines += d.lines.covered; total.lines += d.lines.total;
  covered.statements += d.statements.covered; total.statements += d.statements.total;
  covered.functions += d.functions.covered; total.functions += d.functions.total;
  covered.branches += d.branches.covered; total.branches += d.branches.total;
}

const pct = {
  lines: total.lines ? (covered.lines / total.lines) * 100 : 0,
  statements: total.statements ? (covered.statements / total.statements) * 100 : 0,
  functions: total.functions ? (covered.functions / total.functions) * 100 : 0,
  branches: total.branches ? (covered.branches / total.branches) * 100 : 0,
};

const pass = pct.lines >= min && pct.statements >= min;
const round = (n) => Math.round(n * 100) / 100;
if (!pass) {
  console.error(`[check-lib-coverage] FAIL: lib coverage below ${min}% (lines=${round(pct.lines)}%, statements=${round(pct.statements)}%)`);
  process.exit(1);
} else {
  console.log(`[check-lib-coverage] PASS: lib lines=${round(pct.lines)}%, statements=${round(pct.statements)}% (min=${min}%)`);
}

