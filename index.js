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
  { radius: 49 * 0.5, scoreValue: 1, img: "./assets/img/circle0.png" },
  { radius: 63 * 0.5, scoreValue: 3, img: "./assets/img/circle1.png" },
  { radius: 88 * 0.5, scoreValue: 6, img: "./assets/img/circle2.png" },
  { radius: 96 * 0.5, scoreValue: 10, img: "./assets/img/circle3.png" },
  { radius: 126 * 0.5, scoreValue: 15, img: "./assets/img/circle4.png" },
  { radius: 164 * 0.5, scoreValue: 21, img: "./assets/img/circle5.png" },
  { radius: 184 * 0.5, scoreValue: 28, img: "./assets/img/circle6.png" },
  { radius: 223 * 0.5, scoreValue: 36, img: "./assets/img/circle7.png" },
  { radius: 251 * 0.5, scoreValue: 45, img: "./assets/img/circle8.png" },
  { radius: 309 * 0.5, scoreValue: 55, img: "./assets/img/circle9.png" },
  { radius: 360 * 0.5, scoreValue: 66, img: "./assets/img/circle10.png" },
];

const container_height = 960;
const container_width = 640;

const height = 960;
var width;
var lb;
var rb;
const elements = {
  canvas: document.getElementById("game-canvas"),
  menu: document.getElementById("menu"),
  losePrompt: document.getElementById("lose-prompt"),
  savePrompt: document.getElementById("save-prompt"),
  myBest: document.getElementById("my-best"),
  worldRank: document.getElementById("world-rank"),
  startButton: document.getElementById("start-btn"),
  restartButton: document.getElementById("restart-btn"),
  backButton: document.getElementById("back-btn"),
  saveYesButton: document.getElementById("save-yes-btn"),
  saveNoButton: document.getElementById("save-no-btn"),
  hint: document.getElementById("hint"),
  score: document.getElementById("game-score"),
  achievementButton: document.getElementById("achievement-btn"),
  achievementModal: document.getElementById("achievement-modal"),
  closeAchievementButton: document.getElementById("close-achievement-btn"),
};

var previewBall = null;

var stateIndex = GameStates.MENU;

var score = 0;
const fruitsMerged = [];
function calculateScore() {
  const new_score = fruitsMerged.reduce((total, count, sizeIndex) => {
    const value = fruitSizes[sizeIndex].scoreValue * count;
    return total + value;
  }, 0);
  if (new_score !== score) {
    score = new_score;
    elements.score.textContent = `${score}`;
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

function stopGame() {
  document.removeEventListener("keydown", handlePlayKeydown);
  // somehow have to remove here, let restarted to regenerate
  // clear on restart can't clear it (isStatic?)
  Composite.remove(engine.world, previewBall);
  Runner.stop(runner);
  Render.stop(render);
}

function haveSavedGame() {
  return localStorage.getItem("gameScore") !== null;
}

function saveGameState() {
  stopGame();
  Serializer.saveState(serializer, engine, "gameState");
  localStorage.setItem("gameScore", score);
  localStorage.setItem("gameFruitsMerged", JSON.stringify(fruitsMerged));
}

function loadGameState() {
  // TODO: handle error
  if (!haveSavedGame()) return false;
  try {
    Serializer.loadState(serializer, engine, "gameState");
    score = localStorage.getItem("gameScore");
    const merged = localStorage.getItem("gameFruitsMerged");
    const arr = JSON.parse(merged);
    for (let i = 0; i < fruitSizes.length; i++) {
      fruitsMerged[i] = arr[i] || 0;
    }
    clearGameState(); // should not be accessed again
    return true;
  } catch (e) {
    console.error("Failed to load game state:", e);
    console.error("Clearing game state due to error.");
    clearGameState();
    return false;
  }
}

function clearGameState() {
  localStorage.removeItem("gameState");
  localStorage.removeItem("gameScore");
  localStorage.removeItem("gameFruitsMerged");
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
    if (elements.hint.style.display !== "none") {
      elements.hint.style.display = "none";
    }

    previewBall.position.x = Math.max(lb, Math.min(rb, e.mouse.position.x));
    addFruit(previewBall.position.x);
  });

  Events.on(mouseConstraint, "mousemove", function (e) {
    if (elements.hint.style.display !== "none") {
      elements.hint.style.display = "none";
    }

    if (stateIndex !== GameStates.READY) return;
    if (previewBall === null) return;

    previewBall.position.x = Math.max(lb, Math.min(rb, e.mouse.position.x));
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

const validKeys = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "Enter",
  "1",
  "3",
  "4",
  "6",
  "5",
];

const stepSmall = 20; // pixels to move per key press
const stepBig = 60; // pixels to move per key press

function handlePlayKeydown(e) {
  if (elements.hint.style.display !== "none" && validKeys.includes(e.key)) {
    elements.hint.style.display = "none";
  }

  if (e.key === "ArrowLeft" || e.key === "4") {
    previewBall.position.x = Math.max(previewBall.position.x - stepSmall, lb);
  } else if (e.key === "ArrowRight" || e.key === "6") {
    previewBall.position.x = Math.min(previewBall.position.x + stepSmall, rb);
  } else if (e.key === "1") {
    previewBall.position.x = Math.max(previewBall.position.x - stepBig, lb);
  } else if (e.key === "3") {
    previewBall.position.x = Math.min(previewBall.position.x + stepBig, rb);
  } else if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "5") {
    addFruit(previewBall.position.x);
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

      let newSize = (bodyA.sizeIndex + 1) % fruitSizes.length;

      fruitsMerged[bodyA.sizeIndex] += 1;

      // Therefore, circles are same size, so merge them.
      const midPosX = (bodyA.position.x + bodyB.position.x) / 2;
      const midPosY = (bodyA.position.y + bodyB.position.y) / 2;

      bodyA.popped = true;
      bodyB.popped = true;

      //sounds[`pop${bodyA.sizeIndex}`].play();
      Composite.remove(engine.world, [bodyA, bodyB]);
      Composite.add(engine.world, generateFruitBody(midPosX, midPosY, newSize));
      // Bug: could squeezed through wall
      addPop(midPosX, midPosY, bodyA.circleRadius);
      calculateScore();
    }
  });
}

