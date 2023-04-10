import "./style.css";
import { WebContainer } from "@webcontainer/api";
import { files } from "./file";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

document.querySelector("#app")!.innerHTML = `
  <div class="container">
    <div class="editor">
      <textarea>I am a textarea</textarea>
    </div>
    <div class="preview">
      <iframe src="loading.html"></iframe>
    </div>
  </div>
  <div class="terminal"></div>
`;

/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance: WebContainer;

window.addEventListener("load", async () => {
  // Call only once
  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(files);

  // Wait for `server-ready` event
  webcontainerInstance.on("server-ready", (port, url) => {
    const iframeEl = document.querySelector("iframe");

    if (iframeEl) {
      iframeEl.src = url;
    }
  });

  const textareaEl = document!.querySelector("textarea");
  if (textareaEl != null) {
    textareaEl.value = files["index.js"].file.contents;

    textareaEl.addEventListener("input", (e) => {
      writeIndexJS(textareaEl.value);
    });
  }

  const terminalEl: HTMLElement | null = document.querySelector(".terminal");
  const terminal = new Terminal({
    convertEol: true,
  });
  if (terminalEl) {
    terminal.open(terminalEl);
  }

  startShell(terminal);

  async function writeIndexJS(content: string) {
    await webcontainerInstance.fs.writeFile("/index.js", content);
  }

  async function startShell(terminal: Terminal) {
    const shellProcess = await webcontainerInstance.spawn("jsh");
    shellProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    const input = shellProcess.input.getWriter();
    terminal.onData((data) => {
      input.write(data);
    });

    return shellProcess;
  }
});
