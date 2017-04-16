var scene, camera, renderer;
var geometry, material, mesh;

var keyboard	= new THREEx.KeyboardState();

var Box3 = THREE.Box3;
var Vector3 = THREE.Vector3;
 
var socket = io();

function myIndex() {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].socketId === socket.id) {
      return i;
    }
  }
  console.log('oops');
  return null;
}

function createPlaneMesh(plane) {
  let planeGeometry = new THREE.CircleGeometry(plane.radius, 3);
  let material = new THREE.MeshBasicMaterial( { color: plane.color, wireframe: true, wireframeLinewidth: 3 } );
  let mesh = new THREE.Mesh( planeGeometry, material );
  return mesh;
}

function createBounds(config) {
  let size = config.worldSize;
  let geometry = new THREE.PlaneBufferGeometry( size, size );
  let edges = new THREE.EdgesGeometry( geometry );
  let bounds = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0xffffff } ) );
  return bounds;
}

function createBulletMesh(bullet) {
  let mesh = new THREE.LineSegments( bulletGeom, bulletMaterial);
  mesh.rotation.z = bullet.r;
  return mesh;
}

function init() {
 
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
  camera.position.z = 100;
  
  bulletMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 5 });

  bulletGeom = new THREE.Geometry();
  bulletGeom.vertices.push(new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 5, 0, 0 ));


  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );

  document.body.appendChild( renderer.domElement );
}


let watchedKeys = ['left', 'right', 'up', 'down', 'space'];

let keysDown = {};

let prevState = null;
let state = null;

function updateKeys() {
  var keysUpdated = false;
    for (let key of watchedKeys) {
      let pressed = keyboard.pressed(key);
      if (keysDown[key] !== pressed) {
        keysDown[key] = pressed;
        keysUpdated = true;
      }
    }
    if (keysUpdated) {
      socket.emit('keys', keysDown);
    }
}

function animate() {
    requestAnimationFrame( animate );

    updateKeys();

    if (state != null && myIndex() !== null) {
      let myI = myIndex();
      let plane = state.planes[myI];

      camera.position.set(plane.x, plane.y, camera.position.z);
    }

    bullets.forEach((bullet) => {
      let bulletMesh = bulletMeshes[bullet.id];
      let x = bullet.x + bullet.speed * (state.t - bullet.t) * Math.cos(bullet.r);
      let y = bullet.y + bullet.speed * (state.t - bullet.t) * Math.sin(bullet.r);
      bulletMesh.position.set(x, y, 0);
    });
 
    renderer.render( scene, camera );
 
}

let planeMeshes = [];
let bulletMeshes = [];
let bullets = [];

socket.on('update', function(msg) {
  prevState = state;
  state = msg;

  if (state != null) {
    if (prevState == null) {
      scene.add(createBounds(state.config));
    }

    planeMeshes.forEach((mesh, meshId) => {
      if (!state.planes.some((p) => p.id === meshId)) {
        scene.remove(mesh);
        delete planeMeshes[meshId];
      }
    });

    for (let plane of state.planes) {
      if (!planeMeshes[plane.id]) {
        let planeMesh = createPlaneMesh(plane);
        scene.add(planeMesh);
        planeMeshes[plane.id] = planeMesh;
      }

      let planeMesh = planeMeshes[plane.id];
      planeMesh.position.set(plane.x, plane.y, plane.z);
      planeMesh.rotation.z = plane.r;
    }

    let addedBullets = state.addedBullets;
    let removedBullets = state.removedBullets;
    
    for (var i = 0; i < addedBullets.length; i++) {
      var bullet = addedBullets[i];
      let mesh = createBulletMesh(bullet);
      bulletMeshes[bullet.id] = mesh;
      bullets[bullet.id] = bullet;
      scene.add(mesh);
    }

    for (var i = 0; i < removedBullets.length; i++) {
      var bulletId = removedBullets[i];
      scene.remove(bulletMeshes[bulletId]);
      delete bulletMeshes[bulletId];
      delete bullets[bulletId];
    }

  }
});

init();
animate();

var el = document.getElementsByTagName("canvas")[0];
 el.addEventListener("touchstart", handleStart, false);
el.addEventListener("touchend", handleEnd, false);
el.addEventListener("touchcancel", handleEnd, false);
el.addEventListener("touchmove", handleMove, false);


let moveTouch = null;
let shootTouch = null;

function copyTouch(touch) {
  return { identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY };
}

function handleStart(evt) {
  evt.preventDefault();
  var touches = evt.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    let touch = touches[i];
    if (touch.pageX < window.innerWidth / 2) {
      moveTouch = copyTouch(touch);
    } else {
      shootTouch = copyTouch(touch);
      socket.emit('touch move', {shoot: true});
    }
  }
}

function handleMove(evt) {
  evt.preventDefault();
  let touches = evt.changedTouches;
  if (moveTouch) {
    let touch = Array.from(touches).find((t) => t.identifier == moveTouch.identifier);
    if (touch) {
      socket.emit('touch move', {dx: touch.pageX - moveTouch.pageX, dy: -(touch.pageY - moveTouch.pageY)});
    }
  }
  
}

function handleEnd(evt) {
  evt.preventDefault();
  let touches = evt.changedTouches;
  if (moveTouch) {
    let touch = Array.from(touches).find((t) => t.identifier == moveTouch.identifier);
    if (touch) {
      socket.emit('touch move', {dx: 0, dy: 0});
    }
  }
  if (shootTouch) {
    let touch = Array.from(touches).find((t) => t.identifier == shootTouch.identifier);
    if (touch) {
      socket.emit('touch move',  {shoot: false});
    }
  }

}