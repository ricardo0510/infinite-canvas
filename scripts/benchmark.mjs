import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const count = Math.max(1, Math.min(3000, Number(process.argv[2] ?? 500) || 500));
const port = Number(process.env.BENCH_PORT ?? 4199);
const debugPort = Number(process.env.BENCH_DEBUG_PORT ?? 9333);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function killTree(child) {
  if (!child) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await wait(500);
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error("Chrome/Edge not found. Set CHROME_PATH to a Chromium executable.");
  }

  console.log(`[bench] building production bundle...`);
  const built = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: useShell });
  if (built.status !== 0) throw new Error("Build failed.");

  console.log(`[bench] starting preview on http://localhost:${port} ...`);
  const preview = spawn(
    npm,
    ["run", "preview", "--", "--port", String(port), "--strictPort"],
    { stdio: "ignore", shell: useShell },
  );

  let chrome;
  let ws;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "infinite-canvas-bench-"));

  try {
    await waitForServer(`http://localhost:${port}/`);

    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profile}`,
        "--window-size=1440,900",
        `http://localhost:${port}/?bench=${count}`,
      ],
      { stdio: "ignore" },
    );

    let target;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) =>
          response.json(),
        );
        target = list.find(
          (item) => item.type === "page" && item.url.startsWith(`http://localhost:${port}`),
        );
        if (target) break;
      } catch {
        // keep waiting
      }
      await wait(250);
    }
    if (!target) throw new Error("Could not connect to the benchmark page.");

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let nextId = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const mouse = (type, x, y, buttons) =>
      send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });

    await send("Runtime.enable");
    await send("Page.enable");

    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        ready = await evaluate(
          `document.documentElement.dataset.bench === ${JSON.stringify(String(count))}`,
        );
      } catch {
        ready = false;
      }
      if (ready) break;
      await wait(250);
    }
    if (!ready) throw new Error("Benchmark canvas did not become ready.");
    await wait(800);

    const setup = Number(await evaluate("document.documentElement.dataset.benchReady"));
    const renderedNodes = await evaluate('document.querySelectorAll(".react-flow__node").length');
    const renderedEdges = await evaluate('document.querySelectorAll(".react-flow__edge").length');

    await evaluate(`(() => {
      window.__benchMetrics = { frames: 0, longTasks: 0 };
      const tick = () => {
        window.__benchMetrics.frames += 1;
        window.__benchMetrics.raf = requestAnimationFrame(tick);
      };
      window.__benchMetrics.raf = requestAnimationFrame(tick);
      try {
        new PerformanceObserver((list) => {
          window.__benchMetrics.longTasks += list.getEntries().length;
        }).observe({ entryTypes: ["longtask"] });
      } catch {}
    })()`);

    const measure = async (duration) => {
      await evaluate(
        "window.__benchMetrics.frames = 0; window.__benchMetrics.started = performance.now();",
      );
      await wait(duration);
      return evaluate(`({
        frames: window.__benchMetrics.frames,
        elapsed: performance.now() - window.__benchMetrics.started,
      })`);
    };

    const idle = await measure(1500);

    const nodeRect = await evaluate(`(() => {
      const element = document.querySelector(".react-flow__node");
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x + 5), y: Math.round(rect.y + 5) };
    })()`);
    let drag = { frames: 0, elapsed: 0 };
    if (nodeRect) {
      await evaluate(
        "window.__benchMetrics.frames = 0; window.__benchMetrics.started = performance.now();",
      );
      await mouse("mouseMoved", nodeRect.x, nodeRect.y, 0);
      await wait(60);
      await mouse("mousePressed", nodeRect.x, nodeRect.y, 1);
      await mouse("mouseMoved", nodeRect.x + 2, nodeRect.y, 1);
      for (let step = 0; step < 60; step++) {
        const x = nodeRect.x + Math.round(Math.sin(step / 5) * 70);
        const y = nodeRect.y + Math.round(Math.cos(step / 7) * 40);
        await mouse("mouseMoved", x, y, 1);
        await wait(25);
      }
      await mouse("mouseReleased", nodeRect.x, nodeRect.y, 0);
      drag = await evaluate(`({
        frames: window.__benchMetrics.frames,
        elapsed: performance.now() - window.__benchMetrics.started,
      })`);
    }

    const longTasks = await evaluate("window.__benchMetrics.longTasks");
    const heap = await evaluate(
      "performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null",
    );
    const fcp = await evaluate(
      'performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null',
    );

    const fps = (sample) => (sample.elapsed > 0 ? (sample.frames / sample.elapsed) * 1000 : 0);

    console.log("");
    console.log("Infinite Canvas benchmark");
    console.log(`  nodes:          ${count} (${count - 1} edges)`);
    console.log(`  rendered DOM:   ${renderedNodes} nodes / ${renderedEdges} edges`);
    console.log(`  setup:          ${Number.isFinite(setup) ? setup : "?"} ms`);
    console.log(`  first paint:    ${fcp ? Math.round(fcp) : "?"} ms`);
    console.log(`  idle:           ${fps(idle).toFixed(1)} fps (${idle.frames} frames)`);
    console.log(`  drag:           ${fps(drag).toFixed(1)} fps (${drag.frames} frames)`);
    console.log(`  long tasks:     ${longTasks}`);
    console.log(`  JS heap:        ${heap == null ? "n/a" : `${heap} MB`}`);
  } finally {
    if (ws) ws.close();
    killTree(chrome);
    killTree(preview);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[bench] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
