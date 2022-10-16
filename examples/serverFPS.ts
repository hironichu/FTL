// deno-lint-ignore-file
// deno-fmt-ignore-file
import { serve } from "https://deno.land/std@0.158.0/http/server.ts";
import { parse } from "https://deno.land/std@0.158.0/flags/mod.ts";

const Arguments = parse(Deno.args);
import {RTCServer, MessageType} from "../deno/mod.ts";
// import { ErrorMessage, MessageType, SockAddr } from "../deno/types.ts";
const FPS = 30;

let tick = 0
let previous = performance.now()
const tickLengthMs = 1000 / FPS;
Deno.addSignalListener("SIGINT", () => {
  console.log("Closing server..");
  ftl.close();
  Deno.exit(0);
});

// if (!Arguments.ip) {
//   try {
//     Arguments.ip = Deno.networkInterfaces().find(iface => iface.name === "eth0")?.address
//   } catch {
//     throw new Error("Please provide an IP address");
//   }
// } 

const ftl = await RTCServer({
  host: "0.0.0.0",
  port: 9595,
  public: Deno.networkInterfaces().find(iface => (iface.name === "eth0" || iface.name === "Ethernet" || iface.name === "en0") && iface.family === "IPv4")?.address,
} as any, true);
const Engine = {} as any;
Engine.lastTime = 0;
Engine.requestAnimationFrame = (callback: Function, _: any) =>  {
	Engine.now = performance.now();
	Engine.nextTime = Math.max(Engine.lastTime, Engine.now);
	return setTimeout(function() { callback(Engine.lastTime = Engine.nextTime); }, Engine.nextTime - Engine.now);
};
Engine.cancelAnimationFrame = clearTimeout;
const getIDFromSTRAddr = (addr: string) => addr.replace(/\./g, "").replace(/:/g, "");
const getIDFromSockAddr = (addr: Deno.NetAddr) => getIDFromSTRAddr(addr.hostname + ":" + addr.port);
const players = new Map<string, Deno.NetAddr>();
const playerStates = new Map<string, {
  x: number,
  y: number,
  color: string,
  time: number,
}>();
ftl.on("event", (evt) => {
  // if (evt.data.code === 1) {
    const id = getIDFromSTRAddr(evt.data.info!); 
    if (evt.type === "client_datachannel_open") {
      console.log("Player connected", id);
      console.log(evt.data.info)
      const playerSock = {
        hostname: evt.data.info?.split(":")[0]!,
        port: Number(evt.data.info?.split(":")[1]),
      } as Deno.NetAddr;
      players.set(id, playerSock);
    } else if (evt.type === "client_datachannel_close") {
      console.log("Player disconnected", id);
      players.delete(id);
      playerStates.delete(id);
      broadcast(JSON.stringify({type: "remove_player", id}), MessageType.Text);
    } else if (evt.type === "client_datachannel_timeout") {
      console.log("Player timeout", id);
      players.delete(id);
      playerStates.delete(id);
      broadcast(JSON.stringify({type: "remove_player", id}), MessageType.Text);
    }
  // }
});
ftl.on("error", (err) => {
  const error = err as any;
  // if (error.context === "socket_send_error" ) {
  //   const id = getIDFromSTRAddr(error.message); 
  //   players.delete(id);
  //   playerStates.delete(id);
  //   //broadcast the event
  //   broadcast(JSON.stringify({data: "remove_player", id}), MessageType.Text);
  // } else if (error.context === "message_send_error") {
  //   const id = getIDFromSTRAddr(error.message); 
  //   console.log("Sending Error: Queue full");
  // }
})
const broadcast = (data: Uint8Array | string, type?: MessageType, exclude?: string[]) => {
  if (players.size === 0) return;
  Promise.all([[...players].filter(([id,]) => !exclude?.includes(id)).forEach(([,addr]) => {
    ftl.send(data, addr, type);
  })]);
};

