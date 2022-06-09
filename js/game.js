/*
   Copyright 2014 Nebez Briefkani
   floppybird - main.js

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

const openGameButton = document.querySelector(".game-btn");
const gameWindowBackground = document.querySelector(".game-background");
const gameContainerElement = document.querySelector("#gamecontainer");
const animatedElements = document.querySelectorAll(".animated");

gameWindowBackground.addEventListener("click", () => {
  const gameElement = document.querySelector(".game");
  gameElement.classList.remove("game-opened");
});

openGameButton.addEventListener("click", () => {
  const gameElement = document.querySelector(".game");
  const scoreBoardElement = document.querySelector("#scoreboard");
  gameElement.classList.add("game-opened");
  scoreBoardElement.style.display = "none";
  showSplash();
});

const debugMode = false;

const states = Object.freeze({
  SplashScreen: 0,
  GameScreen: 1,
  ScoreScreen: 2,
});

let currentstate;

const gravity = 0.25;
const jump = -4.6;
let velocity = 0;
let position = 180;
let rotation = 0;

let score = 0;
let highscore = 0;

const pipeheight = 100;
const pipewidth = 52;
let pipes = new Array();

let replayclickable = false;

//sounds
const volume = 15;
const soundJump = new Audio("../sounds/sfx_wing.ogg");
const soundScore = new Audio("../sounds/sfx_point.ogg");
const soundHit = new Audio("../sounds/sfx_hit.ogg");
const soundDie = new Audio("../sounds/sfx_die.ogg");
const soundSwoosh = new Audio("../sounds/sfx_swooshing.ogg");
soundJump.volume = volume / 100;
soundScore.volume = volume / 100;
soundHit.volume = volume / 100;
soundDie.volume = volume / 100;
soundSwoosh.volume = volume / 100;

//loops
let loopGameloop;
let loopPipeloop;
let soundHitTimer;
let scoreBoardAnimationTimer;

function getCookie(cname) {
  const name = cname + "=";
  document.cookie.split(";").forEach((ca) => {
    c = ca.trim();
    if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  });
  return "";
}

function setCookie(cname, cvalue, exdays) {
  const d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  const expires = "expires=" + d.toGMTString();
  document.cookie = cname + "=" + cvalue + "; " + expires;
}

function showSplash() {
  clearTimeout(scoreBoardAnimationTimer);

  const playerElement = document.querySelector("#player");
  const pipeElements = document.querySelectorAll(".pipe");
  const splashElement = document.querySelector("#splash");
  const medalElement = document.querySelector("#medal");
  medalElement.classList.add("medal-scale");

  currentstate = states.SplashScreen;

  //set the defaults (again)
  velocity = 0;
  position = 180;
  rotation = 0;
  score = 0;

  //update the player in preparation for the next game
  playerElement.style.transform = "translateY: 0, translateX: 0";
  updatePlayer(playerElement);

  if (document.querySelector(".game").classList.contains(".game-opened")) {
    soundSwoosh.pause();
    soundSwoosh.currentTime = 0;
    soundSwoosh.play();
  }

  //clear out all the pipes if there are any
  pipeElements.forEach((pipeElement) => {
    pipeElement.remove();
  });
  pipes = new Array();

  //make everything animated again
  animatedElements.forEach((animatedElement) => {
    animatedElement.style.cssText = `animation-play-state: running; -webkit-animation-play-state: running`;
  });

  //fade in the splash
  splashElement.style.transition = "opacity 2s ease";
  splashElement.style.opacity = 1;
}

function startGame() {
  const splashElement = document.querySelector("#splash");
  currentstate = states.GameScreen;

  //fade out the splash
  splashElement.style.transition = "opacity 0.5s ease";
  splashElement.style.opacity = 0;

  //update the big score
  setBigScore();

  //start up our loops
  const updaterate = 1000.0 / 60.0; //60 times a second
  loopGameloop = setInterval(gameloop, updaterate);
  loopPipeloop = setInterval(updatePipes, 1400);

  //jump from the start!
  playerJump();
}

function updatePlayer(player) {
  // rotation
  rotation = Math.min((velocity / 10) * 90, 90);
  //apply rotation and position
  player.style.cssText = `transform: rotate(${rotation}deg); top: ${position}px`;
}

function gameloop() {
  const playerElement = document.querySelector("#player");
  const landElement = document.querySelector("#land");
  const ceilingElement = document.querySelector("#ceiling");

  //update the player speed/position
  velocity += gravity;
  position += velocity;

  //update the player
  updatePlayer(playerElement);

  //create the bounding box
  const box = playerElement.getBoundingClientRect();
  const origwidth = 34.0;
  const origheight = 24.0;

  const boxwidth = origwidth - Math.sin(Math.abs(rotation) / 90) * 8;
  const boxheight = (origheight + box.height) / 2;
  const boxleft = (box.width - boxwidth) / 2 + box.left;
  const boxtop = (box.height - boxheight) / 2 + box.top;
  const boxright = boxleft + boxwidth;
  const boxbottom = boxtop + boxheight;

  //did we hit the ground?
  if (box.bottom >= landElement.getBoundingClientRect().top) {
    playerDead();
    return;
  }

  //have they tried to escape through the ceiling? :o
  const ceilingBox = ceilingElement.getBoundingClientRect();

  if (boxtop <= ceilingBox.top + ceilingBox.height) {
    position = 0;
  }

  //we can't go any further without a pipe
  if (pipes[0] == null) {
    return;
  }

  //determine the bounding box of the next pipes inner area
  const nextPipe = pipes[0];
  const nextPipeUpperBox = nextPipe.firstChild.getBoundingClientRect();
  const pipeTop = nextPipeUpperBox.top + nextPipeUpperBox.height;
  const pipeLeft = nextPipeUpperBox.left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
  const piperight = pipeLeft + pipewidth;
  const pipebottom = pipeTop + pipeheight;

  //have we gotten inside the pipe yet?
  if (boxright > pipeLeft) {
    //we're within the pipe, have we passed between upper and lower pipes?
    if (boxtop > pipeTop && boxbottom < pipebottom) {
      //yeah! we're within bounds
    } else {
      //no! we touched the pipe
      playerDead();
      return;
    }
  }

  //have we passed the imminent danger?
  if (boxleft > piperight) {
    //yes, remove it
    pipes.splice(0, 1);

    //and score a point
    playerScore();
  }
}

//Handle mouse down OR touch start
if ("ontouchstart" in gameContainerElement)
  gameContainerElement.addEventListener("touchstart", screenClick);
else gameContainerElement.addEventListener("mousedown", screenClick);

function screenClick() {
  if (currentstate == states.GameScreen) {
    playerJump();
  } else if (currentstate == states.SplashScreen) {
    startGame();
  }
}

function playerJump() {
  velocity = jump;
  //play jump sound
  soundJump.pause();
  soundJump.currentTime = 0;
  soundJump.play();
}

function setBigScore(erase) {
  const bigScoreElement = document.querySelector("#bigscore");
  const bigScoreElementChild = Array.prototype.slice.call(
    bigScoreElement.childNodes
  );
  bigScoreElementChild.forEach((child) => {
    bigScoreElement.removeChild(child);
  });

  if (erase) {
    return;
  }

  score
    .toString()
    .split("")
    .forEach((digit) => {
      const bigScoreImageElement = document.createElement("img");
      bigScoreImageElement.src = `../img/assets/font_big_${digit}.png`;
      bigScoreImageElement.alt = `${digit}`;

      bigScoreElement.append(bigScoreImageElement);
    });
}

function setSmallScore() {
  const currentScoreElement = document.querySelector("#currentscore");
  const currentScoreElementChild = Array.prototype.slice.call(
    currentScoreElement.childNodes
  );

  currentScoreElementChild.forEach((child) =>
    currentScoreElement.removeChild(child)
  );

  score
    .toString()
    .split("")
    .forEach((digit) => {
      const currentScoreImageElement = document.createElement("img");
      currentScoreImageElement.src = `../img/assets/font_small_${digit}.png`;
      currentScoreImageElement.alt = `${digit}`;
      currentScoreElement.append(currentScoreImageElement);
    });
}

function setHighScore() {
  const highScoreElement = document.querySelector("#highscore");
  const highScoreElementChild = Array.prototype.slice.call(
    highScoreElement.childNodes
  );

  highScoreElementChild.forEach((child) => highScoreElement.removeChild(child));

  score
    .toString()
    .split("")
    .forEach((digit) => {
      const highScoreImageElement = document.createElement("img");
      highScoreImageElement.src = `../img/assets/font_small_${digit}.png`;
      highScoreImageElement.alt = `${digit}`;
      highScoreElement.append(highScoreImageElement);
    });
}

function setMedal() {
  const medalElement = document.querySelector("#medal");
  const medalImageElement = document.createElement("img");
  const medalElementChild = Array.prototype.slice.call(medalElement.childNodes);
  medalElementChild.forEach((child) => medalElement.removeChild(child));

  if (score < 10) return false;
  //signal that no medal has been won

  if (score >= 10) medal = "bronze";
  if (score >= 20) medal = "silver";
  if (score >= 30) medal = "gold";
  if (score >= 40) medal = "platinum";

  medalImageElement.src = `../img/assets/medal_${medal}.png`;
  medalImageElement.alt = `${medal}`;

  medalElement.append(medalImageElement);

  //signal that a medal has been won
  return true;
}

function playerDead() {
  const scoreBoardElement = document.querySelector("#scoreboard");
  const playerElement = document.querySelector("#player");
  const flyAreaElement = document.querySelector("#flyarea");
  const playerElementBox = playerElement.getBoundingClientRect();
  const flyAreaElementBox = flyAreaElement.getBoundingClientRect();

  //stop animating everything!
  animatedElements.forEach((animatedElement) => {
    animatedElement.style.cssText = `animation-play-state: paused; -webkit-animation-play-state: paused`;
  });

  //drop the bird to the floor
  const playerBottom = playerElementBox.top + playerElementBox.width; //we use width because he'll be rotated 90 deg
  const floor = flyAreaElementBox.height;
  const movey = Math.max(0, floor - playerBottom);

  playerElement.style.transition = "transform 1s ease-in-out";
  playerElement.style.cssText = `transform: translateY(${movey}px) rotate(0deg)`;

  //it's time to change states. as of now we're considered ScoreScreen to disable left click/flying
  currentstate = states.ScoreScreen;

  //destroy our gameloops
  clearInterval(loopGameloop);
  clearInterval(loopPipeloop);
  loopGameloop = null;
  loopPipeloop = null;

  scoreBoardElement.style.display = "block";

  soundHit.play();

  soundHitTimer = setTimeout(() => {
    soundDie.play();
    showScore();
  }, 500);
}

function showScore() {
  clearTimeout(soundHitTimer);

  const scoreBoardElement = document.querySelector("#scoreboard");
  const replayElement = document.querySelector("#replay");
  const medalElement = document.querySelector("#medal");

  //unhide us
  scoreBoardElement.classList.add("score-board-show");
  medalElement.classList.add("medal-scale");

  //remove the big score
  setBigScore(true);

  //have they beaten their high score?
  if (score > highscore) {
    //yeah!
    highscore = score;
    //save it!
    setCookie("highscore", highscore, 999);
  }

  //update the scoreboard
  setSmallScore();
  setHighScore();
  const wonmedal = setMedal();

  //SWOOSH!
  soundSwoosh.pause();
  soundSwoosh.currentTime = 0;
  soundSwoosh.play();

  //show the scoreboard

  scoreBoardAnimationTimer = setTimeout(() => {
    soundSwoosh.pause();
    soundSwoosh.currentTime = 0;
    soundSwoosh.play();
    replayElement.classList.add("replay-show");

    if (wonmedal) {
      medalElement.classList.remove("medal-scale");
    }
  }, 600);

  //make the replay button clickable
  replayclickable = true;
}

document.querySelector("#replay").addEventListener("click", () => {
  clearTimeout(scoreBoardAnimationTimer);

  const scoreBoardElement = document.querySelector("#scoreboard");
  const replayElement = document.querySelector("#replay");

  //make sure we can only click once
  if (!replayclickable) return;
  else replayclickable = false;
  //SWOOSH!
  soundSwoosh.pause();
  soundSwoosh.currentTime = 0;
  soundSwoosh.play();

  //fade out the scoreboard

  scoreBoardElement.classList.add("score-board-hide");
  scoreBoardAnimationTimer = setTimeout(() => {
    scoreBoardElement.style.display = "none";
    replayElement.classList.remove("replay-show");
    scoreBoardElement.classList.remove("score-board-show", "score-board-hide");

    showSplash();
  }, 1000);
});

function playerScore() {
  score += 1;
  //play score sound
  soundScore.pause();
  soundScore.currentTime = 0;
  soundScore.play();
  setBigScore();
}

function updatePipes() {
  const pipeElements = document.querySelectorAll(".pipe");
  const flyAreaElement = document.querySelector("#flyarea");

  const newPipeElement = document.createElement("div");
  const newPipeUpperElement = document.createElement("div");
  const newPipeLowerElement = document.createElement("div");
  newPipeElement.classList.add("pipe", "animated");
  newPipeUpperElement.classList.add("pipe_upper");
  newPipeLowerElement.classList.add("pipe_lower");

  //Do any pipes need removal?
  pipeElements.forEach((pipeElement) => {
    if (pipeElement.getBoundingClientRect().left <= -100) {
      pipeElement.remove();
    }
  });

  //add a new pipe (top height + bottom height  + pipeheight == 420) and put it in our tracker
  const padding = 80;
  const constraint = 420 - pipeheight - padding * 2; //double padding (for top and bottom)
  const topheight = Math.floor(Math.random() * constraint + padding); //add lower padding
  const bottomheight = 420 - pipeheight - topheight;

  newPipeUpperElement.style.cssText = `height: ${topheight}px`;
  newPipeLowerElement.style.cssText = `height: ${bottomheight}px`;

  newPipeElement.append(newPipeUpperElement);
  newPipeElement.append(newPipeLowerElement);
  flyAreaElement.append(newPipeElement);
  pipes.push(newPipeElement);
}

const isIncompatible = {
  Android: function () {
    return navigator.userAgent.match(/Android/i);
  },
  BlackBerry: function () {
    return navigator.userAgent.match(/BlackBerry/i);
  },
  iOS: function () {
    return navigator.userAgent.match(/iPhone|iPad|iPod/i);
  },
  Opera: function () {
    return navigator.userAgent.match(/Opera Mini/i);
  },
  Safari: function () {
    return (
      navigator.userAgent.match(/OS X.*Safari/) &&
      !navigator.userAgent.match(/Chrome/)
    );
  },
  Windows: function () {
    return navigator.userAgent.match(/IEMobile/i);
  },
  any: function () {
    return (
      isIncompatible.Android() ||
      isIncompatible.BlackBerry() ||
      isIncompatible.iOS() ||
      isIncompatible.Opera() ||
      isIncompatible.Safari() ||
      isIncompatible.Windows()
    );
  },
};