function showHint() {
  elements.hint.style.display = "flex";
}

function startGame(restart = false) {
  if (!loadGameState()) {
    // Init game state
    Composite.clear(engine.world, true);
    for (let i = 0; i < fruitSizes.length; i++) {
      fruitsMerged[i] = 0;
    }
    nextFruitSize = Math.floor(rand() * 5);
    currentFruitSize = Math.floor(rand() * 5);
    if (!restart) {
      showHint();
    }
  }
  calculateScore(); // show the score

  Runner.run(runner, engine);
  Render.run(render);

  previewBall = generateFruitBody(
    width / 2,
    previewBallHeight,
    currentFruitSize,
    {
      isStatic: true,
    }
  );
  Composite.add(engine.world, previewBall);

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
  const highscore = localStorage.getItem("highscore");
  if (highscore === null || score > parseInt(highscore)) {
    localStorage.setItem("highscore", score);
    console.log("New highscore saved:", score);
  }
}

function showSavePrompt() {
  elements.savePrompt.style.display = "flex";
  elements.saveYesButton.focus();
}

function showLosePrompt() {
  elements.losePrompt.style.display = "flex";
  elements.restartButton.focus();
}

function loseGame() {
  //clearGameState();
  stateIndex = GameStates.LOSE;
  stopGame();
  console.log("Game Over! Final Score:", score);
  showLosePrompt();
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
  //calculateScore();

  Composite.remove(engine.world, previewBall);
  previewBall = generateFruitBody(x, previewBallHeight, currentFruitSize, {
    isStatic: true,
    collisionFilter: { mask: 0x0040 },
  });

  setTimeout(() => {
    if (stateIndex === GameStates.DROP) {
      Composite.add(engine.world, previewBall);
      stateIndex = GameStates.READY;
    }
  }, 500);
}

function updateMyBestElement() {
  const myBestScore = localStorage.getItem("highscore") || "--";
  elements.myBest.textContent = `${myBestScore}`;
}

// TODO: use db
function updateWorldRankElement() {
  const myBestScore = localStorage.getItem("highscore");
  if (!myBestScore) {
    elements.worldRank.textContent = "--";
    return;
  }
  const rank = Math.max(1, (3000 - parseInt(myBestScore)) * 3);
  elements.worldRank.textContent = `${rank}`;
}

document.addEventListener("DOMContentLoaded", () => {
  initEnv();
  updateMyBestElement();
  updateWorldRankElement();
  showMenu();
  elements.startButton.focus();
});
//window.addEventListener("resize", resizeCanvas);

window.addEventListener("popstate", (event) => {
  if (elements.menu.style.display !== "none") {
    window.history.back();
  } else if (elements.losePrompt.style.display !== "none") {
    showMenu();
  } else if (elements.savePrompt.style.display !== "none") {
    elements.saveYesButton.onclick();
  } else {
    //playing
    stopGame();
    showSavePrompt();
  }
});

function start() {
  window.history.pushState(null, "", window.location.href);
  elements.menu.style.display = "none";
  startGame();
}

function restart() {
  elements.losePrompt.style.display = "none";
  startGame(true);
}

elements.startButton.onclick = function (e) {
  if (stateIndex === GameStates.MENU) {
    start();
  }
};

elements.restartButton.onclick = function () {
  restart();
};

function showMenu() {
  if (haveSavedGame()) {
    elements.startButton.textContent = "Continue";
  } else {
    elements.startButton.textContent = "Start";
  }
  elements.menu.style.display = "flex";
  elements.startButton.focus();
  stateIndex = GameStates.MENU;
}

elements.backButton.onclick = function () {
  elements.losePrompt.style.display = "none";
  updateMyBestElement();
  updateWorldRankElement();
  showMenu();
};

elements.saveYesButton.onclick = function () {
  saveGameState();
  elements.savePrompt.style.display = "none";
  showMenu();
};

elements.saveNoButton.onclick = function () {
  //clearGameState();
  elements.savePrompt.style.display = "none";
  showMenu();
};

elements.achievementButton.onclick = function () {
  elements.achievementModal.style.display = "flex";
  // Example: populate table with dummy data
  const ranks = [
    { rank: 1, score: 2048, player: "Alice" },
    { rank: 2, score: 1800, player: "Bob" },
    { rank: 3, score: 1500, player: "You" },
    { rank: 4, score: 1200, player: "Carol" },
    { rank: 5, score: 1000, player: "Dave" },
    { rank: 1, score: 2048, player: "Alice" },
    { rank: 2, score: 1800, player: "Bob" },
    { rank: 3, score: 1500, player: "You" },
    { rank: 4, score: 1200, player: "Carol" },
    { rank: 5, score: 1000, player: "Dave" },
  ];
  const tbody = document.getElementById("achievement-table-body");
  tbody.innerHTML = "";
  ranks.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="padding:1vh 2vw;">${r.rank}</td>
                            <td style="padding:1vh 2vw;">${r.score}</td>
                            <td style="padding:1vh 2vw;">${r.player}</td>`;
    tbody.appendChild(tr);
  });
};

elements.closeAchievementButton.onclick = function () {
  elements.achievementModal.style.display = "none";
};

elements.achievementModal.onclick = function (e) {
  if (e.target === this) this.style.display = "none";
};
