import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Ammo from "ammojs-typed";
import { FlyControls } from "three/examples/jsm/controls/FlyControls";


let flyControls;
let t0 = new Date();
let camera, controls, scene, renderer;
let textureLoader;
const clock = new THREE.Clock();

const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const ballMaterial = new THREE.MeshPhongMaterial({ color: 0x202020 });

let physicsWorld;
const gravityConstant = 7.8;
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
const margin = 0.05;

const rigidBodies = [];
const grenades = [];

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
let transformAux1;
let tempBtVec3_1;

let score = 0;
let scoreDiv = document.getElementById("score");

function updateScore(amount = 1) {
  score += amount;
  if (scoreDiv) scoreDiv.innerText = `Puntos: ${score}`;
}

Ammo(Ammo).then(start);

function start() {
  initGraphics();
  initPhysics();
  createObjects();
  initInput();
  animationLoop();
}

function initGraphics() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.2,
    2000
  );
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd1e5);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 10);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  flyControls = new FlyControls(camera, renderer.domElement);
  flyControls.dragToLook = true;
  flyControls.movementSpeed = 0.001;
  flyControls.rollSpeed = 0.001;


  // OrbitControls desactivado
// controls = new OrbitControls(camera, renderer.domElement);
// controls.target.set(0, 2, 0);
// // // // controls.update();

  textureLoader = new THREE.TextureLoader();

  const ambientLight = new THREE.AmbientLight(0x707070);
  scene.add(ambientLight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(-10, 18, 5);
  light.castShadow = true;
  const d = 14;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;
  light.shadow.camera.near = 2;
  light.shadow.camera.far = 50;
  light.shadow.mapSize.x = 1024;
  light.shadow.mapSize.y = 1024;
  scene.add(light);

  window.addEventListener("resize", onWindowResize);
}

function initPhysics() {
  collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  broadphase = new Ammo.btDbvtBroadphase();
  solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  physicsWorld.setGravity(new Ammo.btVector3(0, -gravityConstant, 0));

  transformAux1 = new Ammo.btTransform();
  tempBtVec3_1 = new Ammo.btVector3(0, 0, 0);
}

function createObjects() {
  pos.set(0, -0.5, 0);
  quat.set(0, 0, 0, 1);
  const suelo = createBoxWithPhysics(
    40,
    1,
    40,
    0,
    pos,
    quat,
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  );
  suelo.receiveShadow = true;

  textureLoader.load(
    "https://cdn.glitch.global/8b114fdc-500a-4e05-b3c5-a4afa5246b07/grid.png?v=1669716810074",
    function (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(40, 40);
      suelo.material.map = texture;
      suelo.material.needsUpdate = true;
    }
  );

  const wallMaterial = new THREE.MeshPhongMaterial({ color: 0xdddddd });

  pos.set(0, 5, -20);
  createBoxWithPhysics(40, 10, 1, 0, pos, quat, wallMaterial);

  pos.set(0, 5, 20);
  createBoxWithPhysics(40, 10, 1, 0, pos, quat, wallMaterial);

  pos.set(-20, 5, 0);
  createBoxWithPhysics(1, 10, 40, 0, pos, quat, wallMaterial);

  pos.set(20, 5, 0);
  createBoxWithPhysics(1, 10, 40, 0, pos, quat, wallMaterial);

  pos.set(0, 10.5, 0);
  createBoxWithPhysics(40, 1, 40, 0, pos, quat, wallMaterial);

  createWallCustom(2, 0, 0, 6, 6);
  createWallCustom(2.7, 0, 0, 6, 6);
  createWallCustom(3.3, 0, 0, 6, 6);
  createWallCustom(4, 0, 0, 6, 6);
  createWallCustom(4.7, 0, 0, 6, 6);
  createWallCustom(5.3, 0, 0, 6, 6);
  createWallCustom(6, 0, 0, 6, 6);
}

function createWallCustom(originX, originY, originZ, bricksX = 5, bricksY = 5) {
  const brickMass = 0.5;
  const brickLength = 1.2;
  const brickDepth = 0.6;
  const brickHeight = brickLength * 0.5;

  quat.set(0, 0, 0, 1);

  for (let j = 0; j < bricksY; j++) {
    const oddRow = j % 2 == 1;
    let z = originZ;

    if (oddRow) z -= 0.25 * brickLength;

    const nRow = oddRow ? bricksX + 1 : bricksX;

    for (let i = 0; i < nRow; i++) {
      let brickLengthCurrent = brickLength;
      let brickMassCurrent = brickMass;

      if (oddRow && (i == 0 || i == nRow - 1)) {
        brickLengthCurrent *= 0.5;
        brickMassCurrent *= 0.5;
      }

      pos.set(
        originX,
        originY + brickHeight * 0.5 + j * brickHeight,
        z
      );

      const brick = createBoxWithPhysics(
        brickDepth,
        brickHeight,
        brickLengthCurrent,
        brickMassCurrent,
        pos,
        quat,
        createMaterial()
      );

      if (brick) {
        brick.userData.isTarget = true;
        brick.userData.value = 1;
        brick.userData.hit = false;
      }

      if (oddRow && (i == 0 || i == nRow - 2)) z += 0.75 * brickLength;
      else z += brickLength;
    }
  }
}

