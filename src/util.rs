use crate::JsonRtcAddr;
use serde_json::Error;
use std::net::SocketAddr;
use url::Url;
pub fn parse_server_url(server_url_str: &str) -> Url {
  let url = Url::parse(server_url_str).expect("server_url_str is not a valid URL!");
  if let Some(path_segments) = url.path_segments() {
    let path_segment_count = path_segments.count();
    if path_segment_count > 1 {
      panic!("server_url_str must not include a path");
    }
  }
  if url.query().is_some() {
    panic!("server_url_str must not include a query string");
  }
  if url.fragment().is_some() {
    panic!("server_url_str must not include a fragment");
  }

  url
}

pub fn url_to_socket_addr(url: &Url) -> SocketAddr {
  const SOCKET_PARSE_FAIL_STR: &str = "could not get SocketAddr from input URL";

  match url.socket_addrs(|| match url.scheme() {
    "http" => Some(80),
    "https" => Some(443),
    _ => None,
  }) {
    Ok(addr_list) => {
      if addr_list.is_empty() {
        panic!("{}", SOCKET_PARSE_FAIL_STR);
      }
      return addr_list.first().expect(SOCKET_PARSE_FAIL_STR).clone();
    }
    Err(err) => {
      panic!("URL -> SocketAddr parse fails with: {:?}", err);
    }
  }
}

pub fn resolve_addr(addr: *const u8, len: usize) -> Result<JsonRtcAddr, Error> {
  let buf = unsafe { ::std::slice::from_raw_parts(addr, len) };
  let addr: Result<JsonRtcAddr, Error> = serde_json::from_slice(buf);
  addr
}
