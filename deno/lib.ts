import { toFileUrl } from "https://deno.land/std@0.158.0/path/mod.ts";
let DLURL: URL;
let local: boolean;
let download_lib: URL;

if (import.meta.url.startsWith("file://")) {
  local = true;
  download_lib = new URL("http://localhost");
} else {
  local = false;
  download_lib = await (await import("../utils/download_lib.ts")).default;
}
const askPerm = async (): Promise<void> => {
  if ((await Deno.permissions.query({ name: "write" })).state !== "granted") {
    console.info(
      `We need to download the library to use this module, please grant write permission to Deno.`,
    );
    await Deno.permissions.request({
      name: "write",
      path: Deno.cwd(),
    });
  }
};
const currentPath = local ? import.meta.url : toFileUrl(Deno.cwd() + "/");
const dirpath = local ? "../dist/" : "./dist/";
switch (Deno.build.os) {
  case "windows":
    DLURL = new URL(dirpath + "ftl.dll", currentPath);
    break;
  case "linux":
    DLURL = new URL(
      dirpath + `libftl${(Deno.build.arch === "aarch64" ? "_aarch64" : "")}.so`,
      currentPath,
    );
    break;
  case "darwin": {
    DLURL = new URL(
      dirpath +
        `libftl${(Deno.build.arch === "aarch64" ? "_aarch64" : "")}.dylib`,
      currentPath,
    );
    break;
  }
}
const symbols = {
  start: {
    parameters: ["buffer", "u32", "function", "u32", "buffer"],
    result: "pointer",
    callback: true,
  },
  recv: {
    parameters: ["pointer", "buffer", "buffer", "buffer"],
    nonblocking: true,
    result: "u32",
  },
  session: {
    parameters: ["pointer", "buffer", "u32", "buffer", "buffer"],
    result: "u32",
  },
  send: {
    parameters: [
      "pointer",
      "buffer",
      "u32",
      "buffer",
      "u32",
      "u16",
      "u32",
      "buffer",
    ],
    result: "void",
    callback: true,
  },
  clients_count: {
    parameters: ["pointer"],
    result: "u32",
  },
  clients: {
    parameters: ["pointer", "buffer"],
    result: "u32",
  },
} as Record<string, Deno.ForeignFunction>;
if (!local) {
  const remoteLIb = await fetch(download_lib, {
    headers: {
      Accept: "application/octet-stream",
    },
  });
  const remoteBuffer = new Uint8Array(await remoteLIb.arrayBuffer());
  let dirs = false;
  try {
    const dir = Deno.statSync(`./dist`);
    if (dir.isDirectory) {
      dirs = true;
      Deno.statSync(DLURL);
      const file = Deno.readFileSync(DLURL);
      const localhash = await crypto.subtle.digest("SHA-1", file);
      const remotehash = await crypto.subtle.digest(
        "SHA-1",
        remoteBuffer,
      );
      const localhashHex = Array.from(new Uint8Array(localhash)).map((b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
      const remotehashHex = Array.from(new Uint8Array(remotehash)).map((b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
      if (localhashHex !== remotehashHex) {
        await askPerm();
        Deno.writeFileSync(DLURL, remoteBuffer);
      }
    } else {
      dirs = false;
      throw "";
    }
  } catch {
    await askPerm();
    if (!dirs) {
      Deno.mkdirSync(`./dist`, { recursive: false });
    }
    Deno.writeFileSync(DLURL, remoteBuffer, {
      create: true,
      mode: 0o755,
    });
  }
  console.log(`Downloaded library to ${DLURL}`);
}
let library: Deno.DynamicLibrary<typeof symbols>;

try {
  library = Deno.dlopen(DLURL, symbols);
} catch (e) {
  throw e.message;
}
export default library;
