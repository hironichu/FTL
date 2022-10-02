#![feature(vec_into_raw_parts)]
#[warn(unused_imports)]
#[warn(unused_variables)]
pub mod executor;
pub mod urls;
pub mod util;
use core::panic;
use futures_util::{pin_mut, select, FutureExt};
use serde::{Deserialize, Serialize};
use serde_json::Error;
use std::ffi::CString;
use std::net::SocketAddr;
use urls::ServerAddrs;
use util::{parse_server_url, url_to_socket_addr};
use webrtc_unreliable::{ErrorMessage, MessageType, SenderMessage, Server};
static mut SEND_FN: Option<
  extern "C" fn(Box<Result<SenderMessage, ErrorMessage>>, Box<Option<CString>>),
> = None;
static mut DEBUG: bool = false;

/// A struct that holds the necessary information to set up a WebRTC Server
/// and start listening for incoming connections.
#[derive(Serialize, Deserialize)]
pub struct SocketEndpoint {
  rtc_addr: String,
  rtc_endpoint: String,
}

///
/// Socket Struct
///
pub struct Socket {
  /// The innter Server object
  pub server: Option<Server>,
  /// The current MessageType
  pub message_type: Option<MessageType>,
  /// Sender to send messages to the server
  to_client_sender: Option<flume::Sender<(SocketAddr, Box<[u8]>, Option<MessageType>)>>,
  /// Receiver to receive messages from the server
  to_client_receiver: Option<flume::Receiver<(SocketAddr, Box<[u8]>, Option<MessageType>)>>,
  from_client_sender: Option<flume::Sender<(SocketAddr, Box<[u8]>, Option<MessageType>)>>,
  from_client_receiver: Option<flume::Receiver<(SocketAddr, Box<[u8]>, Option<MessageType>)>>,
  pub state: Option<bool>,
}
///
///
/// Implementation of the Socket struct
///
///
impl Socket {
  /// Creates a new Socket object
  /// @param addrs: The addrs to listen on
  /// @param receiver_fn: An External callback function to send data to Deno
  /// @param sender_fn: An External callback function to receive data from Deno
  pub fn new(
    addrs: ServerAddrs,
    sender_fn: Option<
      extern "C" fn(Box<Result<SenderMessage, ErrorMessage>>, Box<Option<CString>>),
    >,
  ) -> Result<Self, u32> {
    unsafe {
      SEND_FN = sender_fn;
    };
    match Server::new(
      addrs.webrtc_listen_addr,
      url_to_socket_addr(&parse_server_url(&addrs.public_webrtc_url)),
      sender_fn,
    ) {
      Ok(server) => {
        let (to_client_sender, to_client_receiver) = flume::unbounded();
        let (from_client_sender, from_client_receiver) = flume::unbounded();
        Ok(Self {
          state: Some(true),
          server: Some(server),
          message_type: Some(MessageType::Binary),
          to_client_sender: Some(to_client_sender),
          to_client_receiver: Some(to_client_receiver),
          from_client_sender: Some(from_client_sender),
          from_client_receiver: Some(from_client_receiver),
        })
      }
      Err(_) => Err(1),
    }
  }
  pub fn set_message_type(&mut self, message_type: MessageType) {
    self.message_type = Some(message_type);
  }
  pub fn rtc_session(&self, sdp: &str) -> Result<String, u32> {
    if self.server.is_none() {
      return Err(2);
    } else {
      let mut session = self.server.as_ref().unwrap().session_endpoint();
      let result = session.session_request(sdp);
      match result {
        Ok(sess) => Ok(sess),
        Err(_) => Err(12),
      }
    }
  }
  pub fn empty() -> Self {
    Self {
      state: None,
      server: None,
      message_type: None,
      to_client_sender: None,
      to_client_receiver: None,
      from_client_sender: None,
      from_client_receiver: None,
    }
  }
  pub fn receive(&'static mut self) {
    if self.server.is_none() {
      return;
    } else {
      executor::spawn(async move {
        enum Next {
          FromClientMessage(Result<(SocketAddr, Box<[u8]>, MessageType), ErrorMessage>),
          ToClientMessage((SocketAddr, Box<[u8]>, Option<MessageType>)),
        }
        loop {
          if !self.state.unwrap() {
            return;
          }
          let rtc_server = match self.server.as_mut() {
            Some(server) => server,
            None => return,
          };
          let next = {
            let to_client_receiver_next = self
              .to_client_receiver
              .as_ref()
              .unwrap()
              .recv_async()
              .fuse();
            let from_client_message_receiver_next = rtc_server.recv().fuse();
            pin_mut!(to_client_receiver_next);
            pin_mut!(from_client_message_receiver_next);
            select! {
              from_client_result = from_client_message_receiver_next => {
                  Next::FromClientMessage(
                      match from_client_result {
                          Ok(msg) => {
                              Ok((msg.remote_addr, msg.message.as_ref().into(), msg.message_type))
                          }
                        Err(err) => {
                            Err(ErrorMessage {
                                code: 1,
                                message: CString::new(format!("{}", err)).unwrap(),
                            })
                        }
                      }
                    )
                }
                to_client_message = to_client_receiver_next => {
                  Next::ToClientMessage(to_client_message.unwrap())
              }
            }
          };
          match next {
            Next::FromClientMessage(from_client_message) => match from_client_message {
              Ok((address, payload, message_type)) => {
                let sender = self.from_client_sender.as_ref().unwrap();
                let _ = sender
                  .send_async((address, payload, Some(message_type)))
                  .await;
              }
              Err(_) => {}
            },
            Next::ToClientMessage((address, payload, messagetype)) => {
              let msgtype = if messagetype.is_some() {
                messagetype.unwrap()
              } else {
                self.message_type.unwrap()
              };
              match rtc_server.send(&payload, msgtype, &address).await {
                Err(_) => unsafe {
                  if SEND_FN.is_some() {
                    SEND_FN.unwrap()(
                      Box::new(Err(ErrorMessage {
                        code: 400,
                        message: CString::new(format!("{}:{}", address.ip(), address.port()))
                          .unwrap(),
                      })),
                      Box::new(Some(CString::new("socket_send_error").unwrap())),
                    );
                  }
                },
                Ok(_) => drop(payload),
              }
            }
          };
        }
      })
      .detach();
    }
  }
  pub async fn rtc_disconnect(&mut self, addr: &SocketAddr) -> Result<bool, u32> {
    if self.server.is_none() {
      Err(2) //Server is none.
    } else {
      let res = self.server.as_mut().unwrap().disconnect(addr).await;
      match res {
        Ok(_) => Ok(true),
        Err(_) => {
          // let error_message = format!("{}", error);
          Err(5) // 5 error while disconnect
        }
      }
    }
  }
  pub fn rtc_active_clients(&self) -> u32 {
    if self.server.is_none() {
      return 0;
    } else {
      self.server.as_ref().unwrap().active_clients() as u32
    }
  }
  pub fn rtc_connected_clients(&mut self) -> Result<String, u32> {
    if self.server.is_none() {
      Err(2)
    } else {
      let (ptr, len, _) = self
        .server
        .as_mut()
        .unwrap()
        .connected_clients()
        .into_raw_parts();
      let clients = unsafe { ::std::slice::from_raw_parts(ptr as *mut &str, len).join(",") };
      Ok(clients)
    }
  }
  pub fn rtc_is_connected(&self, addr: &SocketAddr) -> Result<bool, u32> {
    if self.server.is_none() {
      Err(2)
    } else {
      Ok(self.server.as_ref().unwrap().is_connected(addr))
    }
  }
  pub fn rtc_is_listening(&self) -> bool {
    self.server.is_none()
  }
  pub fn rtc_close(&mut self) -> bool {
    self.server.as_mut().unwrap().shutdown();
    drop(self.server.as_mut());
    self.state = Some(false);
    unsafe {
      SEND_FN = None;
    }
    true
  }
  pub fn sender(&self) -> flume::Sender<(SocketAddr, Box<[u8]>, Option<MessageType>)> {
    return self.to_client_sender.as_ref().unwrap().clone();
  }

