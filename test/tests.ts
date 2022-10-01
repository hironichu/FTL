import {
  assert,
  // assertEquals,
  // assertIsError,
  fail,
} from "https://deno.land/std@0.158.0/testing/asserts.ts";
// import { Socket } from "../deno/socket.ts";
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

Deno.test("Socket", {
  sanitizeOps: false,
  sanitizeResources: false,
  sanitizeExit: false,
  ignore: true,
}, (_t): void => {
  // const sock = new Socket();
  // await sock.close();
  // await t.step({
  //   name: "New Socket",
  //   fn: () => {
  //     const sock = new Socket();
  //     sock.listen({
  //       addr: "0.0.0.0",
  //       port: 1234,
  //       public: "192.168.1.69",
  //     });
  //     assertEquals(sock instanceof Socket, true, "instanceof Socket");
  //   },
  // });
  // await t.step({
  //   name: "Listen",
  //   fn: async () => {
  //     await sock.listen({
  //       addr: "0.0.0.0",
  //       port: 9565,
  //       public: "192.168.1.69",
  //     });
  //     assertEquals(sock.ptr === 0n, false, "Pointer not set");
  //   },
  //   sanitizeResources: false,
  //   sanitizeOps: false,
  //   sanitizeExit: false,
  // });
  // await t.step({
  //   name: "Valid Session Description",
  //   fn: async () => {
  //     const validSDP = `v=0
  //     o=- 4904239798171709660 2 IN IP4 127.0.0.1
  //     s=-
  //     t=0 0
  //     a=group:BUNDLE 0
  //     a=extmap-allow-mixed
  //     a=msid-semantic: WMS
  //     m=application 9 UDP/DTLS/SCTP webrtc-datachannel
  //     c=IN IP4 0.0.0.0
  //     a=ice-ufrag:RmQU
  //     a=ice-pwd:W7brWjRyj27Zl+VuWP1EAUiw
  //     a=ice-options:trickle
  //     a=fingerprint:sha-256 45:DF:14:5D:AC:25:96:B1:57:49:6A:DE:C7:FA:EE:0B:73:29:A4:BC:71:3E:F2:E4:76:28:19:9D:25:4E:5D:9C
  //     a=setup:actpass
  //     a=mid:0
  //     a=sctp-port:5000
  //     a=max-message-size:262144`;
  //     const res = await sock.session(validSDP);
  //     assertEquals(
  //       res instanceof Error,
  //       true,
  //       "The result is an Error and it shouldn't.",
  //     );
  //   },
  // });
  // await t.step({
  //   name: "Invalid Session Description",
  //   fn: async () => {
  //     const invalidSDP = `Invalid session string.`;
  //     const res = await sock.session(invalidSDP);
  //     assertIsError(
  //       res,
  //       Error,
  //       "error streaming the incoming SDP descriptor: not all SDP fields provided",
  //     );
  //   },
  // });
  // sock!.close(1);
  // t.step({
  //   name: "Closing socket",
  //   fn: () => {
  //     assertEquals(sock!.ptr === 0n, true, "The PTR is not 0n");
  //   },
  // });
  // assert(true);
});

//TODO(@hironichu)
// Deno.test("Sending Data", { ignore: true }, (): void => {});
// Deno.test("Receiving Data", { ignore: true }, (): void => {});
