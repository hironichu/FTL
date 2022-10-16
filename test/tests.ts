import {
  assert,
  assertEquals,
  fail,
} from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { Socket } from "../deno/mod.ts";
import { validHostPort, validIp } from "../deno/utils.ts";

Deno.test("Lib path (windows)", {
  ignore: Deno.build.os !== "windows",
}, (): void => {
  try {
    Deno.statSync("./dist/ftl.dll");
  } catch (e) {
    fail(e);
  }
});
Deno.test("Lib path (darwin) ", {
  ignore: Deno.build.os !== "darwin",
}, (): void => {
  try {
    Deno.statSync("./dist/libftl.dylib");
  } catch (e) {
    fail(e);
  }
});

Deno.test("Lib path (libnux) ", {
  ignore: (Deno.build.os !== "linux"),
}, (): void => {
  try {
    switch (Deno.build.arch) {
      case "x86_64":
        Deno.statSync("./dist/libftl.so");
        break;
      case "aarch64":
        Deno.statSync("./dist/libftl_aarch64.so");
    }
  } catch (e) {
    fail(e);
  }
});
Deno.test("IP check", {}, (): void => {
  let addr = "127.0.0.1;8498";
  assert(!validHostPort(addr), "validHostPort");
  addr = "0.0.0.0.0:1111";
  assert(!validIp(addr), "validHostPort");
});

await Deno.test("Socket", {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t): Promise<void> => {
  // const sock = new Socket();
  let sock: Socket;

  // await sock.close();
  const _defaultIP = Deno.networkInterfaces().find((iface) =>
    (iface.name === "eth0" || iface.name === "Ethernet" ||
      iface.name === "en0") && iface.family === "IPv4"
  )?.address;
  await t.step({
    name: "New Socket",
    fn: () => {
      sock = new Socket();
      assertEquals(sock instanceof Socket, true, "instanceof Socket");
    },
    sanitizeResources: false,
    sanitizeOps: false,
    sanitizeExit: false,
  });
  //   await t.step({
  //     name: "Listen",
  //     fn: async () => {
  //       await sock.listen({
  //         addr: "0.0.0.0",
  //         port: 1234,
  //         public: defaultIP || "127.0.0.1",
  //       });
  //       assertEquals(sock.ptr === 0n, false, "Pointer not set");
  //     },
  //     sanitizeResources: false,
  //     sanitizeOps: false,
  //     sanitizeExit: false,
  //   });
  //   await t.step({
  //     name: "Valid Session Description",
  //     fn: async () => {
  //       const validSDP = `v=0
  // o=- 2294297329490440913 2 IN IP4 127.0.0.1
  // s=-
  // t=0 0
  // a=group:BUNDLE 0
  // a=extmap-allow-mixed
  // a=msid-semantic: WMS
  // m=application 9 UDP/DTLS/SCTP webrtc-datachannel
  // c=IN IP4 0.0.0.0
  // a=ice-ufrag:LDqn
  // a=ice-pwd:zTOQ1htU7TNtQsbFODCVu/AQ
  // a=ice-options:trickle
  // a=fingerprint:sha-256 3C:64:C7:E9:54:F4:85:C5:27:C2:A1:C2:5C:4E:20:65:1F:BD:93:3B:ED:02:EF:BF:20:AA:55:9D:CC:45:5A:2E
  // a=setup:actpass
  // a=mid:0
  // a=sctp-port:5000
  // a=max-message-size:262144
  // `;
  //       const res = await sock.session(validSDP);
  //       assertEquals(sock.state, 0, "State is 0");
  //       assertEquals(
  //         res instanceof Error,
  //         false,
  //         "The result is an Error and it shouldn't.",
  //       );
  //     },
  //   });
  //   await t.step({
  //     name: "Closing socket",
  //     fn: async () => {
  //       await sock!.close();
  //       assertEquals(sock.ptr === 0n, true, "The PTR is not 0n");
  //     },
  //   });
});

//TODO(@hironichu)
// Deno.test("Sending Data", { ignore: true }, (): void => {});
// Deno.test("Receiving Data", { ignore: true }, (): void => {});
