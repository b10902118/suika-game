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
  render: { fillStyle: "#FFEEDB" },
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
  { radius: 24, scoreValue: 1, img: "./assets/img/circle0.png" },
  { radius: 32, scoreValue: 3, img: "./assets/img/circle1.png" },
  { radius: 40, scoreValue: 6, img: "./assets/img/circle2.png" },
  { radius: 56, scoreValue: 10, img: "./assets/img/circle3.png" },
  { radius: 64, scoreValue: 15, img: "./assets/img/circle4.png" },
  { radius: 72, scoreValue: 21, img: "./assets/img/circle5.png" },
  { radius: 84, scoreValue: 28, img: "./assets/img/circle6.png" },
  { radius: 96, scoreValue: 36, img: "./assets/img/circle7.png" },
  { radius: 128, scoreValue: 45, img: "./assets/img/circle8.png" },
  { radius: 160, scoreValue: 55, img: "./assets/img/circle9.png" },
  { radius: 192, scoreValue: 66, img: "./assets/img/circle10.png" },
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

var engine;
var runner;
var render;
var mouseConstraint;

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

  const gameStatics = [
    // Left Wall
    Bodies.rectangle(
      lb - wallThickness / 2,
      height * (3 / 4),
      wallThickness,
      height / 2,
      wallProps
    ),

    // Right Wall
    Bodies.rectangle(
      rb + wallThickness / 2,
      height * (3 / 4),
      wallThickness,
      height / 2,
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
  return gameStatics;
}

function resize() {
  render.canvas.style.height = `${document.body.clientHeight}px`;
  render.canvas.style.width = `${document.body.clientWidth}px`;
}

function initEnv(restart = false) {
  if (!restart) {
    engine = Engine.create();
    runner = Runner.create();
    const gameStatics = initBoundry();
    render = Render.create({
      element: elements.canvas,
      engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: "#ffdcae",
      },
    });
    resize();
    addMouseControl();
    Composite.add(engine.world, gameStatics);
  }

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
  /*
  Engine.clear(engine);
  Render.stop(render);
  Runner.stop(runner);
  */
  //initEnv(true);
  console.log("Game inited");
  // Init game state

  nextFruitSize = 0;
  currentFruitSize = 0;
  const allBodies = Composite.allBodies(engine.world);
  for (const body of allBodies) {
    if (!body.isStatic) {
      Composite.remove(engine.world, body);
    }
  }

  //sounds.click.play();

  for (let i = 0; i < fruitSizes.length; i++) {
    fruitsMerged[i] = 0;
  }
  calculateScore();

  runner.enabled = true;
  Render.run(render);
  Runner.run(runner, engine);

  elements.previewBall = generateFruitBody(width / 2, previewBallHeight, 0, {
    isStatic: true,
  });
  Composite.add(engine.world, elements.previewBall);

  setTimeout(() => {
    stateIndex = GameStates.READY;
  }, 250);

  document.addEventListener("keydown", function (e) {
    if (stateIndex !== GameStates.READY) return;
    if (elements.previewBall === null) return;

    const step = 20; // pixels to move per key press
    if (e.key === "ArrowLeft") {
      elements.previewBall.position.x = Math.max(
        elements.previewBall.position.x - step,
        lb
      );
    } else if (e.key === "ArrowRight") {
      elements.previewBall.position.x = Math.min(
        elements.previewBall.position.x + step,
        rb
      );
    } else if (e.key === "Enter" || e.key === "ArrowDown") {
      addFruit(elements.previewBall.position.x);
    }
  });
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

document.getElementById("restart-btn").onclick = function () {
  document.getElementById("lose-prompt").style.display = "none";
  document.getElementById("start-btn").click();
};
document.getElementById("back-btn").onclick = function () {
  document.getElementById("lose-prompt").style.display = "none";
  document.getElementById("menu").style.display = "flex";
};

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
  runner.enabled = false;
  console.log("Game Over! Final Score:", score);
  LosePromptElement.style.display = "flex";
  document.removeEventListener("keydown", arguments.callee);
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
        xScale: size.radius / 512,
        yScale: size.radius / 512,
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

  setTimeout(() => {
    if (stateIndex === GameStates.DROP) {
      Composite.add(engine.world, elements.previewBall);
      stateIndex = GameStates.READY;
    }
  }, 500);
}

document.addEventListener("DOMContentLoaded", () => initEnv());
//window.addEventListener("resize", resizeCanvas);

document.getElementById("start-btn").onclick = function () {
  document.getElementById("menu").style.display = "none";
  startGame();
};