function createBoxWithPhysics(sx, sy, sz, mass, pos, quat, material) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1),
    material
  );

  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  shape.setMargin(margin);

  createRigidBody(object, shape, mass, pos, quat);

  return object;
}

function createRigidBody(object, physicsShape, mass, pos, quat, vel, angVel) {
  if (pos) object.position.copy(pos);
  else pos = object.position;
  if (quat) object.quaternion.copy(quat);
  else quat = object.quaternion;

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
  const motionState = new Ammo.btDefaultMotionState(transform);

  const localInertia = new Ammo.btVector3(0, 0, 0);
  physicsShape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    physicsShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  body.setFriction(0.5);

  if (vel) body.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
  if (angVel) body.setAngularVelocity(new Ammo.btVector3(angVel.x, angVel.y, angVel.z));

  object.userData.physicsBody = body;
  object.userData.collided = false;

  scene.add(object);

  if (mass > 0) {
    rigidBodies.push(object);
    body.setActivationState(4);
  }

  physicsWorld.addRigidBody(body);

  return body;
}

function createRandomColor() {
  return Math.floor(Math.random() * (1 << 24));
}

function createMaterial(color) {
  color = color || createRandomColor();
  return new THREE.MeshPhongMaterial({ color });
}

function throwGrenade(ray) {
  const mass = 2;
  const radius = 0.15;

  const grenadeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0x4444ff })
  );
  grenadeMesh.castShadow = true;
  grenadeMesh.receiveShadow = true;

  const shape = new Ammo.btSphereShape(radius);
  shape.setMargin(margin);

  pos.copy(ray.direction);
  pos.add(ray.origin);
  quat.set(0, 0, 0, 1);

  const grenadeBody = createRigidBody(
    grenadeMesh,
    shape,
    mass,
    pos,
    quat
  );

  const velocity = new Ammo.btVector3(
    ray.direction.x * 18,
    ray.direction.y * 18,
    ray.direction.z * 18
  );
  grenadeBody.setLinearVelocity(velocity);

  grenades.push({
    mesh: grenadeMesh,
    body: grenadeBody,
    timeToExplode: 2.0
  });
}

function explodeGrenade(grenade) {
  const explosionForce = 45;
  const radius = 4;

  const origin = grenade.body.getWorldTransform().getOrigin();
  const explosionPos = new THREE.Vector3(origin.x(), origin.y(), origin.z());

  for (let i = 0; i < rigidBodies.length; i++) {
    const obj = rigidBodies[i];
    const body = obj.userData.physicsBody;

    const bodyPos = body.getWorldTransform().getOrigin();

    const dx = bodyPos.x() - origin.x();
    const dy = bodyPos.y() - origin.y();
    const dz = bodyPos.z() - origin.z();

    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist < radius) {
      const impulse = explosionForce / Math.max(dist, 0.2);

      const dir = new Ammo.btVector3(dx, dy, dz);
      dir.normalize();
      dir.op_mul(impulse);

      body.applyCentralImpulse(dir);

      if (obj.userData && obj.userData.isTarget && !obj.userData.hit) {
        obj.userData.hit = true;
        const val = obj.userData.value || 1;
        updateScore(val);
      }
    }
  }

  scene.remove(grenade.mesh);
  physicsWorld.removeRigidBody(grenade.body);
}

function initInput() {
  window.addEventListener("pointerdown", function (event) {
    mouseCoords.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouseCoords, camera);
    throwGrenade(raycaster.ray);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animationLoop() {
  requestAnimationFrame(animationLoop);

  const deltaTime = clock.getDelta();
  updatePhysics(deltaTime);

  let t1 = new Date();
  let secs = (t1 - t0) / 1000;
  flyControls.update(4 * secs);

  const minX = -19;
  const maxX = 19;
  const minY = 0.5;   
  const maxY = 9.5;    
  const minZ = -19;
  const maxZ = 19;

  camera.position.x = Math.min(Math.max(camera.position.x, minX), maxX);
  camera.position.y = Math.min(Math.max(camera.position.y, minY), maxY);
  camera.position.z = Math.min(Math.max(camera.position.z, minZ), maxZ);

  // controls.update();
  renderer.render(scene, camera);
}

function updatePhysics(deltaTime) {
  physicsWorld.stepSimulation(deltaTime, 10);

  for (let i = 0, il = rigidBodies.length; i < il; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();

    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
      objThree.userData.collided = false;
    }
  }

  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.timeToExplode -= deltaTime;

    g.mesh.material.color.set(
      g.timeToExplode % 0.2 < 0.1 ? 0xff0000 : 0x4444ff
    );

    if (g.timeToExplode <= 0) {
      explodeGrenade(g);
      grenades.splice(i, 1);
    }
  }
}
