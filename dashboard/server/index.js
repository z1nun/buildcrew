/**
 * Buildcrew Dashboard Server
 *
 * Zero-dep Node HTTP server with SSE. Tails .claude/dashboard/events.jsonl
 * and pushes new lines to any connected browser.
 *
 * Endpoints:
 *   GET  /              static — dashboard/client/index.html
 *   GET  /events        SSE stream (replay backlog then live tail)
 *   POST /emit          body = DashboardEvent JSON, appends to jsonl
 *   GET  /health        { ok: true, clients: n }
 *
 * Intentionally zero dependencies: uses node:http, node:fs, node:fs/promises.
 */

import http from "node:http";
import { promises as fsp, createReadStream, watchFile, unwatchFile } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION } from "../shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.resolve(__dirname, "..", "client");

const DEFAULT_PORT = 3737;

/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

/** Active claude -p subprocess (only one at a time) */
let activeCommand = null;
/** Subscribers to command output stream */
const cmdClients = new Set();

/**
 * Create server.
 * @param {{ cwd?: string, port?: number }} opts
 */
export function createServer(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const port = opts.port ?? DEFAULT_PORT;
  const eventsDir = path.join(cwd, ".claude", "dashboard");
  const eventsFile = path.join(eventsDir, "events.jsonl");

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
      if (req.method === "GET" && pathname === "/health") {
        return json(res, 200, { ok: true, clients: sseClients.size, schemaVersion: SCHEMA_VERSION });
      }

      if (req.method === "GET" && pathname === "/events") {
        return await handleSSE(req, res, eventsFile);
      }

      if (req.method === "POST" && pathname === "/emit") {
        return await handleEmit(req, res, eventsDir, eventsFile);
      }

      if (req.method === "POST" && pathname === "/command") {
        return await handleCommandStart(req, res, cwd);
      }

      if (req.method === "GET" && pathname === "/command-stream") {
        return await handleCommandStream(req, res);
      }

      if (req.method === "GET" && pathname === "/project") {
        return json(res, 200, {
          path: cwd,
          name: path.basename(cwd),
        });
      }

      if (req.method === "POST" && pathname === "/command/cancel") {
        return await handleCommandCancel(req, res);
      }

      if (req.method === "GET") {
        return await serveStatic(res, pathname);
      }

      return text(res, 405, "method not allowed");
    } catch (err) {
      console.error("[dashboard] unhandled:", err);
      return text(res, 500, "internal error");
    }
  });

  return {
    start() {
      return new Promise((resolve) => {
        server.listen(port, () => resolve({ port, eventsFile }));
      });
    },
    stop() {
      for (const c of sseClients) c.end();
      sseClients.clear();
      for (const c of cmdClients) c.end();
      cmdClients.clear();
      unwatchFile(eventsFile);
      if (activeCommand?.child) {
        try { activeCommand.child.kill("SIGTERM"); } catch {}
      }
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

// -------- handlers --------

/** @param {http.IncomingMessage} req @param {http.ServerResponse} res @param {string} eventsFile */
async function handleSSE(req, res, eventsFile) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 3000\n\n`);
  sseClients.add(res);

  // 1. Replay backlog
  try {
    await fsp.access(eventsFile);
    const content = await fsp.readFile(eventsFile, "utf8");
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) res.write(`data: ${line}\n\n`);
  } catch {
    // file doesn't exist yet — that's fine, stream stays open
  }

  // 2. Live tail (single watcher shared across clients via closure)
  startTail(eventsFile);

  req.on("close", () => {
    sseClients.delete(res);
  });
}

let tailing = false;
let lastSize = 0;
function startTail(eventsFile) {
  if (tailing) return;
  tailing = true;

  // seed lastSize to current file length (already replayed above)
  fsp.stat(eventsFile).then((st) => {
    lastSize = st.size;
  }).catch(() => { lastSize = 0; });

  watchFile(eventsFile, { interval: 250 }, async (curr, prev) => {
    if (curr.size <= prev.size) {
      // truncation or no growth — reset
      lastSize = curr.size;
      return;
    }
    const from = lastSize || prev.size;
    lastSize = curr.size;
    try {
      await new Promise((resolve, reject) => {
        const stream = createReadStream(eventsFile, { start: from, encoding: "utf8" });
        let buf = "";
        stream.on("data", (chunk) => (buf += chunk));
        stream.on("end", () => {
          const lines = buf.split("\n").filter(Boolean);
          for (const line of lines) {
            for (const c of sseClients) c.write(`data: ${line}\n\n`);
          }
          resolve();
        });
        stream.on("error", reject);
      });
    } catch (err) {
      console.error("[dashboard] tail read error:", err);
    }
  });
}

/** @param {http.IncomingMessage} req @param {http.ServerResponse} res @param {string} dir @param {string} file */
async function handleEmit(req, res, dir, file) {
  const body = await readBody(req);
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return json(res, 400, { error: "invalid JSON" });
  }
  if (!event || typeof event.type !== "string") {
    return json(res, 400, { error: "event.type required" });
  }
  if (!event.at) event.at = new Date().toISOString();

  await fsp.mkdir(dir, { recursive: true });
  await fsp.appendFile(file, JSON.stringify(event) + "\n", "utf8");
  return json(res, 200, { ok: true });
}

/** @param {http.ServerResponse} res @param {string} pathname */
async function serveStatic(res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  const full = path.join(CLIENT_DIR, rel);
  if (!full.startsWith(CLIENT_DIR)) return text(res, 403, "forbidden");
  try {
    const stat = await fsp.stat(full);
    if (!stat.isFile()) return text(res, 404, "not found");
    const ext = path.extname(full).toLowerCase();
    const ctype = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    }[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": ctype, "Cache-Control": "no-cache" });
    createReadStream(full).pipe(res);
  } catch {
    return text(res, 404, "not found");
  }
}

// -------- command handlers --------

/**
 * Spawn `claude -p "<prompt>" --output-format stream-json`, pipe output
 * to /command-stream subscribers as SSE events.
 *
 * Safety: one active command at a time. User-triggered only.
 */
async function handleCommandStart(req, res, cwd) {
  if (activeCommand) {
    return json(res, 409, {
      error: "another command is running",
      id: activeCommand.id,
      started_at: activeCommand.startedAt,
    });
  }
  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: "invalid JSON" }); }
  const prompt = String(parsed?.prompt ?? "").trim();
  if (!prompt) return json(res, 400, { error: "prompt required" });

  const id = `cmd-${Date.now()}`;
  let child;
  try {
    // --output-format stream-json gives one JSON per line (tool calls, text deltas, etc)
    // --verbose keeps system init events. --dangerously-skip-permissions not used.
    child = spawn("claude", [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
    ], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    return json(res, 500, { error: `spawn failed: ${err.message}` });
  }

  activeCommand = { id, child, startedAt: Date.now(), prompt };

  // Notify clients that a command just started
  broadcastCmd({ type: "command.started", id, prompt, at: new Date().toISOString() });

  // Pipe stdout: parse line-by-line, forward JSON objects
  let outBuf = "";
  child.stdout.on("data", (chunk) => {
    outBuf += chunk.toString("utf8");
    const lines = outBuf.split("\n");
    outBuf = lines.pop() ?? "";
    for (const line of lines) forwardLine(line, "out");
  });

  let errBuf = "";
  child.stderr.on("data", (chunk) => {
    errBuf += chunk.toString("utf8");
    const lines = errBuf.split("\n");
    errBuf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      broadcastCmd({ type: "command.stderr", id, line });
    }
  });

  child.on("close", (code) => {
    if (outBuf.trim()) forwardLine(outBuf, "out");
    if (errBuf.trim()) broadcastCmd({ type: "command.stderr", id, line: errBuf });
    broadcastCmd({
      type: "command.finished",
      id,
      exit_code: code,
      at: new Date().toISOString(),
      duration_s: Math.round((Date.now() - activeCommand.startedAt) / 1000),
    });
    activeCommand = null;
  });

  child.on("error", (err) => {
    broadcastCmd({
      type: "command.error",
      id,
      message: err.message,
      code: err.code ?? null,
      at: new Date().toISOString(),
    });
    activeCommand = null;
  });

  return json(res, 202, { id, startedAt: activeCommand.startedAt });
}

function forwardLine(line, channel) {
  if (!line.trim()) return;
  let payload;
  try { payload = JSON.parse(line); }
  catch { payload = { raw: line }; }
  broadcastCmd({ type: `command.${channel}`, id: activeCommand?.id, payload });
}

function broadcastCmd(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const c of cmdClients) {
    try { c.write(data); } catch {}
  }
}

async function handleCommandStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  cmdClients.add(res);

  // Tell newly connected client about any in-flight command
  if (activeCommand) {
    res.write(`data: ${JSON.stringify({
      type: "command.active",
      id: activeCommand.id,
      prompt: activeCommand.prompt,
      startedAt: activeCommand.startedAt,
    })}\n\n`);
  }
  req.on("close", () => cmdClients.delete(res));
}

async function handleCommandCancel(req, res) {
  if (!activeCommand) return json(res, 200, { ok: true, idle: true });
  try {
    activeCommand.child.kill("SIGTERM");
    return json(res, 200, { ok: true, id: activeCommand.id });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

// -------- utils --------

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function text(res, code, body) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
