use std::{default::Default, net::SocketAddr};

#[derive(Clone)]
pub struct ServerAddrs {
  pub webrtc_listen_addr: SocketAddr,
  pub public_webrtc_url: String,
}

impl ServerAddrs {
  pub fn new(webrtc_listen_addr: SocketAddr, public_webrtc_url: &str) -> Self {
    ServerAddrs {
      webrtc_listen_addr,
      public_webrtc_url: public_webrtc_url.to_string(),
    }
  }
}

impl Default for ServerAddrs {
  fn default() -> Self {
    ServerAddrs::new(
      "0.0.0.0:5659"
        .parse()
        .expect("could not parse WebRTC data address/port"),
      "http://127.0.0.1:5659",
    )
  }
}
