# <center>FTL </center>

FTL (Faster Than Light) is a non standard WebRTC implementation for Deno.

---
## <center>DISCLAMER</center>

```
Please note that this being Non standard means that using it will have drawbacks to normal WebRTC. it is made for fast communication and mostly testing purposes.
```
----

As of today there hasn't been any working WebRTC library for Deno, this is a first attempt at making one that is fast unreliable and usable.

---
## <center>Usage: </center>

```ts
import { RTCServer } from "https://deno.land/x/ftl/mod.ts"

const ip = Deno.networkInterfaces().find(iface => (iface.name === "eth0" || iface.name === "Ethernet" || iface.name === "en0") && iface.family === "IPv4")?.address;

//Starting the server
const ftl = await RTCServer({
  host: "0.0.0.0",
  port: 9595,
  public: ip ?? "127.0.0.1",
} as any, true);

//You can use any way you want to start a session,
//it can be a simple http server or a websocket server.
//On the client side you can start a WebRTC connection using the following code:
// let peer = new RTCPeerConnection({
//   iceCandidatePoolSize: 16,
//   bundlePolicy : "balanced"
// });
//
// let channel = peer.createDataChannel("data", {
//   ordered: false,
//   maxPacketLifeTime: 0,
//   maxRetransmits: 0,
// });
// .. The rest is standard datachannel processing, see /examples for more info.

//Thie method will save a new Session Descriptor for any incoming webrtc connection. the argument is a string.
const answer = ftl.session("...")
///answer = { type: "answer"; sdp: string }
//you can then send this pack to the browser and add it to the remote SessionDescription. (see )
// Listening for the different event
ftl.on("event", (evt) => {});
ftl.on("message", (data, addr) => {});
ftl.on("error", (closeEvent) => {});
//

// Send exemple
// Please use an existing client addr, the object is a Deno.NetAddr.
ftl.send("hello world", { hostname: "0.0.0.0", port: 12345, transport: "udp"}) //
```

---
Quick FAQ (Frequently Asked Questions):

1. "Unreliable?" : Yes, it uses the standard RTCP option `unreliable` in order to send messages that are not fragmented, each packet has a maximum ammount of 1256 bytes (could go higher but optimal), and packet that gets dropped are not sent again, thus the tag unreliable.

2. "Non standard?": This library does not include 90% of the WebRTC api, only the bare mimimum, "DataChannel". This is because re-implementing it is a big nono.



