import { decode, encode, validHostPort, validIp, validPort } from "./utils.ts";
import library from "./lib.ts";
import { CODE_STATE, STATE } from "./dict.ts";
import { EventEmitter } from "./deps.ts";

export type SocketEndpoint = {
  rtc_addr: string;
  rtc_endpoint: string;
};
export type SessionDescription = {
  type: string;
  sdp: string;
};
export enum MessageType {
  Text = 0,
  Binary = 1,
}
/**
 * SocketEvent type
 * @message: SocketMessage
 */
type SocketEvents = {
  // Message Event
  message: [Uint8Array, Deno.NetAddr];
  // Send result Event
  event: [MessageEvent];
  // Error Event
  error: [ErrorEvent | string];
  // Close Event
  close: [CloseEvent];
};

/**
 * Socket class
 * @extends EventEmitter
 * @class Socket
 * @param {boolean} Debug - Enable debug mode
 *
 * @example
 * ```ts
 * const socket = new Socket();
 * socket.on("message", (message) => {
 *  console.log(message);
 * });
 * ```
 */
export class Socket extends EventEmitter<SocketEvents> {
  #SocketEndpoint?: SocketEndpoint;
  #PTR: Deno.PointerValue = null;
  #STATE = new Uint32Array(1);
  dec = decode;
  enc = encode;
  public get state(): number {
    return this.#STATE[0];
  }
  public get ptr(): Deno.PointerValue {
    return this.#PTR;
  }
  public get sender() {
    return this.#sender;
  }
  readonly #sender = new Deno.UnsafeCallback(
    {
      parameters: ["u32", "pointer", "u32"],
      result: "void",
    },
    (_code: unknown | number, buffer, buflen) => {
      const code = _code as STATE;
      if (buflen < 0) {
        return;
      }
      const pointer = Deno.UnsafePointerView.getArrayBuffer(
        buffer as unknown as NonNullable<Deno.PointerValue>,
        buflen,
      );
      const result = this.dec(new Uint8Array(pointer));
      if (code < 100) {
        this.emit(
          "error",
          result,
        );
      } else {
        this.emit(
          "event",
          new MessageEvent(CODE_STATE[code], { data: { info: result, code } }),
        );
      }
    },
  );
  readonly #LIB: typeof library;
  /**
   * The constructor of the Socket class.
   * @constructor Socket
   * @param debug {boolean}
   */
  constructor(public debug: boolean = false) {
    super();
    this.#LIB = library;
  }
  /**
   * Initiate a Session by sending a Session Description to the Socket.
   * @throws Error if the socket is not started
   * @throws Error if the library is not loaded
   * @returns {Promise<Socket>} a Promise of the Socket object after listening
   * @example
   * ```ts
   *  const socket = new Socket();
   *  await socket.listen({ addr: "0.0.0.0", port: 9565, public: "192.168.1.69" });
   *  /// Socket.listen return the Socket object, so you can call any method on it
   * ```
   * @see {@link https://ftl.ekko.pw/#session @Socket.session()}
   */
  public async listen(
    endpoint_config: { port: number; addr: string; public: string },
    ..._opts: unknown[]
  ): Promise<Socket> {
    if (!this.#LIB) throw new Error("Library not loaded");
    if (this.#PTR !== null) throw new Error("Socket already started");
    this.#SocketEndpoint = this.#endpoint(endpoint_config);
    const endpoint = encode(JSON.stringify(this.#SocketEndpoint));
    const startPTR = await this.#LIB!.symbols.start(
      endpoint,
      endpoint.byteLength,
      this.#sender.pointer,
      this.debug,
      this.#STATE,
    );

    if (this.#STATE[0] === 0) {
      this.#PTR = startPTR;
      this.#sender.ref();
      Promise.all([
        (async () => {
          const maxaddrlen = new Uint32Array(1);
          const buffer = new Uint8Array(1600);
          const addr = new Uint8Array(20);
          let nread = await this.#LIB.symbols.rtc_recv(
            this.#PTR,
            buffer,
            addr,
            maxaddrlen,
          );
          while (nread > 0) {
            if (this.ptr === null) return;
            const address = decode(addr.subarray(0, maxaddrlen[0])).split(":");
            this.emit("message", buffer.subarray(0, nread as number), {
              hostname: address[0],
              port: address[1],
              transport: "udp",
            } as unknown as Deno.NetAddr);
            nread = await this.#LIB.symbols.rtc_recv(
              this.#PTR,
              buffer,
              addr,
              maxaddrlen,
            );
          }
          return;
        })(),
      ]);
    }
    return this;
  }
  /**
   * Send a message to a client using their SockAddr
   * @throws Error if the socket is not started
   * @throws Error if the library is not loaded
   * @example
   * ```ts
   * const socket = new Socket();
   * socket.start({ port: 8080, addr: "127.0.0.7", public: "127.0.0.1" });
   * // Get any of the connected clients
   * const client = socket.clients[0];
   * // Send a message to the client
   * socket.send(client.addr, new TextEncoder().encode("Hello world"));
   * ```
   * @see {@link https://ftl.ekko.pw/#clients @Socket.clients}
   */
  public send(
    buf: Uint8Array | string,
    caddr: Deno.NetAddr,
    type = MessageType.Binary,
  ): void {
    if (this.#PTR === null) throw new Error("Socket not started");
    const addr = encode(caddr.hostname);
    if (typeof buf === "string") {
      buf = encode(buf);
      type = MessageType.Text;
    }
    try {
      this.#LIB!.symbols.rtc_send(
        this.#PTR,
        buf,
        buf.byteLength,
        addr,
        addr.byteLength,
        +caddr.port,
        type ?? MessageType.Binary,
        this.#STATE,
      );
    } catch (e) {
      console.error(Error, e);
      if (this.debug) {
        this.emit("error", new ErrorEvent("send_err", { error: e.message }));
      }
    }
  }
  /**
   * Initiate a Session by sending a Session Description to the Socket.
   * @throws Error if the socket is not started
   * @throws Error if the library is not loaded
   * @example
   * ```ts
   *  const socket = new Socket();
   *  await socket.listen({ addr: "0.0.0.0", port: 9565, public: "192.168.1.69" });
   *  const SessionDescription = `v=0
   *  o=- 89584520081040655 2 IN IP4 127.0.0.1
   *  s=-
   *  t=0 0
   *  a=group:BUNDLE 0
   *  a=extmap-allow-mixed
   *  a=msid-semantic: WMS
   *  m=application 9 UDP/DTLS/SCTP webrtc-datachannel
   *  c=IN IP4 0.0.0.0
   *  a=ice-ufrag:MlVD
   *  a=ice-pwd:UoxgC4QC8knSwqK1FWnJwbaL
   *  a=ice-options:trickle
   *  a=fingerprint:sha-256 9E:73:DB:BD:9C:50:9E:E9:D1:E9:59:E5:D4:80:9E:C5:9A:41:C9:08:8D:4E:70:00:71:4A:95:48:C2:21:23:47
   *  a=setup:actpass
   *  a=mid:0
   *  a=sctp-port:5000
   *  a=max-message-size:262144`;
   *  /// Pass the SessionDescription to the Socket
   *  const result = await socket.session(SessionDescription);
   *  /// Check the result
   *  if (!(result instanceof Error)) {
   *    const session = result.sdp;
   *    console.log(session);
   *  } else {
   *    //handing Error
   *  }
   * ```
   * @see {@link https://ftl.ekko.pw/#session @Socket.session()}
   */
  public session(offer: string): { type: "answer"; sdp: string } | Error {
    if (this.#PTR === null) throw new Error("Socket not started");
    const sdp_buf = encode(offer);
    const resbuf = new Uint8Array(2048);
    const result = this.#LIB.symbols.session(
      this.#PTR,
      sdp_buf,
      sdp_buf.length,
      resbuf,
      this.#STATE,
    );
    if (result === 0) {
      // if (this.state === 12) {
      //   return new Error("Session descriptor invalid");
      // }
      // return new Error("Unknown Session description error");
    }
    const data = resbuf.subarray(0, result as number);
    return {
      type: "answer",
      sdp: decode(data) as string,
    };
  }
  public clients_count(): number | Error {
    if (this.#PTR === null) throw new Error("Socket not started");
    // clients_count
    const result = this.#LIB.symbols.clients_count(this.#PTR);
    // console.log(result);
    return result as number;
  }
  public clients() {
    if (this.#PTR === null) throw new Error("Socket not started");
    const buffer = new Uint8Array(1024);
    const nread = this.#LIB.symbols.clients(this.#PTR, buffer);
    const result = buffer.subarray(0, nread as number);
    const data = decode(result).split(",");
    data.pop();
    return data.reduce((acc, v) => {
      const addr = v.split(":");
      return acc.add({
        hostname: addr[0],
        port: +addr[1],
        transport: "udp",
      });
    }, new Set<Deno.NetAddr>());
  }
  public async close() {
    if (this.#PTR === null) throw new Error("Socket not started");
    await this.#LIB.symbols.rtc_close(this.#PTR);
    this.#PTR = null;
    this.#sender.close();
    this.emit("close", new CloseEvent("close"));
    return true;
  }
  #endpoint(
    endpoint: { port: number; addr: string; public: string },
  ): SocketEndpoint {
    if (!this.#LIB) throw new Error("Library not loaded");
    if (!validPort(endpoint.port)) throw new Error("Invalid port");
    if (!validIp(endpoint.addr)) {
      throw new Error(`Invalid IP address: ${endpoint.addr}`);
    }
    if (!validHostPort(endpoint.addr + ":" + endpoint.port)) {
      throw new Error(`Invalid host: ${endpoint.addr}:${endpoint.port}`);
    }
    if (!validIp(endpoint.public)) {
      throw new Error(`Invalid IP address: ${endpoint.public}`);
    }
    const parsed_endpoint = {
      rtc_addr: `${endpoint.addr}:${endpoint.port}`,
      rtc_endpoint: `http://${endpoint.public}:${endpoint.port}`,
    };
    return parsed_endpoint as SocketEndpoint;
  }
}
export type ServerOptions = {
  host: string;
  port: number;
  public?: string;
  region?: string;
  mode: "core" | "region";
};

/**
 * RTCServer
 * Create and return a Socket server instance, after creation event will be emitted and can be captured
 * by using on() method
 *
 * @param options The options to create a server
 * @param debug Whether to enable debug mode
 * @returns {Socket} The created server
 *
 * ### Starting the server
 * @example
 * ```ts
 *  const ftl = await RTCServer({host:"127.0.0.1", port:9595});
 * ```
 *
 * ### Receiving Errors
 * The server does not emit Error unless it's critical or if the Debug mode is enabled.
 * this behavior is for optimization purpose, less message emitted means higher throughput to the messages reception.
 * @example
 * ```ts
 *  ftl.on("error", (error) => {
 *   console.error(error);
 *  });
 * ```
 *
 * ### Receiving Events
 * Any event that is not part of the Debug option will emit an event.
 * this can be used to capture new incoming connections before receiving a Message.
 * @example
 * ```ts
 *  ftl.on("event", (data) => {
 *   console.info(data);
 *  });
 * ```
 *
 * ### Receiving messages
 * Await for Messages to be received, the message is composed of an array [BufferSource, SockAddr]
 * The content is not decoded or copied, it's just a reference to the original buffer.
 * @example
 * ```ts
 *  ftl.on("message", (data) => {
 *   console.log(data);
 *  });
 * ```
 *
 * ### Sending messages
 * Send a message to a specific client, you can send Text or any Buffer source,
 * #### > Please note that any Text sent is encoded as Buffer before being actually sent, this option is for convenience.
 *
 * The default MessageType is Binary, but using a String will automatically encode it as Text.
 * @example
 * ```ts
 * const message = "Hello World";
 * const Clientaddr = {
 *  hostname: "127.0.0.1",
 *  port: 12345,
 * }
 * ftl.send(message, Clientaddr, MessageType.Text);
 * ```
 */
export const RTCServer = async (
  options: ServerOptions,
  debug = false,
): Promise<Socket> => {
  let s = new Socket(debug);
  s = await s.listen({
    addr: options.host,
    port: options.port,
    public: options.public ?? options.host,
  });
  return s;
};
