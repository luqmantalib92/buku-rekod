// Prints the What's new entry for one version as Markdown bullets, for the
// "it's live" comment. Exits 1 if that version has no entry, so a release
// cannot go out with an empty email and a What's new page that skipped it.
//
// public/js/changelog.js is a page script, not a module: it also wires up the
// page. Only the CHANGELOG list is evaluated, in a sandbox with nothing in it.
//
//   node .github/scripts/release-notes.mjs 2.1.0

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const version = process.argv[2];
const src = readFileSync('public/js/changelog.js', 'utf8');
const start = src.indexOf('const CHANGELOG = [');
const end = src.indexOf('\n];', start);
if (start < 0 || end < 0) {
  console.error('Could not find the CHANGELOG list in public/js/changelog.js.');
  process.exit(1);
}
const list = vm.runInNewContext(`${src.slice(start, end + 3)}\nCHANGELOG`);
const entry = list.find((e) => e.version === version);
if (!entry) {
  console.error(`public/js/changelog.js has no entry for ${version}.`);
  process.exit(1);
}
process.stdout.write(entry.notes.map((n) => `- ${n}`).join('\n') + '\n');
