import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Per-release staging and ownership-verified rollback.
 * The staging directory is created on the same filesystem as final media.
 * Hard links publish without overwriting unexpected concurrent files.
 */
interface Item {
  source: string;
  target: string;
  backup?: string;
}
interface Manifest {
  owner: "deemix-release-transaction";
  id: string;
  state: "staging" | "publishing" | "committed";
  items: Item[];
}
const within = (root: string, filename: string) => {
  const relative = path.relative(root, filename);
  return relative === "" || (!relative.startsWith(".."+path.sep) &&
    relative !== ".." && !path.isAbsolute(relative));
};
function atomicJson(filename: string, value: unknown) {
  const tmp = filename + "." + randomUUID() + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(value), "utf8");
    fs.renameSync(tmp, filename);
  } finally { fs.rmSync(tmp, { force: true }); }
}
function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    if (dirent.isSymbolicLink()) throw new Error("Symlink in staged download");
    const filename = path.join(root, dirent.name);
    if (dirent.isDirectory()) result.push(...walk(filename));
    else if (dirent.isFile()) result.push(filename);
    else throw new Error("Unsupported file in staged download");
  }
  return result;
}
export class ReleaseTransaction {
  readonly dest: string;
  readonly folder: string;
  readonly media: string;
  private readonly manifestFile: string;
  private manifest: Manifest;

  constructor(destination: string, id: string = randomUUID(), recovering = false) {
    if (!/^[\da-f-]{36}$/i.test(id)) throw new Error("Invalid release ID");
    this.dest = path.resolve(destination);
    this.folder = path.join(this.dest, ".deemix-incomplete", id);
    this.media = path.join(this.folder, "media");
    this.manifestFile = path.join(this.folder, "manifest.json");
    if (recovering) {
      this.manifest = JSON.parse(fs.readFileSync(this.manifestFile, "utf8"));
      if (this.manifest.id !== id || this.manifest.owner !== "deemix-release-transaction" ||
          !Array.isArray(this.manifest.items)) throw new Error("Untrusted transaction");
    } else {
      fs.mkdirSync(path.dirname(this.folder), { recursive: true });
      fs.mkdirSync(this.folder);
      fs.mkdirSync(this.media);
      this.manifest = { owner: "deemix-release-transaction", id, state: "staging", items: [] };
      this.save();
    }
  }
  private save() { atomicJson(this.manifestFile, this.manifest); }
  private target(relative: string) {
    const target = path.resolve(this.dest, relative);
    if (!within(this.dest, target) || within(this.folder, target)) throw new Error("Unsafe target path");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!within(fs.realpathSync(this.dest), fs.realpathSync(path.dirname(target))))
      throw new Error("Output directory symlink escapes destination");
    return target;
  }
  rollback() {
    if (this.manifest.state === "committed") {
      fs.rmSync(this.folder, { recursive: true, force: true });
      return;
    }
    for (const item of [...this.manifest.items].reverse()) {
      const source = path.resolve(this.media, item.source);
      if (!within(this.media, source) || item.target !== this.target(path.relative(this.dest, item.target)))
        throw new Error("Corrupt transaction journal");
      if (fs.existsSync(source) && fs.existsSync(item.target)) {
        const a = fs.statSync(source), b = fs.statSync(item.target);
        if (a.dev === b.dev && a.ino === b.ino) fs.unlinkSync(item.target);
      }
      if (item.backup && fs.existsSync(item.backup)) {
        if (fs.existsSync(item.target)) throw new Error("Cannot restore backup: target replaced externally");
        fs.renameSync(item.backup, item.target);
      }
    }
    fs.rmSync(this.folder, { recursive: true, force: true });
  }
  publish(isCancelled: () => boolean, overwrite: string) {
    const sources = walk(this.media);
    if (!sources.some(file => /\.(flac|mp3|mp4|m4a)$/i.test(file))) {
      throw new Error("No completed audio files in release");
    }
    this.manifest.state = "publishing";
    this.save();
    try {
      for (const source of sources) {
        if (isCancelled()) throw new Error("Release stopped");
        const rel = path.relative(this.media, source);
        let target = this.target(rel);
        if (fs.existsSync(target) && overwrite === "b") {
          const ext = path.extname(target), stem = target.slice(0, target.length - ext.length);
          let candidate = "";
          for (let n = 1; n <= 10000; n++) {
            candidate = stem + " (" + n + ")" + ext;
            if (!fs.existsSync(candidate)) break;
          }
          target = this.target(path.relative(this.dest, candidate));
          if (fs.existsSync(target)) throw new Error("Keep-both target exhausted");
        } else if (fs.existsSync(target) && overwrite !== "y") {
          // Never remove or retag preexisting media during release rollback.
          continue;
        }
        const backup = fs.existsSync(target) ? path.join(this.folder, "backup", rel) : undefined;
        this.manifest.items.push({ source: rel, target, backup });
        this.save(); // Durable intent precedes every filesystem mutation.
        if (backup) {
          fs.mkdirSync(path.dirname(backup), { recursive: true });
          fs.renameSync(target, backup);
        }
        fs.linkSync(source, target); // Creates a new hard link; EEXIST fails.
      }
      if (isCancelled()) throw new Error("Release stopped");
      this.manifest.state = "committed";
      this.save();
      try { fs.rmSync(this.folder, { recursive: true, force: true }); }
      catch { /* Startup recovery cleans committed staging without rollback. */ }
    } catch (error) {
      this.rollback();
      throw error;
    }
  }
  static recover(destination: string) {
    const parent = path.join(path.resolve(destination), ".deemix-incomplete");
    if (!fs.existsSync(parent)) return;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[\da-f-]{36}$/i.test(entry.name)) continue;
      if (fs.existsSync(path.join(parent, entry.name, "manifest.json"))) {
        new ReleaseTransaction(destination, entry.name, true).rollback();
      }
    }
  }
}
