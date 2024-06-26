import Player from "./classes/Player";
import Platform from "./classes/Platform";
import GenericObject from "./classes/GenericObject";
import { createImage, encodeScore, getRndInteger, decodeScore } from "./helper";
import Pipe from "./classes/Pipe";
import { LightningAddress } from "@getalby/lightning-tools";
import LightningStrike from "./classes/LightningStrike";
import { webln } from "@getalby/sdk";

// balance permission only ;-)
const zapPoolBalanceNWCUrl =
  "nostr+walletconnect://69effe7b49a6dd5cf525bd0905917a5005ffe480b58eeb8e861418cf3ae760d9?relay=wss://relay.getalby.com/v1&secret=99e8fe6bf8777aa7e4ba572ab1d2fab9912bcd781900323cb734a9063927efc3";

/* Variables */
let JUMP_KEY_PRESSED = false;

const SCORE = {
  CURRENT: 0,
  BEST: 0,
};

const CONFIG = {
  PLAYER_VELOCITY_WHILE_JUMP: -8,
  PLAYER_SPEED: 4,
  FRAME_CHANGE: 25,
  GRAVITY: 0.4,
};

const SIZES = {
  GROUND: {
    WIDTH: Math.floor((37 * 2) / 3),
    HEIGHT: Math.floor((128 * 2) / 3),
  },

  PIPE: {
    WIDTH: 92,
    HEIGHT: 528,
  },
};

let animation: number,
  width: number,
  height: number,
  player: Player,
  platforms: Platform[],
  genericObjects: GenericObject[],
  scrollOffset: number = 0,
  stillness: boolean = false,
  pipes: Pipe[],
  lightningStrikes: LightningStrike[];

let isFirstRound = true;

const BASE_URL = "/zappy-bird";
const IMAGES = {
  ground: BASE_URL + "/assets/images/ground.png",
  background: BASE_URL + "/assets/images/background.png",
  restart: BASE_URL + "/assets/images/restart.png",
  play: BASE_URL + "/assets/images/play.png",
  bird: BASE_URL + "/assets/images/bird.png",
  pipeTop: BASE_URL + "/assets/images/pipe-top.png",
  pipeBottom: BASE_URL + "/assets/images/pipe-bottom.png",
};

const canvas = document.getElementById("flappyBird") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

const restartImage = createImage(IMAGES.restart);
const platformImage = createImage(IMAGES.ground);
const bgImage = createImage(IMAGES.background);
const playerImage = createImage(IMAGES.bird);
const pipeTopImage = createImage(IMAGES.pipeTop);
const pipeBottomImage = createImage(IMAGES.pipeBottom);

const ln = new LightningAddress("zappybird@getalby.com");

let gameUniqueId: string = "";
let canRestart = false;
let weblnEnabled = false;

window.addEventListener("bc:connected", () => {
  weblnEnabled = true;
});

(async () => {
  // fetch the LNURL data
  await ln.fetch();
})();

let prizePoolBalance = 0;
const loadPrizePoolBalance = async () => {
  const nwc = new webln.NostrWebLNProvider({
    nostrWalletConnectUrl: zapPoolBalanceNWCUrl,
  });
  await nwc.enable();
  const balanceResponse = await nwc.getBalance();
  prizePoolBalance = balanceResponse.balance;
  nwc.close();
};
loadPrizePoolBalance();

/* Code */
const addNewPlatform = () => {
  const platform = new Platform({
    ctx,
    image: platformImage,
    width: SIZES.GROUND.WIDTH,
    height: SIZES.GROUND.HEIGHT,
    x: platforms[platforms.length - 1].position.x + SIZES.GROUND.WIDTH,
    y: height - SIZES.GROUND.HEIGHT,
  });

  platforms.push(platform);
};

const addPipe = (space: number) => {
  const floor = height - SIZES.PIPE.HEIGHT;
  let lastPipeX: Pipe | number = pipes[pipes.length - 1];
  lastPipeX = lastPipeX
    ? lastPipeX.position.x + SIZES.PIPE.WIDTH + 20
    : Math.max(Math.floor(width * 0.75), height);

  const pipe1 = new Pipe({
    ctx,
    position: { x: lastPipeX, y: floor + space },
    state: "bottom",
    image: pipeBottomImage,
  });
  const pipe2 = new Pipe({
    ctx,
    position: { x: lastPipeX, y: pipe1.position.y - SIZES.PIPE.HEIGHT - 225 },
    state: "top",
    image: pipeTopImage,
  });

  pipes.push(pipe1, pipe2);
};