  pub fn rtc_state(&mut self, addr: SocketAddr) -> Result<(i64, i64, i64), u32> {
    if self.server.is_none() {
      Err(2)
    } else {
      let server = self.server.as_mut().unwrap();
      let activity = server.client_activity(&addr);
      if activity.is_none() {
        Err(2)
      } else {
        let activity = activity.unwrap();
        Ok((activity.0 as i64, activity.1 as i64, activity.2 as i64))
      }
    }
  }
}

#[no_mangle]
pub unsafe extern "C" fn start(
  endpoint_buf: *const u8,
  len: u32,
  send_func: Option<extern "C" fn(Box<Result<SenderMessage, ErrorMessage>>, Box<Option<CString>>)>,
  debug: u32,
  res: *mut u32,
) -> *mut Socket {
  let buf = ::std::slice::from_raw_parts(endpoint_buf, len as usize);
  let endpoint_json: Result<SocketEndpoint, Error> = serde_json::from_slice(buf);
  if send_func.is_none() {
    *res = 1;
    return Box::into_raw(Box::new(Socket::empty()));
  }
  DEBUG = if debug == 1 { true } else { false };
  match endpoint_json {
    Ok(json) => {
      let addr = json.rtc_addr.parse::<SocketAddr>();
      match addr {
        Ok(addr) => {
          let server_address = ServerAddrs::new(addr, &json.rtc_endpoint);
          let server = Socket::new(server_address, send_func);
          match server {
            Ok(server) => {
              let server_ptr = Box::into_raw(Box::new(server));
              let server = &mut *server_ptr;
              server.receive();
              *res = 0;
              server_ptr
            }
            Err(_) => {
              *res = 2;
              Box::into_raw(Box::new(Socket::empty()))
            }
          }
        }
        Err(_) => {
          *res = 3;
          return Box::into_raw(Box::new(Socket::empty()));
        }
      }
    }
    Err(_) => {
      *res = 4;
      Box::into_raw(Box::new(Socket::empty()))
    }
  }
}

