// deno-lint-ignore-file
// deno-fmt-ignore-file
class Game {
  canvas = document.getElementById("debugCanvas");
  ctx = null;
  state = false;
  RADIUS = 10;
  x = 720 / 2;
  y = 480 / 2;
  color = `rgb(${Math.floor(Math.random() * 255)}, ${
    Math.floor(Math.random() * 255)
  }, ${Math.floor(Math.random() * 255)})`;
  mouseLock = false;
  timing = {
    now: performance.now(),
    last: performance.now(),
    delta: 0,
    deltaTime: 0,
    fps: 75,
    fpsInterval: 1000 / 75,
    serverFPS: 0,
    currentFps: 0,
    ping: 0,
  };
  players = new Map();
  server_state = null;
  constructor() {
    this.ctx = this.canvas.getContext("2d");
    this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
      this.canvas.mozRequestPointerLock ||
      this.canvas.webkitRequestPointerLock;
    document.exitPointerLock = document.exitPointerLock ||
      document.mozExitPointerLock ||
      document.webkitExitPointerLock;
    document.addEventListener(
      "pointerlockchange",
      this.lockChangeAlert.bind(this),
      false,
    );
    document.addEventListener(
      "mozpointerlockchange",
      this.lockChangeAlert.bind(this),
      false,
    );
    document.addEventListener(
      "webkitpointerlockchange",
      this.lockChangeAlert.bind(this),
      false,
    );
    this.canvas.onclick = () => {
      this.canvas.requestPointerLock();
    };
    requestAnimationFrame(this.update.bind(this));
  }
  update() {
    this.timing.now = performance.now();
    if (this.timing.last + this.timing.fpsInterval <= this.timing.now) {
      this.timing.delta = (this.timing.now - this.timing.last) / 1000;
      this.timing.last = this.timing.now;
      this.timing.currentFps = Math.round(1 / this.timing.delta);
      this.#draw();
    }
    if (performance.now() - this.timing.last < this.timing.fpsInterval - 4) {
      requestAnimationFrame(this.update.bind(this));
    } else {
      queueMicrotask(this.update.bind(this));
    }
  }
  lockChangeAlert() {
    if (document.pointerLockElement === this.canvas) {
      // console.log('The pointer lock status is now locked');
      this.mouseLock = true;
      document.addEventListener("mousemove", this.getMouse.bind(this), false);
    } else {
      this.mouseLock = false;
      // console.log('The pointer lock status is now unlocked');
      document.removeEventListener(
        "mousemove",
        this.getMouse.bind(this),
        false,
      );
    }
  }
  getMouse(e) {
    if (this.state && this.mouseLock) {
      this.x += e.movementX;
      this.y += e.movementY;
      if (this.x < this.RADIUS) {
        this.x = this.RADIUS;
      }
      if (this.x > 720 - this.RADIUS) {
        this.x = 720 - this.RADIUS;
      }
      if (this.y < this.RADIUS) {
        this.y = this.RADIUS;
      }
      if (this.y > 480 - this.RADIUS) {
        this.y = 480 - this.RADIUS;
      }
      //send the new position to the server
      this.sendPosition();
    }
  }
  sendPosition() {
    //get the position/color and send it to the server
    const data = {
      type: "position",
      data: {
        id: this.id,
        x: this.x,
        y: this.y,
        color: this.color,
      },
    };
    this.rtc.send(JSON.stringify(data));
  }
  #draw() {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = "black";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      //print the Local FPS to the top left corner
      this.ctx.fillStyle = "white";
      this.ctx.font = "15px Arial";
      this.ctx.fillText(`FPS: ${this.timing.currentFps}`, 10, 20);
      //print the this.serverFPS on the other corner
      if (this.state) {
        this.ctx.fillText(
          `Server TickRate: ${this.timing.serverFPS}`,
          720 - 140,
          20,
        );
        //draw the ping on the right corner
        this.ctx.fillText(`Ping: ${this.timing.ping}ms`, 720 - 75, 40);
        //Draw the cursor as a random color
        this.ctx.fillStyle = this.color;
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.RADIUS, 0, 2 * Math.PI);
        this.ctx.fill();
        //draw all the other players
        if (this.players.size > 0) {
          this.players.forEach((player) => {
            this.ctx.fillStyle = player.color;
            this.ctx.beginPath();
            this.ctx.arc(player.x, player.y, this.RADIUS, 0, 2 * Math.PI);
            this.ctx.fill();
          });
        }
      }
    }
  }
  decoder = new TextDecoder("utf-8");
  decode = (data) => {
    return this.decoder.decode(data);
  };
  checkServerState() {
    if (this.server_state === null) {
      //request the server state
    }
  }
  rtc = {
    onmessage: (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case "tick":
          {
            this.timing.serverFPS = msg.data;
            //compare the msg.when to Date.now() and get the ping in ms, if the ping is lower than 1ms show 0.value
            this.timing.ping = Math.round(Date.now() - msg.when);
          }
          break;
        case "new_player":
          {
            console.log("new player");
            //create a new player if it doesnt exist
            if (!this.players.has(msg.data.id)) {
              this.players.set(msg.data.id, {
                x: msg.data.x,
                y: msg.data.y,
                color: msg.data.color,
                time: msg.data.time,
              });
            }
          }
          break;
        case "position":
          {
            //update the position of the player
            if (this.players.has(msg.data.id)) {
              this.players.set(msg.data.id, msg.data);
            }
          }
          break;
        case "server_state":
          {
            //check if server state is defined, if not set it
            if (this.server_state === null) {
              const players = msg.data.players;
              if (players.length > 0) {
                players.forEach((player) => {
                  this.players.set(player.id, player);
                });
              }
              this.server_state = {
                tick: msg.data.tick,
                time: msg.data.time,
              };
            } else {
              //check the curent server state and the new server state, if time is more than 1 second, set the new state and send a acknowledge to the server
              if (Date.now() - this.server_state.time > 1000) {
                this.server_state = msg.data;
                this.rtc.send(JSON.stringify({
                  type: "acknowledge",
                  data: {
                    time: Date.now(),
                  },
                }));
              }
            }
          }
          break;
        case "remove_player":
          {
            console.log("player disconnected");
            //remove the player from the players list
            if (this.players.has(msg.id)) {
              this.players.delete(msg.id);
            }
          }
          break;
      }
    },
    onerror: (e) => {
      this.state = false;
    },
    encode: (data) => {
      return new TextEncoder().encode(data);
    },
    onopen: (e) => {
      this.state = true;
      //send current state, color,x,y, time
      this.rtc.send(JSON.stringify({
          type: "init_state",
          data: { color: this.color, x: this.x, y: this.y, time: Date.now() },
        }),
      );
    },
    onclose: (e) => {
      this.state = false;
    },
    send: (e) => {},
  };
}

export default Game;