const addPlatforms = () => {
  const groundCount = Math.floor(width / SIZES.GROUND.WIDTH) + 10;
  for (let i = 0; i < groundCount; i++) {
    const platform = new Platform({
      ctx,
      image: platformImage,
      width: SIZES.GROUND.WIDTH,
      height: SIZES.GROUND.HEIGHT,
      x: i * SIZES.GROUND.WIDTH,
      y: height - SIZES.GROUND.HEIGHT,
    });

    platforms.push(platform);
  }
};

const addGenericObjects = () => {
  genericObjects.push(
    new GenericObject({
      ctx,
      image: bgImage,
      width,
      height: height - SIZES.GROUND.HEIGHT,
      x: -1,
      y: -1,
    })
  );
};

const loadPlayer = () => {
  player = new Player({
    ctx,
    screenX: width,
    screenY: height,
    speed: CONFIG.PLAYER_SPEED,
    g: 0,
    image: playerImage,
  });
  player.draw();
};

const drawPipes = () => {
  pipes.forEach((pipe) => pipe.draw());
};

const reset = () => {
  if (player) player.lose = false;
  stillness = false;

  pipes = [];
  platforms = [];
  genericObjects = [];
};

const whenPlayerLose = (userIsLose: boolean = false) => {
  if (stillness) {
    return;
  }
  if (
    userIsLose ||
    player.height + player.position.y + player.velocity >=
      platforms[0].position.y
  ) {
    player.position.y = platforms[0].position.y - player.height;
    player.lose = true;

    //cancelAnimation();
  }
  stillness = true;

  updateBestScore(SCORE.CURRENT);

  setTimeout(
    () => {
      canRestart = true;
      document.body.style.cursor = "pointer";
      document.getElementById("flappyBird").addEventListener("click", restart);
      loadPrizePoolBalance();
    },
    isFirstRound ? 0 : 1000
  );
};

const whenPlayerDamaged = () => {
  let reachedPipes = 0;
  pipes.forEach((pipe) => {
    if (player.position.x >= pipe.position.x + pipe.width) reachedPipes++;

    if (
      ((pipe.state === "bottom" && player.position.y >= pipe.position.y) ||
        (pipe.state === "top" &&
          player.position.y + player.height * 0.5 <=
            pipe.position.y + pipe.height)) &&
      player.position.x >= pipe.position.x - player.width &&
      player.position.x <= pipe.position.x + pipe.width
    ) {
      whenPlayerLose();
    }
  });

  updateCurrentScore();
};

const changePlayerFrame = () => {
  if (scrollOffset % CONFIG.FRAME_CHANGE === 0) player.nextFrame();
};

const balancePlatforms = () => {
  if (
    scrollOffset > SIZES.GROUND.WIDTH &&
    scrollOffset % SIZES.GROUND.WIDTH === 0
  ) {
    addNewPlatform();
    platforms.splice(0, 1);
  }
};

const balancePipes = () => {
  const rnd = getRndInteger(300, 400);
  addPipe(rnd);
};

const movingObjects = () => {
  platforms.forEach((platform) => (platform.position.x -= player.speed));

  pipes.forEach((pipe) => (pipe.position.x -= player.speed));
};

const drawLightning = () => {
  lightningStrikes = lightningStrikes.filter(
    (lightningStrike) => lightningStrike.alive
  );
  for (const lightningStrike of lightningStrikes) {
    lightningStrike.draw();
  }
};

