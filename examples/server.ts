// deno-lint-ignore-file
// deno-fmt-ignore-file
import { serve } from "https://deno.land/std@0.167.0/http/server.ts";
import {RTCServer} from "../deno/mod.ts";
const ftl = await RTCServer({
  host: "0.0.0.0",
  port: 9595,
  public: Deno.networkInterfaces().find(iface => (iface.name === "eth0" || iface.name === "Ethernet" || iface.name === "en0") && iface.family === "IPv4")?.address ?? "127.0.0.1",
  mode: "core"
});

ftl.on("error", (error: any) => {
  console.error(error);
});

let i = 0;
let totalsize_recv = 0;
let total_sent_bytes = 0;
let sent = 0;

ftl.on("event", (data: any) => {
  // console.info(data);
});
ftl.on("message",async (data: Uint8Array, addr) => {
  ftl.send(data, addr);
  console.log(i++);
});
ftl.on("close", () => {
  console.log('Server closed')
})
serve((req) => {
  //check upgrade websocket
  if (
    req.headers.has("upgrade") && req.headers.get("upgrade") === "websocket"
  ) {
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onmessage = async ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.type) {
        if (msg.type === "offer") {
          const res = await ftl.session(msg.data);
          if (res instanceof Error) {
            console.log(res);
          } else {
            socket.send(JSON.stringify({
              type: "answer",
              data: res,
            }));
          }
        }
      }
    };
    return response;
  }
  return new Response(
    Deno.readTextFileSync(new URL("./web/demo.html", import.meta.url)),
    {
      headers: {
        "content-type": "text/html",
        "cache-control": "no-cache",
      },
    },
  );
}, { port: 9564 });