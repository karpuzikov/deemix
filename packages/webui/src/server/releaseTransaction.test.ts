import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ReleaseTransaction } from "./releaseTransaction.js";

function testRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "deemix-tx-"));
}
describe("album transactional publication", () => {
  it("does not change preexisting music, but publishes new completed files", () => {
    const root = testRoot();
    try {
      fs.writeFileSync(path.join(root, "existing.flac"), "ORIGINAL");
      const transaction = new ReleaseTransaction(root);
      fs.writeFileSync(path.join(transaction.media, "existing.flac"), "REPLACEMENT");
      fs.writeFileSync(path.join(transaction.media, "new.flac"), "COMPLETE");
      transaction.publish(() => false, "n");
      expect(fs.readFileSync(path.join(root, "existing.flac"), "utf8")).toBe("ORIGINAL");
      expect(fs.readFileSync(path.join(root, "new.flac"), "utf8")).toBe("COMPLETE");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it("cancels publication and deletes only its own already-published files", () => {
    const root = testRoot();
    try {
      fs.writeFileSync(path.join(root, "existing.flac"), "USER MUSIC");
      const tx = new ReleaseTransaction(root);
      fs.writeFileSync(path.join(tx.media, "a.flac"), "NEW A");
      fs.writeFileSync(path.join(tx.media, "b.flac"), "NEW B");
      let calls = 0;
      expect(() => tx.publish(() => ++calls >= 3, "n")).toThrow();
      expect(fs.existsSync(path.join(root, "a.flac"))).toBe(false);
      expect(fs.existsSync(path.join(root, "b.flac"))).toBe(false);
      expect(fs.readFileSync(path.join(root, "existing.flac"), "utf8")).toBe("USER MUSIC");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it("restores overwritten existing media after interrupted commit", () => {
    const root = testRoot();
    try {
      fs.writeFileSync(path.join(root, "a.flac"), "ORIGINAL A");
      const tx = new ReleaseTransaction(root);
      fs.writeFileSync(path.join(tx.media, "a.flac"), "NEW A");
      fs.writeFileSync(path.join(tx.media, "b.flac"), "NEW B");
      let calls = 0;
      expect(() => tx.publish(() => ++calls >= 3, "y")).toThrow();
      expect(fs.readFileSync(path.join(root, "a.flac"), "utf8")).toBe("ORIGINAL A");
      expect(fs.existsSync(path.join(root, "b.flac"))).toBe(false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it("recovers owned links after simulated process crash", () => {
    const root = testRoot();
    try {
      fs.writeFileSync(path.join(root, "user.flac"), "USER MUSIC");
      const tx = new ReleaseTransaction(root);
      const source = path.join(tx.media, "crashed.flac");
      fs.writeFileSync(source, "PARTIAL NEW RELEASE");
      const target = path.join(root, "crashed.flac");
      const manifestFile = path.join(tx.folder, "manifest.json");
      const data = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      data.state = "publishing";
      data.items.push({ source: "crashed.flac", target });
      fs.writeFileSync(manifestFile, JSON.stringify(data));
      fs.linkSync(source, target);
      ReleaseTransaction.recover(root);
      expect(fs.existsSync(target)).toBe(false);
      expect(fs.readFileSync(path.join(root, "user.flac"), "utf8")).toBe("USER MUSIC");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