let lastFrame = 0;
const animate = () => {
  ctx.clearRect(0, 0, width, height);

  genericObjects.forEach((obj) => obj.draw());

  if (!stillness) {
    balancePlatforms();
    changePlayerFrame();
    movingObjects();
  }

  if (stillness && isFirstRound && Math.random() < 0.005) {
    addLightningStrike();
  }

  drawLightning();

  const lightningLight = Math.min(
    lightningStrikes.map((strike) => strike.opacity).reduce((a, b) => a + b, 0),
    1
  );

  ctx.fillStyle = `rgba(0,0,0, ${1 - lightningLight})`;
  ctx.fillRect(0, 0, width, height);

  if (!player.stillness) drawPipes();

  player.update();

  if (!player.stillness) {
    balancePipes();
    whenPlayerDamaged();
  }

  platforms.forEach((platform) => platform.draw());

  if (
    player.height + player.position.y + player.velocity >=
    platforms[0].position.y
  )
    whenPlayerLose(true);

  if (!player.stillness) {
  }
  scrollOffset += player.speed;

  ctx.fillStyle = `rgba(0,0,0, ${(1 - lightningLight) * 0.2})`;
  ctx.fillRect(0, 0, width, height);

  if (stillness && isFirstRound) {
    {
      const title = "ZAPPY BIRD";
      ctx.font = "64px FlappyBird";
      ctx.fillStyle = "white";
      const text = ctx.measureText(title);
      const x = width / 2 - text.width / 2;
      const y = 200;
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 0;
      ctx.strokeText(title, x, y);
      ctx.fillText(title, x, y);
    }
    {
      const title = weblnEnabled ? "TAP TO START" : "CONNECT WALLET TO PLAY";
      ctx.font = "28px FlappyBird";
      ctx.fillStyle = "white";
      const text = ctx.measureText(title);
      const x = width / 2 - text.width / 2;
      const y = 300;
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 0;
      ctx.strokeText(title, x, y);
      ctx.fillText(title, x, y);
    }
    {
      const terms = [
        "1 sat per jump once you enter the pipes",
        "make sure you have sufficient balance to play",
      ];

      terms.map((title, i) => {
        ctx.font = "12px Helvetica";
        ctx.fillStyle = "white";
        const text = ctx.measureText(title);
        const x = width / 2 - text.width / 2;
        const y = 520 + i * 20;
        ctx.strokeStyle = "rgb(0, 0, 0)";
        ctx.lineWidth = 0;
        ctx.strokeText(title, x, y);
        ctx.fillText(title, x, y);
      });
    }
  }

  if (stillness) {
    const title =
      prizePoolBalance > 0
        ? `PRIZE POOL: ${prizePoolBalance} SATS`
        : "PRIZE POOL LOADING...";
    ctx.font = "28px FlappyBird";
    ctx.fillStyle = "white";
    const text = ctx.measureText(title);
    const x = width / 2 - text.width / 2;
    const y = 480;
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.lineWidth = 0;
    ctx.strokeText(title, x, y);
    ctx.fillText(title, x, y);
  }

  if (stillness && !isFirstRound) {
    if (canRestart) {
      drawRestartButton();
    }

    {
      ctx.font = "64px FlappyBird";
      ctx.fillStyle = "white";
      const text = ctx.measureText(gameUniqueId);
      const x = width / 2 - text.width / 2;
      const y = 200;
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 0;
      ctx.strokeText(gameUniqueId, x, y);
      ctx.fillText(gameUniqueId, x, y);
    }

    {
      const score = "SCORE: " + SCORE.CURRENT;
      ctx.font = "44px FlappyBird";
      const text = ctx.measureText(score);

      const x = width / 2 - text.width / 2;
      const y = 260;

      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 8;
      ctx.strokeText(score, x, y);
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillText(score, x, y);
    }

    {
      const score = "BEST: " + SCORE.BEST;
      ctx.font = "32px FlappyBird";
      const text = ctx.measureText(score);

      const x = width / 2 - text.width / 2;
      const y = 400;

      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 8;
      ctx.strokeText(score, x, y);
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillText(score, x, y);
    }

    {
      const lines = ["screenshot and tag #zappybird", "for the chance to win"];
      lines.forEach((line, index) => {
        ctx.font = "14px Helvetica";
        const text = ctx.measureText(line);

        const x = width / 2 - text.width / 2;
        const y = 500 + index * 20;

        ctx.strokeStyle = "rgb(148, 87, 235)";
        ctx.lineWidth = 2;
        ctx.strokeText(line, x, y);
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillText(line, x, y);
      });
    }
  }

  const now = Date.now();
  const elapsed = now - lastFrame;
  const FRAME_LENGTH = 16;
  if (elapsed > FRAME_LENGTH) {
    console.warn("Zappy bird is running slowly (" + elapsed + "ms behind)");
  }

  setTimeout(() => {
    animation = requestAnimationFrame(animate);
    lastFrame += FRAME_LENGTH;
  }, Math.max(FRAME_LENGTH - elapsed, 0));
};