#[no_mangle]
pub unsafe extern "C" fn recv(
  srv: *mut Socket,
  buff: *mut u8,
  addrbuff: *mut u8,
  addrlength: *mut u32,
) -> u32 {
  let server = &mut *srv;
  if !server.state.unwrap() {
    return 2;
  }
  match server.from_client_receiver.as_ref().unwrap().recv() {
    Ok((addr, message, _)) => {
      let addrslice = addr.to_string();
      let buff = ::std::slice::from_raw_parts_mut(buff, message.len());
      let addr = ::std::slice::from_raw_parts_mut(addrbuff, addrslice.len());
      buff.copy_from_slice(&message);
      addr.copy_from_slice(addrslice.as_bytes());
      *addrlength = addrslice.len() as u32;
      message.len() as u32
    }
    Err(_) => 0,
  }
}

#[no_mangle]
pub unsafe extern "C" fn send(
  srv: *mut Socket,
  msgbuff: *const u8,
  msglen: u32,
  addrbuff: *const u8,
  addrlen: u32,
  port: u16,
  message_type: u32,
  state: *mut u32,
) {
  let server = &mut *srv;
  let buf = ::std::slice::from_raw_parts(msgbuff, msglen as usize);
  let addr = {
    let addrstr = ::std::slice::from_raw_parts(addrbuff, addrlen as usize);
    ::std::str::from_utf8(addrstr).unwrap()
  };
  let addr = SocketAddr::new(addr.parse().unwrap(), port);
  let message_type = match message_type {
    0 => MessageType::Text,
    1 => MessageType::Binary,
    _ => server.message_type.unwrap(),
  };
  match server.to_client_sender.as_ref().unwrap().send((
    addr,
    buf.to_vec().into_boxed_slice(),
    Some(message_type),
  )) {
    Ok(_) => {
      *state = 0;
    }
    Err(err) => {
      *state = 13; //Cannot send message
      SEND_FN.unwrap()(
        Box::new(Err(ErrorMessage {
          code: -1,
          message: CString::new(err.to_string()).unwrap(),
        })),
        Box::new(Some(CString::new("message_send_error").unwrap())),
      )
    }
  }
}

