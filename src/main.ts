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

  const packageJSON = await webcontainerInstance.fs.readFile(
    "package.json",
    "utf-8"
  );
  console.log(packageJSON);

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
  if (terminalEl != null) {
    terminal.open(terminalEl);
  }

  const exitCode = await installDependencies(terminal);
  if (exitCode !== 0) {
    throw new Error("Installation failed");
  }

  async function installDependencies(terminal: Terminal) {
    // Install dependencies
    const installProcess = await webcontainerInstance.spawn("npm", ["install"]);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    // Wait for install command to exit
    return installProcess.exit;
  }

  async function startDevServer(terminal: Terminal) {
    // Run `npm run start` to start the Express app
    const serverProcess = await webcontainerInstance.spawn("npm", [
      "run",
      "start",
    ]);

    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    const iframeEl = document.querySelector("iframe");

    // Wait for `server-ready` event
    webcontainerInstance.on("server-ready", (port, url) => {
      iframeEl!.src = url;
    });
  }

  async function writeIndexJS(content: string) {
    await webcontainerInstance.fs.writeFile("/index.js", content);
  }

  startDevServer(terminal);
});
