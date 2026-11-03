import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const port = Number(process.env.E2E_PORT ?? 4198);
const debugPort = Number(process.env.E2E_DEBUG_PORT ?? 9334);
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

function connect(ws) {
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
  return { send, evaluate };
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error("Chrome/Edge not found. Set CHROME_PATH to a Chromium executable.");
  }

  console.log("[e2e] building production bundle...");
  const built = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: useShell });
  if (built.status !== 0) throw new Error("Build failed.");

  console.log(`[e2e] starting preview on http://localhost:${port} ...`);
  const preview = spawn(
    npm,
    ["run", "preview", "--", "--port", String(port), "--strictPort"],
    { stdio: "ignore", shell: useShell },
  );

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "infinite-canvas-e2e-"));
  let chrome;
  let ws;

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
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    let target;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) =>
          response.json(),
        );
        target = list.find((item) => item.type === "page");
        if (target) break;
      } catch {
        // keep waiting
      }
      await wait(250);
    }
    if (!target) throw new Error("Could not connect to the E2E page.");

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const { send, evaluate } = connect(ws);
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { sessionStorage.setItem("infinite-canvas:ai-agent:v1", JSON.stringify({ messages: [], modelId: "mock" })); } catch {}`,
    });
    await send("Page.navigate", { url: `http://localhost:${port}/` });

    const waitFor = async (expression, label, attempts = 120) => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          if (await evaluate(expression)) return;
        } catch {
          // page still loading
        }
        await wait(250);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };

    await waitFor('Boolean(document.querySelector(".agent-panel"))', "the agent panel");
    await waitFor(
      'document.querySelectorAll(".react-flow__node").length >= 2',
      "the demo canvas",
    );

    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll(".agent-suggestion")].find((item) =>
        item.textContent.includes("看板"),
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) throw new Error("Kanban suggestion not found.");
    await waitFor('Boolean(document.querySelector(".agent-plan"))', "the plan card");

    const executed = await evaluate(`(() => {
      const button = [...document.querySelectorAll(".agent-plan-actions button")].find((item) =>
        item.textContent.trim() === "执行",
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!executed) throw new Error("Execute button not found.");
    await waitFor('Boolean(document.querySelector(".agent-result"))', "the execution result");
    await waitFor(
      'document.querySelectorAll(".react-flow__node").length >= 5',
      "the inserted kanban nodes",
    );

    const undone = await evaluate(`(() => {
      const button = document.querySelector(".agent-result-actions button");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!undone) throw new Error("Undo button not found.");
    await waitFor(
      'document.querySelectorAll(".react-flow__node").length <= 2',
      "the canvas to be restored",
    );

    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await waitFor('!document.querySelector(".agent-panel")', "the panel to close");

    await evaluate(
      'window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))',
    );
    await waitFor('Boolean(document.querySelector(".agent-panel"))', "the panel to reopen");
    const focused = await evaluate(
      'document.activeElement?.classList.contains("agent-input") === true',
    );
    if (!focused) throw new Error("Agent input was not focused after Ctrl+K.");

    console.log("[e2e] AI Agent smoke test passed.");
  } finally {
    try {
      ws?.close();
    } catch {
      // ignore
    }
    killTree(chrome);
    killTree(preview);
    fs.rmSync(profile, { recursive: true, force: true });
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(`[e2e] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