const restart = async () => {
  let weblnEnabled = false;

  try {
    if (!window.webln) {
      throw new Error("No WebLN");
    }
    await window.webln?.enable();
    weblnEnabled = true;
  } catch (error) {
    console.error(error);
  }
  if (!weblnEnabled) {
    alert("Please connect your lightning wallet");
    return;
  }
  isFirstRound = false;
  canRestart = false;

  document.getElementById("flappyBird").removeEventListener("click", restart);
  document.body.style.cursor = "default";
  gameUniqueId =
    "#" +
    Array.from(Array(7), () => Math.floor(Math.random() * 10))
      .join("")
      .toUpperCase();
  start();
  whenPlayerJump();
};

const start = () => {
  scrollOffset = 0;
  SCORE.CURRENT = 0;

  /* Load playground */
  reset();

  /* Add */
  addGenericObjects();
  addPlatforms();

  /* Load */
  genericObjects.forEach((obj) => obj.draw());

  platforms.forEach((platform) => platform.draw());

  loadPlayer();
  updateCurrentScore();
  lightningStrikes = [];

  if (!animation) {
    lastFrame = Date.now();
    animate();
  }
};

const resetScore = () => {
  SCORE.CURRENT = 0;
  SCORE.BEST = 0;
};

const updateScore = () => {
  try {
    SCORE.CURRENT = 0;

    let scoreFromLocalStorage: number | string =
      localStorage.getItem("best-score");

    if (!scoreFromLocalStorage) {
      localStorage.setItem("best-score", encodeScore(0));
      scoreFromLocalStorage = 0;
    } else scoreFromLocalStorage = decodeScore(scoreFromLocalStorage);

    SCORE.BEST = scoreFromLocalStorage;
  } catch (e) {
    resetScore();
  }
};

const updateBestScore = (score: number) => {
  if (SCORE.BEST >= SCORE.CURRENT) return;

  localStorage.setItem("best-score", encodeScore(score));
  SCORE.BEST = score;
};

const updateCurrentScore = () => {
  if (stillness) {
    return;
  }
  const score = `${SCORE.CURRENT}`;

  ctx.font = "44px FlappyBird";
  const text = ctx.measureText(score);

  const x = width / 2 - text.width / 2;
  const y = 120;

  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.lineWidth = 8;
  ctx.strokeText(score, x, y);
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillText(score, x, y);
};

const init = () => {
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = width;
  canvas.height = height;

  updateScore();
  start();
  whenPlayerLose();
  setTimeout(() => addLightningStrike(), 1000);
};

const whenPlayerJump = () => {
  if (stillness) return;

  /* When user stillness */
  if (player.stillness) {
    player.stillness = false;
    player.gravity = CONFIG.GRAVITY;
  } else {
    pay();
  }

  /* When user pressed space */
  player.velocity = CONFIG.PLAYER_VELOCITY_WHILE_JUMP;

  JUMP_KEY_PRESSED = true;
};

const pay = async () => {
  if (!pipes.some((pipe) => player.position.x >= pipe.position.x)) {
    return;
  }
  try {
    const invoice = await ln.requestInvoice({
      satoshi: 1,
      comment: "zappy bird - " + gameUniqueId,
    });
    const result = await window.webln.sendPayment(invoice.paymentRequest);
    if (!result.preimage) {
      throw new Error("No preimage received");
    }

    ++SCORE.CURRENT;

    addLightningStrike();
  } catch (error) {
    //whenPlayerLose();
    console.error("Lightning payment failed", error);
  }
};

const addLightningStrike = () => {
  lightningStrikes.push(
    new LightningStrike({
      ctx,
      width,
      height,
      groundHeight: SIZES.GROUND.HEIGHT,
    })
  );
};

const drawRestartButton = () => {
  const w = 142;
  const h = 50;

  ctx.drawImage(
    restartImage,
    width / 2 - w / 2,
    /*height / 2 - (h - 2)*/ 300,
    w,
    h
  );
};

canvas.addEventListener("mousedown", whenPlayerJump);

document.addEventListener("keypress", ({ keyCode }) => {
  if (![32, 38].includes(keyCode) || JUMP_KEY_PRESSED) return;

  if (player.lose) {
    if (canRestart) {
      restart();
    }
    return;
  }

  whenPlayerJump();
});

document.addEventListener("keyup", ({ keyCode }) => {
  if (![32, 38].includes(keyCode)) return;

  JUMP_KEY_PRESSED = false;
});

canvas.addEventListener("mouseup", () => {
  JUMP_KEY_PRESSED = false;
});

/* When dom content loaded */
document.addEventListener("DOMContentLoaded", init);