#[no_mangle]
pub unsafe extern "C" fn session(
  srv_ptr: *mut Socket,
  sdp_offer: *const u8,
  offer_size: u32,
  respbuffer: *mut u8,
  state: *mut u32,
) -> u32 {
  let socket = &mut *srv_ptr;
  let sdp = {
    let buf = ::std::slice::from_raw_parts(sdp_offer, offer_size as usize);
    ::std::str::from_utf8(buf).unwrap()
  };
  let response = socket.rtc_session(sdp);
  match response {
    Ok(response) => {
      let respbuffer = ::std::slice::from_raw_parts_mut(respbuffer, response.len());
      respbuffer.copy_from_slice(response.as_bytes());
      *state = 0;
      respbuffer.len() as u32
    }
    Err(err) => {
      *state = err; // Error SEssion
      0
    }
  }
}
#[no_mangle]
pub unsafe extern "C" fn state(
  srv_ptr: *mut Socket,
  addr: *const u8,
  len: usize,
  port: u16,
  value: *mut i64,
) -> u32 {
  let server = &mut *srv_ptr;
  let addr = {
    let addrstr = ::std::slice::from_raw_parts(addr, len as usize);
    ::std::str::from_utf8(addrstr).unwrap()
  };
  let addr = SocketAddr::new(addr.parse().unwrap(), port);
  let value = ::std::slice::from_raw_parts_mut(value, 3);
  let res = server.rtc_state(addr);
  match res {
    Ok((v1, v2, v3)) => {
      value[0] = v1;
      value[1] = v2;
      value[2] = v3;
      0
    }
    Err(_) => 17, //
  }
}

#[no_mangle]
pub unsafe fn is_connected(
  srv: *mut Socket,
  addr: *const u8,
  len: usize,
  port: u16,
  state: *mut u32,
) -> bool {
  let server = &mut *srv;
  let addr = {
    let addrstr = ::std::slice::from_raw_parts(addr, len as usize);
    ::std::str::from_utf8(addrstr).unwrap()
  };
  let addr = SocketAddr::new(addr.parse().unwrap(), port);
  let res = server.rtc_is_connected(&addr);
  match res {
    Ok(res) => res,
    Err(err) => {
      *state = err;
      false
    }
  }
}
#[no_mangle]
pub unsafe extern "C" fn clients_count(srv: *mut Socket) -> u32 {
  let server = &mut *srv;
  let result = server.rtc_connected_clients();
  match result {
    Ok(res) => res.len() as u32,
    Err(_) => 0,
  }
}

#[no_mangle]
pub unsafe extern "C" fn clients(srv: *mut Socket, clients: *mut u8) -> u32 {
  let server = &mut *srv;
  let result = server.rtc_connected_clients();
  match result {
    Ok(res) => {
      let amount = res.len();
      let newbuf = ::std::slice::from_raw_parts_mut(clients, amount);
      newbuf.copy_from_slice(res.as_bytes());
      0
    }
    Err(_) => 0,
  }
}
///
/// Destroy the server
///
/// This function destroys the Server pointer and frees the memory.
/// It should be called when the server is no longer needed.
/// # Arguments
/// * `srv_ptr` - The pointer to the server
/// * `addr` - The pointer to the address
/// * `len` - The length of the address
/// # Returns
/// * void
/// # Safety
/// * The pointer must be valid
///
#[no_mangle]
pub unsafe extern "C" fn rtc_close(srv: *mut Socket) {
  let server = &mut *srv;
  server.rtc_close();
  drop(server);
}