const enc = new TextEncoder();
const dec = new TextDecoder();

// console.log(enc.encode(JSON.stringify(TestData)))
ftl.on("message", (data, addr) => {
  const msg = dec.decode(data);

  const id = getIDFromSockAddr(addr);
  try {
    const decmsg = JSON.parse(msg) as Record<string, any>;
    switch (decmsg.type ) {
      case "aknowledge": {
        console.log("Aknowledged");
      } break;
      case "position": {
        if (playerStates.has(id)) {
            playerStates.set(id, {
              x: decmsg.data.x,
              y: decmsg.data.y,
              color: decmsg.data.color,
              time: decmsg.data.time,
            });
            broadcast(JSON.stringify({
              type: "position",
              data:  {
                id,
                x: decmsg.data.x,
                y: decmsg.data.y,
                color: decmsg.data.color,
                time: decmsg.data.time,
              }
            }), MessageType.Text, [id]);
          // }
        }
      } break;
      case "init_state": {
        console.log("Init State", decmsg.data);
        if (!playerStates.has(id)) {
          broadcast(JSON.stringify({
            type: "new_player",
            data: {
              id: id,
              x: decmsg.data.x,
              y: decmsg.data.y,
              color: decmsg.data.color,
              time: decmsg.data.time,
            },
          }), MessageType.Text, [id]);
          ftl.send(JSON.stringify({
            type: "server_state",
            data: {
              players: [...playerStates].map(([id, state]) => ({ id, ...state })),
              time: Date.now(),
              tick: tick,
            },
          }), addr);
          playerStates.set(id, decmsg.data as any);
        } else {
          // playerStates.set(id, decmsg.data as any);
        }
      } break;
      case "ping": {
        // broadcast(JSON.stringify({
        //   type: "tick",
        //   data: Math.round(1 / delta),
        //   tick: tick,
        //   when: Date.now(),
        // }), MessageType.Text);
        //Get the time of the Player, Get the time of the Server, and calculate the difference and send it to the player, the player will calculate how long it took for the server to recieve the message and send it back
        
      } break;
    }
  } catch {}
  // console.log(msg);
  // if (msg.type === "fps") {
  //   console.log(msg.data);
  // }
})

//create a function to encode a Float32Array to Uint8Array uing DataView 
const encodeFloat32Array = (data: Float32Array) => {
  const buffer = new ArrayBuffer(data.length * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < data.length; i++) {
    view.setFloat32(i * 4, data[i], true);
  }
  return new Uint8Array(buffer);
}
Engine.loop = async () => {
  const now = performance.now();
  if (previous + tickLengthMs <= now) {
    const delta = (now - previous) / 1000;
    previous = now;
    // await Deno.stdout.write(enc.encode(`FPS ${Math.round(1 / delta)}\r`),);
    tick++;
  }

  if (performance.now() - previous < tickLengthMs - 4) {
    setTimeout(Engine.loop);
  } else {
    tick = 0;
    queueMicrotask(Engine.loop);
  }
}

Engine.loop();
serve((req) => {
  const requrl = new URL(req.url);
  //check upgrade websocket
  if (
    req.headers.has("upgrade") && req.headers.get("upgrade") === "websocket"
  ) {
    console.log("WS connected")
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onmessage = async ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.type) {
        if (msg.type === "offer") {
          const res = ftl.session(msg.data);
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
  else if (requrl.pathname.endsWith(".js")) {
    return new Response(Deno.readFileSync(new URL("./web" + requrl.pathname, import.meta.url)), {
      headers: {
        "content-type": "application/javascript",
        "cache-control": "no-cache",
      }
    });
  } else {
    
    return new Response(
      Deno.readTextFileSync(new URL("./web/demo_game.html", import.meta.url)).replaceAll("{{ip}}", Arguments.ip),
      {
        headers: {
          "content-type": "text/html",
          "cache-control": "no-cache",
        },
      },
    );
  }
}, { port: 9568});
