//const Matter = require("matter-js");

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(Date.now());

const {
  Engine,
  Render,
  Runner,
  Composites,
  Common,
  MouseConstraint,
  Mouse,
  Composite,
  Bodies,
  Events,
} = Matter;

const Serializer = MatterTools.Serializer;
const serializer = Serializer.create();

const wallThickness = 32;
const loseHeight = 84;
const statusBarHeight = 48;
const previewBallHeight = 128;
const friction = {
  friction: 0.006,
  frictionStatic: 0.006,
  frictionAir: 0,
  restitution: 0.1,
};

const wallProps = {
  isStatic: true,
  render: { fillStyle: "#c68e51" },
  ...friction,
};

const outsideProps = {
  isStatic: true,
  render: { fillStyle: "transparent" },
  ...friction,
  isOutside: true,
};

const outsideWidth = 500;

const GameStates = {
  MENU: 0,
  READY: 1,
  DROP: 2,
  LOSE: 3,
};

const fruitSizes = [
  { radius: 49 * 0.5, scoreValue: 1, img: "./images/0.png" },
  { radius: 63 * 0.5, scoreValue: 3, img: "./images/1.png" },
  { radius: 88 * 0.5, scoreValue: 6, img: "./images/2.png" },
  { radius: 96 * 0.5, scoreValue: 10, img: "./images/3.png" },
  { radius: 126 * 0.5, scoreValue: 15, img: "./images/4.png" },
  { radius: 164 * 0.5, scoreValue: 21, img: "./images/5.png" },
  { radius: 184 * 0.5, scoreValue: 28, img: "./images/6.png" },
  { radius: 223 * 0.5, scoreValue: 36, img: "./images/7.png" },
  { radius: 251 * 0.5, scoreValue: 45, img: "./images/8.png" },
  { radius: 309 * 0.5, scoreValue: 55, img: "./images/9.png" },
  { radius: 360 * 0.5, scoreValue: 66, img: "./images/10.png" },
];

const container_height = 960;
const container_width = 640;

const height = 960;
var width;
var lb;
var rb;
const elements = {
  canvas: document.getElementById("game-canvas"),
  previewBall: null,
};

var stateIndex = GameStates.MENU;

var score = 0;
const fruitsMerged = [];
const scoreElement = document.getElementById("game-score");
function calculateScore() {
  new_score = fruitsMerged.reduce((total, count, sizeIndex) => {
    const value = fruitSizes[sizeIndex].scoreValue * count;
    return total + value;
  }, 0);
  if (new_score !== score) {
    score = new_score;
    scoreElement.textContent = `${score}`;
    //console.log("Score updated:", score);
  }
}

var currentFruitSize = 0;
var nextFruitSize = 0;
function setNextFruitSize() {
  nextFruitSize = Math.floor(rand() * 5);
  //elements.nextFruitImg.src = `./assets/img/circle${nextFruitSize}.png`;
}

const engine = Engine.create();
const runner = Runner.create();
var render;
var mouseConstraint;

function saveGameState() {
  Serializer.saveState(serializer, engine, "gameState");
  localStorage.setItem("gameScore", score);
  localStorage.setItem("gameFruitsMerged", JSON.stringify(fruitsMerged));
}

function loadGameState() {
  // TODO: handle error
  Serializer.loadState(serializer, engine, "gameState");
  score = localStorage.getItem("gameScore");
  const merged = localStorage.getItem("gameFruitsMerged");
  if (merged) {
    const arr = JSON.parse(merged);
    for (let i = 0; i < fruitSizes.length; i++) {
      fruitsMerged[i] = arr[i] || 0;
    }
  }
}

function addMouseControl() {
  const mouse = Mouse.create(render.canvas);
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: false,
      },
    },
  });
  render.mouse = mouse;

  Events.on(mouseConstraint, "mouseup", function (e) {
    elements.previewBall.position.x = Math.max(
      lb,
      Math.min(rb, e.mouse.position.x)
    );
    addFruit(elements.previewBall.position.x);
  });

  Events.on(mouseConstraint, "mousemove", function (e) {
    if (stateIndex !== GameStates.READY) return;
    if (elements.previewBall === null) return;

    elements.previewBall.position.x = Math.max(
      lb,
      Math.min(rb, e.mouse.position.x)
    );
  });
}

function initBoundry() {
  width = height * (document.body.clientWidth / document.body.clientHeight);
  lb = width / 2 - container_width / 2;
  rb = width / 2 + container_width / 2;
}

