export type STATE = number & 2 | 1001 | 1002 | 1003;

export const CODE_STATE = {
  2: "server_closed",
  1001: "client_datachannel_open",
  1002: "client_datachannel_timeout",
  1003: "client_datachannel_close",
} as Record<STATE & number, string>;
