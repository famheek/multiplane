var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.use(require('express').static('.'))


var sockets = [];
var players = [];

var planes = [];
var bullets = [];
var addedBullets = [];
var removedBullets = [];

var colors = [0xff0000, 0x00ff33, 0x0000ff, 0xff00ff, 0x00FFFF];
var colorI = 0;

var t = 0;
var dt = 1 / 80;

let idCounter = 0;

let config = {
  worldSize: 300,
  bulletSpeed: 250
}

function pushBullet(b) {
  bullets.push(b);
  addedBullets.push(b);
}

function removeBullet(bulletI) {
  removedBullets.push(bullets[bulletI].id);
  bullets.splice(bulletI, 1);
}

function sq(x) {
  return x * x;
}

function resetPlane(player, plane) {
  let r = (player.index % colors.length) / colors.length * 2 * Math.PI;
  let initR = config.worldSize / 8 * 3;
  player.targetRot = r;
  plane.x = initR * Math.cos(r + Math.PI);
  plane.y = initR * Math.sin(r + Math.PI);
  plane.r = r;
  player.health = player.maxHealth;
}

function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    r *= 255;
    g *= 255;
    b *= 255;

    return (Math.round(r) << 24) | (Math.round(g) << 16) | Math.round(b);
    
}

io.on('connection', function(socket){
  console.log('a user connected');

  let playerI = sockets.length;
  let player = {
    socketId: socket.id,
    index: idCounter++,
    color: /* colors[sockets.length % colors.length]*/ HSVtoRGB( Math.random(), .8, .8),
    bulletTimer: 0,
    bulletTimeout: .5,
    speed: 150,
    rotSpeed: 5,
    maxHealth: 3,
    keys: {},
    targetRot: 0,
    touch: {shoot: false, dx: 0, dy: 0}
  };
  players.push(player);
  
  let plane = {
    id: idCounter++,
    color: player.color,
    radius: 5,
    x: 0, y: 0, z: 0,
    r: 0
  };
  planes.push(plane);

  resetPlane(player, plane);
  sockets.push(socket);
  socket.on('disconnect', function() {
    console.log('user disconnected', playerI);

    sockets.splice(playerI, 1);
    players.splice(playerI, 1);
    planes.splice(playerI, 1);
  });
  socket.on('keys', function(msg){
    // console.log('keys: ', msg);
    player.keys = msg;
  });
  socket.on('touch move', function(msg) {
    if (msg.dx !== undefined) {
      player.touch.dx = msg.dx;
      player.touch.dy = msg.dy;
    } else {
      player.touch.shoot = msg.shoot;
    }
    // console.log(player.touch);
  })
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});



function minmax(x, b) {
  return Math.max(Math.min(x, b), -b);
}

function rotateTo(f, t, s) {
  let diff = (t - f) % (2 * Math.PI);
  if (Math.abs(diff) > Math.PI) {
    diff = Math.PI - diff;
  }
  return f + minmax(diff, s);
}

function outofbounds(x) {
  return x > config.worldSize / 2 || x < -config.worldSize / 2;
}

function update() {
  t += dt;

  for (let i = 0; i < players.length; i++) {
    let player = players[i];
    let plane = planes[i];
    let keys = player.keys;
    let dx = player.touch.dx, dy = player.touch.dy;
    if (keys['left']) {
      dx -= 1;
    }
    if (keys['right']) {
      dx += 1;
    }
    if (keys['up']) {
      dy += 1;
    }
    if (keys['down']) {
      dy -= 1;
    }

    if (dx * dx + dy * dy > 0) {
      let angle = Math.atan2(dy, dx);
      targetRot = angle;
      
      let a = plane.r = rotateTo(plane.r, targetRot, player.rotSpeed * dt);

      plane.x = minmax(plane.x + player.speed * dt * Math.cos(a), config.worldSize / 2 - plane.radius);
      plane.y = minmax(plane.y + player.speed * dt * Math.sin(a), config.worldSize / 2 - plane.radius);
      
    }

    if ((keys['space'] || player.touch.shoot) && (t - player.bulletTimer) > player.bulletTimeout) {
      // console.log('bullet');
      player.bulletTimer = t;
      let a = plane.r;
      pushBullet({
        id: idCounter++,
        t: t - dt,
        x: plane.x + plane.radius * Math.cos(a),
        y: plane.y + plane.radius * Math.sin(a),
        r: a,
        speed: config.bulletSpeed
      });
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      let bullet = bullets[i];
      let x = bullet.x + bullet.speed * (t - bullet.t) * Math.cos(bullet.r);
      let y = bullet.y + bullet.speed * (t - bullet.t) * Math.sin(bullet.r);
      // console.log(x, y);
      if (outofbounds(x) || outofbounds(y)) {
        removeBullet(i);
        continue;
      }
      for (let j = 0; j < planes.length; j++) {
        let plane = planes[j];
        if (sq(plane.x - x) + sq(plane.y - y)  < sq(plane.radius)) {
          players[j].health -= 1;
          if (players[j].health <= 0) {
            resetPlane(players[j], plane);
          }
          removeBullet(i);
          break;
        }
      }
    }
  }

  let update = {t, config, players, planes, addedBullets, removedBullets};
  io.emit('update', update);
  addedBullets = [];
  removedBullets = [];

}


setInterval(update, dt * 1000);

