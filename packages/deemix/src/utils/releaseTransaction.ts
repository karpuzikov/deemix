import {
  existsSync, lstatSync, linkSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, renameSync, rmSync, rmdirSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const PREFIX = ".deemix-incomplete-";
const MARKER = ".deemix-release-stage.json";

type StageState = {
  version: number;
  destination: string;
  pid: number;
  phase: "staging" | "publishing" | "complete";
};

function stageRelative(root: string, candidate: string): string {
  const rel = relative(root, resolve(candidate));
  if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error("Release output escapes its staging directory");
  }
  return rel;
}

function filesUnder(dir: string, sub = ""): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(join(dir, sub), { withFileTypes: true })) {
    const rel = join(sub, entry.name);
    if (rel === MARKER) continue;
    if (entry.isSymbolicLink()) throw new Error("Release staging contains a symlink");
    if (entry.isDirectory()) results.push(...filesUnder(dir, rel));
    else if (entry.isFile()) results.push(rel);
    else throw new Error("Release staging contains an unsupported file type");
  }
  return results;
}

function prepareParent(root: string, rel: string, created: string[]): void {
  const parts = dirname(rel).split(sep).filter(part => part && part !== ".");
  let directory = root;
  for (const part of parts) {
    if (part === "..") throw new Error("Invalid output path");
    directory = join(directory, part);
    if (existsSync(directory)) {
      // lstat, not stat: a symlink must never redirect publication.
      if (!lstatSync(directory).isDirectory()) {
        throw new Error("Unsafe destination directory: " + directory);
      }
    } else {
      mkdirSync(directory);
      created.push(directory);
    }
  }
}

function sameHardlink(staged: string, published: string): boolean {
  try {
    const a = lstatSync(staged), b = lstatSync(published);
    return a.isFile() && b.isFile() && a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}

function rollbackLinks(stage: string, root: string): void {
  // Only undo files proved to be HARDLINKS to this owned release stage.
  // Never infer ownership from filename or delete a preexisting destination.
  for (const rel of filesUnder(stage)) {
    const staged = join(stage, rel), final = join(root, rel);
    if (sameHardlink(staged, final)) unlinkSync(final);
  }
}

function marker(stage: string): string { return join(stage, MARKER); }
function saveState(stage: string, state: StageState): void {
  const temporary = join(stage, ".deemix-stage-state.tmp");
  writeFileSync(temporary, JSON.stringify(state));
  renameSync(temporary, marker(stage));
}
function readState(stage: string): StageState | null {
  try {
    const data: StageState = JSON.parse(readFileSync(marker(stage), "utf8"));
    return data?.version === 1 &&
      ["staging", "publishing", "complete"].includes(data.phase) &&
      typeof data.destination === "string" && Number.isInteger(data.pid) ? data : null;
  } catch {
    return null;
  }
}

export class ReleaseTransaction {
  readonly destination: string;
  readonly stage: string;
  private state: StageState;
  private committed = false;

  constructor(destination: string) {
    this.destination = resolve(destination);
    mkdirSync(this.destination, { recursive: true });
    this.stage = mkdtempSync(join(this.destination, PREFIX));
    this.state = { version: 1, destination: this.destination,
      pid: process.pid, phase: "staging" };
    saveState(this.stage, this.state);
  }

  finalPath(stagedFile: string): string {
    return join(this.destination, stageRelative(this.stage, stagedFile));
  }

  publish(): void {
    const files = filesUnder(this.stage);
    if (!files.length) throw new Error("An empty release cannot be published");

    // Refuse collisions rather than ever deleting/overwriting preexisting music.
    // Includes album artwork, lyrics, logs and playlist files.
    for (const rel of files) {
      const target = join(this.destination, rel);
      if (existsSync(target)) throw new Error("Existing release file must be preserved: " + target);
      let parent = dirname(target);
      while (parent !== this.destination && parent !== dirname(parent)) {
        if (existsSync(parent) && !lstatSync(parent).isDirectory()) {
          throw new Error("Unsafe destination parent: " + parent);
        }
        parent = dirname(parent);
      }
    }

    this.state.phase = "publishing";
    saveState(this.stage, this.state);
    const created: string[] = [];
    try {
      for (const rel of files) {
        prepareParent(this.destination, rel, created);
        // Hardlink keeps the original inside this private stage as proof of ownership.
        // Each file is created atomically and the whole batch is rolled back on failure.
        linkSync(join(this.stage, rel), join(this.destination, rel));
      }
      this.state.phase = "complete";
      saveState(this.stage, this.state);
      this.committed = true;
    } catch (error) {
      rollbackLinks(this.stage, this.destination);
      for (const dir of created.reverse()) {
        try { rmdirSync(dir); } catch { /* Don't disturb unrelated files. */ }
      }
      throw error;
    }
  }

  dispose(): void {
    if (!existsSync(this.stage)) return;
    if (!this.committed && this.state.phase === "publishing") {
      rollbackLinks(this.stage, this.destination);
    }
    rmSync(this.stage, { recursive: true, force: true });
  }
}

export function recoverReleaseTransactions(destination: string): void {
  const root = resolve(destination);
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(PREFIX)) continue;
    const stage = join(root, entry.name);
    const state = readState(stage);
    if (!state || state.destination !== root) continue;
    if (state.pid === process.pid) continue;
    try {
      process.kill(state.pid, 0);
      continue; // Keep another running instance's private stage.
    } catch (error: any) {
      if (error?.code !== "ESRCH") continue;
    }
    if (state.phase === "publishing") rollbackLinks(stage, root);
    rmSync(stage, { recursive: true, force: true });
  }
}