function initStatics() {
  return [
    // Left Wall
    Bodies.rectangle(
      lb - wallThickness / 2,
      height * (2 / 3),
      wallThickness,
      height * (2 / 3),
      wallProps
    ),

    // Right Wall
    Bodies.rectangle(
      rb + wallThickness / 2,
      height * (2 / 3),
      wallThickness,
      height * (2 / 3),
      wallProps
    ),

    // Left Outside
    Bodies.rectangle(
      lb - wallThickness - outsideWidth / 2,
      height * (4 / 5),
      outsideWidth,
      height / 2,
      outsideProps
    ),

    // Right Outside
    Bodies.rectangle(
      rb + wallThickness + outsideWidth / 2,
      height * (4 / 5),
      outsideWidth,
      height / 2,
      outsideProps
    ),

    // Bottom
    Bodies.rectangle(
      width / 2,
      height - wallThickness / 2,
      rb - lb + wallThickness * 2,
      wallThickness,
      wallProps
    ),
  ];
}

function resize() {
  render.canvas.style.height = `${document.body.clientHeight}px`;
  render.canvas.style.width = `${document.body.clientWidth}px`;
}

function handlePlayKeydown(e) {
  if (stateIndex !== GameStates.READY) return;
  if (elements.previewBall === null) return;

  const stepSmall = 20; // pixels to move per key press
  const stepBig = 60; // pixels to move per key press
  if (e.key === "ArrowLeft") {
    elements.previewBall.position.x = Math.max(
      elements.previewBall.position.x - stepSmall,
      lb
    );
  } else if (e.key === "ArrowRight") {
    elements.previewBall.position.x = Math.min(
      elements.previewBall.position.x + stepSmall,
      rb
    );
  }
  if (e.key === "1") {
    elements.previewBall.position.x = Math.max(
      elements.previewBall.position.x - stepBig,
      lb
    );
  } else if (e.key === "3") {
    elements.previewBall.position.x = Math.min(
      elements.previewBall.position.x + stepBig,
      rb
    );
  } else if (e.key === "Enter" || e.key === "ArrowDown") {
    addFruit(elements.previewBall.position.x);
  }
}

function initEnv() {
  initBoundry();
  const gameStatics = initStatics();
  Composite.add(engine.world, gameStatics);
  render = Render.create({
    element: elements.canvas,
    engine,
    options: {
      width: width,
      height: height,
      wireframes: false,
      background: "#f7ec96",
    },
  });
  resize();
  addMouseControl();

  Events.on(engine, "collisionStart", function (e) {
    for (let i = 0; i < e.pairs.length; i++) {
      const { bodyA, bodyB } = e.pairs[i];
      if (bodyA.isOutside || bodyB.isOutside) {
        console.log("Collision with outside detected");
        loseGame();
        return;
      }

      // Skip if collision is wall
      if (bodyA.isStatic || bodyB.isStatic) continue;

      // Skip different sizes
      if (bodyA.sizeIndex !== bodyB.sizeIndex) continue;

      // Skip if already popped
      if (bodyA.popped || bodyB.popped) continue;

      let newSize = bodyA.sizeIndex + 1;

      // Go back to smallest size
      if (bodyA.circleRadius >= fruitSizes[fruitSizes.length - 1].radius) {
        newSize = 0;
      }

      fruitsMerged[bodyA.sizeIndex] += 1;

      // Therefore, circles are same size, so merge them.
      const midPosX = (bodyA.position.x + bodyB.position.x) / 2;
      const midPosY = (bodyA.position.y + bodyB.position.y) / 2;

      bodyA.popped = true;
      bodyB.popped = true;

      //sounds[`pop${bodyA.sizeIndex}`].play();
      Composite.remove(engine.world, [bodyA, bodyB]);
      Composite.add(engine.world, generateFruitBody(midPosX, midPosY, newSize));
      addPop(midPosX, midPosY, bodyA.circleRadius);
      calculateScore();
    }
  });
}

function startGame() {
  if (localStorage.getItem("gameState") !== null) {
    loadGameState();
  } else {
    // Init game state
    Composite.clear(engine.world, true);
    for (let i = 0; i < fruitSizes.length; i++) {
      fruitsMerged[i] = 0;
    }
    nextFruitSize = Math.floor(rand() * 5);
    currentFruitSize = Math.floor(rand() * 5);
  }
  calculateScore(); // show the score

  runner.enabled = true;
  Runner.run(runner, engine);
  Render.run(render);

  elements.previewBall = generateFruitBody(
    width / 2,
    previewBallHeight,
    currentFruitSize,
    {
      isStatic: true,
    }
  );
  Composite.add(engine.world, elements.previewBall);

  stateIndex = GameStates.READY;

  document.addEventListener("keydown", handlePlayKeydown);
}

function addPop(x, y, r) {
  const circle = Bodies.circle(x, y, r, {
    isStatic: true,
    collisionFilter: { mask: 0x0040 },
    angle: rand() * (Math.PI * 2),
    render: {
      sprite: {
        texture: "./assets/img/pop.png",
        xScale: r / 384,
        yScale: r / 384,
      },
    },
  });

  Composite.add(engine.world, circle);
  setTimeout(() => {
    Composite.remove(engine.world, circle);
  }, 100);
}

function saveHighscore() {
  const highscore = localStorage.getItem("suika-highscore");
  if (highscore === null || score > parseInt(highscore)) {
    localStorage.setItem("suika-highscore", score);
    console.log("New highscore saved:", score);
  }
}

const LosePromptElement = document.getElementById("lose-prompt");
function loseGame() {
  stateIndex = GameStates.LOSE;
  // somehow have to remove here, after it will stay
  Composite.remove(engine.world, elements.previewBall);
  runner.enabled = false;
  Render.stop(render);
  console.log("Game Over! Final Score:", score);
  LosePromptElement.style.display = "flex";
  restartButton.focus();
  document.removeEventListener("keydown", handlePlayKeydown);
  saveHighscore();
}

// Returns an index, or null
function lookupFruitIndex(radius) {
  const sizeIndex = fruitSizes.findIndex((size) => size.radius == radius);
  if (sizeIndex === undefined) return null;
  if (sizeIndex === fruitSizes.length - 1) return null;

  return sizeIndex;
}

function generateFruitBody(x, y, sizeIndex, extraConfig = {}) {
  const size = fruitSizes[sizeIndex];
  const circle = Bodies.circle(x, y, size.radius, {
    ...friction,
    ...extraConfig,
    render: {
      sprite: {
        texture: size.img,
        xScale: 1,
        yScale: 1,
      },
    },
  });
  circle.sizeIndex = sizeIndex;
  circle.popped = false;

  return circle;
}

function addFruit(x) {
  if (stateIndex !== GameStates.READY) return;

  stateIndex = GameStates.DROP;
  const latestFruit = generateFruitBody(x, previewBallHeight, currentFruitSize);
  Composite.add(engine.world, latestFruit);

  currentFruitSize = nextFruitSize;
  setNextFruitSize();
  calculateScore();

  Composite.remove(engine.world, elements.previewBall);
  elements.previewBall = generateFruitBody(
    x,
    previewBallHeight,
    currentFruitSize,
    {
      isStatic: true,
      collisionFilter: { mask: 0x0040 },
    }
  );

  saveGameState();
  setTimeout(() => {
    if (stateIndex === GameStates.DROP) {
      Composite.add(engine.world, elements.previewBall);
      stateIndex = GameStates.READY;
    }
  }, 500);
}

document.addEventListener("DOMContentLoaded", () => initEnv());
//window.addEventListener("resize", resizeCanvas);

function start() {
  document.getElementById("menu").style.display = "none";
  startGame();
}

function restart() {
  document.getElementById("lose-prompt").style.display = "none";
  startGame();
}

const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");
const backButton = document.getElementById("back-btn");

startButton.onclick = function (e) {
  if (stateIndex === GameStates.MENU) {
    start();
  }
};

restartButton.onclick = function () {
  restart();
};

function updateMyBest() {
  const myBestElement = document.getElementById("my-best");
  const myBestScore = localStorage.getItem("suika-highscore") || "--";
  myBestElement.textContent = `${myBestScore}`;
}

// TODO: use db
function updateWorldRank() {
  const worldRankElement = document.getElementById("world-rank");
  const myBestScore = localStorage.getItem("suika-highscore");
  if (!myBestScore) {
    worldRankElement.textContent = "--";
    return;
  }
  const rank = Math.max(1, (3000 - parseInt(myBestScore)) * 3);
  worldRankElement.textContent = `${rank}`;
}

backButton.onclick = function () {
  document.getElementById("lose-prompt").style.display = "none";
  updateMyBest();
  updateWorldRank();
  document.getElementById("menu").style.display = "flex";
  startButton.focus();
  stateIndex = GameStates.MENU;
};

// TODO: make it faster
updateMyBest();
updateWorldRank();
startButton.focus();
