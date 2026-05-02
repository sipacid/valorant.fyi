class Card {
  constructor(title, imgSrc, imgAlt, position) {
    this.title = title;
    this.imgSrc = imgSrc;
    this.imgAlt = imgAlt;
    this.background = getRandomBackground();
    this.xRotation = Math.random() * 1.2;
    this.yRotation = Math.random() * 1.2;
    this.position = position;
  }

  createCard() {
    const cardWrap = document.createElement("div");
    cardWrap.className = "card-wrap";
    cardWrap.style.setProperty("--random-rotation-x", this.xRotation);
    cardWrap.style.setProperty("--random-rotation-y", this.yRotation);
    cardWrap.style.setProperty("--position", this.position);

    const card = document.createElement("article");
    card.className = "card";

    const cardFront = document.createElement("div");
    cardFront.className = "card-front";
    cardFront.style.backgroundImage = `url(${this.background})`;

    const cardContent = document.createElement("div");
    cardContent.className = "card-content";

    const header = document.createElement("header");
    const h1 = document.createElement("h1");
    h1.textContent = this.title;

    const img = document.createElement("img");
    img.src = this.imgSrc;
    img.alt = this.imgAlt;

    header.appendChild(h1);
    cardContent.appendChild(header);
    cardContent.appendChild(img);
    cardFront.appendChild(cardContent);

    const cardBack = document.createElement("div");
    cardBack.className = "card-back";

    // .card-inner is the flip pivot — rotates around Y independently of the
    // carousel orbit so back faces become visible on front-of-orbit cards too.
    const cardInner = document.createElement("div");
    cardInner.className = "card-inner";
    cardInner.appendChild(cardFront);
    cardInner.appendChild(cardBack);
    card.appendChild(cardInner);
    cardWrap.appendChild(card);

    return cardWrap;
  }
}

const getRandomBackground = () =>
  `./assets/img/card-backgrounds/card-background-${
    Math.floor(Math.random() * 5) + 1
  }.svg`;

const cardsData = [
  {
    title: "Astra",
    imgSrc: "./assets/img/agents-full/astra.webp",
    imgAlt: "Astra",
  },
  {
    title: "Breach",
    imgSrc: "./assets/img/agents-full/breach.webp",
    imgAlt: "Breach",
  },
  {
    title: "Brimstone",
    imgSrc: "./assets/img/agents-full/brimstone.webp",
    imgAlt: "Brimstone",
  },
  {
    title: "Chamber",
    imgSrc: "./assets/img/agents-full/chamber.webp",
    imgAlt: "Chamber",
  },
  {
    title: "Clove",
    imgSrc: "./assets/img/agents-full/clove.webp",
    imgAlt: "Clove",
  },
  {
    title: "Cypher",
    imgSrc: "./assets/img/agents-full/cypher.webp",
    imgAlt: "Cypher",
  },
  {
    title: "Deadlock",
    imgSrc: "./assets/img/agents-full/deadlock.webp",
    imgAlt: "Deadlock",
  },
  {
    title: "Fade",
    imgSrc: "./assets/img/agents-full/fade.webp",
    imgAlt: "Fade",
  },
  {
    title: "Gekko",
    imgSrc: "./assets/img/agents-full/gekko.webp",
    imgAlt: "Gekko",
  },
  {
    title: "Harbor",
    imgSrc: "./assets/img/agents-full/harbor.webp",
    imgAlt: "Harbor",
  },
  { title: "Iso", imgSrc: "./assets/img/agents-full/iso.webp", imgAlt: "Iso" },
  {
    title: "Jett",
    imgSrc: "./assets/img/agents-full/jett.webp",
    imgAlt: "Jett",
  },
  {
    title: "KAY/O",
    imgSrc: "./assets/img/agents-full/kayo.webp",
    imgAlt: "KAY/O",
  },
  {
    title: "Killjoy",
    imgSrc: "./assets/img/agents-full/killjoy.webp",
    imgAlt: "Killjoy",
  },
  {
    title: "Miks",
    imgSrc: "./assets/img/agents-full/miks.webp",
    imgAlt: "Miks",
  },
  {
    title: "Neon",
    imgSrc: "./assets/img/agents-full/neon.webp",
    imgAlt: "Neon",
  },
  {
    title: "Omen",
    imgSrc: "./assets/img/agents-full/omen.webp",
    imgAlt: "Omen",
  },
  {
    title: "Phoenix",
    imgSrc: "./assets/img/agents-full/phoenix.webp",
    imgAlt: "Phoenix",
  },
  {
    title: "Raze",
    imgSrc: "./assets/img/agents-full/raze.webp",
    imgAlt: "Raze",
  },
  {
    title: "Reyna",
    imgSrc: "./assets/img/agents-full/reyna.webp",
    imgAlt: "Reyna",
  },
  {
    title: "Sage",
    imgSrc: "./assets/img/agents-full/sage.webp",
    imgAlt: "Sage",
  },
  {
    title: "Skye",
    imgSrc: "./assets/img/agents-full/skye.webp",
    imgAlt: "Skye",
  },
  {
    title: "Sova",
    imgSrc: "./assets/img/agents-full/sova.webp",
    imgAlt: "Sova",
  },
  {
    title: "Tejo",
    imgSrc: "./assets/img/agents-full/tejo.webp",
    imgAlt: "Tejo",
  },
  {
    title: "Veto",
    imgSrc: "./assets/img/agents-full/veto.webp",
    imgAlt: "Veto",
  },
  {
    title: "Viper",
    imgSrc: "./assets/img/agents-full/viper.webp",
    imgAlt: "Viper",
  },
  {
    title: "Vyse",
    imgSrc: "./assets/img/agents-full/vyse.webp",
    imgAlt: "Vyse",
  },
  {
    title: "Waylay",
    imgSrc: "./assets/img/agents-full/waylay.webp",
    imgAlt: "Waylay",
  },
  {
    title: "Yoru",
    imgSrc: "./assets/img/agents-full/yoru.webp",
    imgAlt: "Yoru",
  },
];

const TOTAL_CARDS = 25;
const CHOSEN_CARD_INDEX = 1; // The card that will be chosen (0-indexed)
const ANIMATION_DURATION = 3000; // must match .slider animation-duration in CSS

let muted = (() => {
  try {
    return localStorage.getItem("valorant.fyi/muted") === "true";
  } catch {
    return false;
  }
})();

const sliderElement = document.querySelector(".slider");
const startButton = document.querySelector("#start");
const mainElement = document.querySelector("main");

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTick(time, frequency, duration = 0.04, volume = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration);
}

function playImpact(time) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.35);
  gain.gain.setValueAtTime(0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.4);
}

function scheduleSpinSound(durationMs) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const startAt = ctx.currentTime;
  const totalSec = durationMs / 1000;
  const tickCount = 16;
  for (let i = 0; i < tickCount; i++) {
    const p = (i + 0.5) / tickCount;
    // Match the rotation easing — ticks dense at start, sparse at end.
    const t = 1 - Math.pow(1 - p, 2.6);
    const freq = 720 - p * 380;
    playTick(startAt + t * totalSec, freq);
  }
  playImpact(startAt + totalSec);
}

function start() {
  if (!sliderElement || !startButton) {
    console.error("Required elements not found");
    return;
  }

  startButton.style.display = "none";
  if (agentsButton) agentsButton.style.display = "none";
  const landingButtons = document.querySelector(".landing-buttons");
  if (landingButtons) landingButtons.style.display = "none";
  resetSliderAnimation();

  // Filter cardsData to only included agents (defensive fallback to all if empty).
  const included = loadIncludedAgents();
  const pool = cardsData.filter((c) => included.has(c.title));
  const sourcePool = pool.length > 0 ? pool : cardsData;

  let gameCards = shuffleArray(sourcePool);

  while (gameCards.length < TOTAL_CARDS) {
    const randomCard =
      sourcePool[Math.floor(Math.random() * sourcePool.length)];
    gameCards.push(randomCard);
  }

  gameCards = gameCards.slice(0, TOTAL_CARDS);

  let index = 0;
  for (const data of gameCards) {
    const card = new Card(data.title, data.imgSrc, data.imgAlt, index++);
    sliderElement.appendChild(card.createCard());
  }

  sliderElement.style.setProperty("--quantity", gameCards.length);

  // Mark the chosen wrap upfront so its sibling-fade animation can exclude it.
  const wraps = sliderElement.querySelectorAll(".card-wrap");
  if (wraps[CHOSEN_CARD_INDEX])
    wraps[CHOSEN_CARD_INDEX].classList.add("chosen-wrap");

  // Randomize total spin: 5–7 full rotations, always ending at 0° (chosen card faces camera).
  const rotations = 5 + Math.floor(Math.random() * 3);
  sliderElement.style.setProperty("--total-spin", `${-360 * rotations}deg`);

  scheduleSpinSound(ANIMATION_DURATION);

  setTimeout(() => {
    const cards = document.querySelectorAll(".card");
    if (cards[CHOSEN_CARD_INDEX]) {
      const chosenCard = cards[CHOSEN_CARD_INDEX];
      chosenCard.classList.add("chosen-card");
      chosenCard.addEventListener("click", reset);

      requestAnimationFrame(() => {
        chosenCard.classList.add("card-reveal");
      });

      sliderElement.classList.add("spin-complete");
      document.body.classList.add("spin-active");
      mainElement.classList.add("shake");
      setTimeout(() => mainElement.classList.remove("shake"), 320);

      // Create post-spin button row (Spin Again + Agents)
      const postSpinButtons = document.createElement("div");
      postSpinButtons.id = "post-spin-buttons";

      const spinAgain = document.createElement("button");
      spinAgain.id = "spin-again";
      spinAgain.textContent = "Spin Again";
      spinAgain.addEventListener("click", reset);

      const postAgentsBtn = document.createElement("button");
      postAgentsBtn.id = "post-agents-button";
      postAgentsBtn.textContent = "Agents";
      postAgentsBtn.addEventListener("click", openSelection);

      postSpinButtons.appendChild(spinAgain);
      postSpinButtons.appendChild(postAgentsBtn);
      sliderElement.parentNode.appendChild(postSpinButtons);
    }
  }, ANIMATION_DURATION);
}

function resetSliderAnimation() {
  sliderElement.innerHTML = "";
  sliderElement.classList.remove("spin-complete");
  document.body.classList.remove("spin-active");
  const parent = sliderElement.parentNode;
  sliderElement.remove();
  parent.appendChild(sliderElement);
}

function reset() {
  const postSpinButtons = document.querySelector("#post-spin-buttons");
  if (postSpinButtons) postSpinButtons.remove();
  resetSliderAnimation();
  start();
}

// ----- Agent selection -----

const STORAGE_KEY = "valorant.fyi/included-agents";
const agentsButton = document.querySelector("#agents-button");
const selectionOverlay = document.querySelector("#selection-overlay");
const selectionGrid = document.querySelector("#selection-grid");
const selectionAll = document.querySelector("#selection-all");
const selectionNone = document.querySelector("#selection-none");
const selectionDone = document.querySelector("#selection-done");

function loadIncludedAgents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(cardsData.map((c) => c.title));
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set(cardsData.map((c) => c.title));
  }
}

function saveIncludedAgents(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be unavailable; selection just won't persist.
  }
}

function buildSelectionGrid() {
  if (!selectionGrid) return;
  const included = loadIncludedAgents();
  selectionGrid.innerHTML = "";

  for (const data of cardsData) {
    const card = new Card(data.title, data.imgSrc, data.imgAlt, 0);
    const wrap = card.createCard();
    wrap.classList.add("selection-card");
    if (!included.has(data.title)) wrap.classList.add("is-out");

    // Replicate the front-face image into the back face for the grayscale + V design.
    const back = wrap.querySelector(".card-back");
    if (back) {
      const backImg = document.createElement("img");
      backImg.src = data.imgSrc;
      backImg.alt = "";
      backImg.className = "card-back-img";
      back.appendChild(backImg);
    }

    // Persistent name label below the card.
    const label = document.createElement("span");
    label.className = "selection-card-label";
    label.textContent = data.title;
    wrap.appendChild(label);

    wrap.addEventListener("click", () => {
      const set = loadIncludedAgents();
      if (set.has(data.title)) {
        set.delete(data.title);
        wrap.classList.add("is-out");
      } else {
        set.add(data.title);
        wrap.classList.remove("is-out");
      }
      saveIncludedAgents(set);
    });

    selectionGrid.appendChild(wrap);
  }
}

function setAllSelection(included) {
  if (!selectionGrid) return;
  const set = new Set(included ? cardsData.map((c) => c.title) : []);
  saveIncludedAgents(set);
  for (const wrap of selectionGrid.querySelectorAll(".selection-card")) {
    wrap.classList.toggle("is-out", !included);
  }
}

function openSelection() {
  if (!selectionOverlay) return;
  selectionOverlay.hidden = false;
  selectionOverlay.setAttribute("aria-hidden", "false");
}

function closeSelection() {
  if (!selectionOverlay) return;
  selectionOverlay.hidden = true;
  selectionOverlay.setAttribute("aria-hidden", "true");
}

if (agentsButton) agentsButton.addEventListener("click", openSelection);
if (selectionDone) selectionDone.addEventListener("click", closeSelection);
if (selectionAll)
  selectionAll.addEventListener("click", () => setAllSelection(true));
if (selectionNone)
  selectionNone.addEventListener("click", () => setAllSelection(false));

buildSelectionGrid();

const muteButton = document.querySelector("#mute-button");
function syncMuteButton() {
  if (!muteButton) return;
  muteButton.textContent = muted ? "SFX OFF" : "SFX ON";
  muteButton.classList.toggle("is-muted", muted);
}
if (muteButton) {
  muteButton.addEventListener("click", () => {
    muted = !muted;
    try {
      localStorage.setItem("valorant.fyi/muted", String(muted));
    } catch {}
    syncMuteButton();
  });
  syncMuteButton();
}

function preloadAgentImages() {
  for (const { imgSrc } of cardsData) {
    new Image().src = imgSrc;
  }
}

preloadAgentImages();

function createTacticalBackground() {
  const feed = document.createElement("div");
  feed.className = "bg-feed";
  feed.setAttribute("aria-hidden", "true");

  // Each item is ~75px tall (font + gap). The column needs at least one
  // viewport-height of items so the seamless -50% scroll loop never shows gaps.
  // Rounded up to a multiple of LCM(5, 7) = 35 so the nth-child color rules
  // match between the original half and the duplicated half — otherwise colors
  // shift at the loop boundary and read as a visual jump.
  const minItems = Math.max(35, Math.ceil(window.innerHeight / 50));
  const itemsPerColumn = Math.ceil(minItems / 35) * 35;
  const columnCount = 7;

  for (let c = 0; c < columnCount; c++) {
    const col = document.createElement("div");
    // Alternate scroll direction per column for a busier, more chaotic feel.
    const goesDown = c % 2 === 1;
    col.className = goesDown ? "feed-column feed-column--down" : "feed-column";
    col.style.left = `${(c / (columnCount - 1)) * 92 + 4}%`;
    col.style.animationDuration = `${20 + Math.random() * 18}s`;
    col.style.animationDelay = `-${Math.random() * 25}s`;

    // Build the visible list of codenames, then duplicate it so the
    // translateY(-50%) loop is seamless.
    const names = [];
    for (let i = 0; i < itemsPerColumn; i++) {
      names.push(
        cardsData[
          Math.floor(Math.random() * cardsData.length)
        ].title.toUpperCase(),
      );
    }
    for (const name of names.concat(names)) {
      const span = document.createElement("span");
      span.textContent = name;
      col.appendChild(span);
    }

    feed.appendChild(col);
  }

  const scan = document.createElement("div");
  scan.className = "scan-bar";
  scan.setAttribute("aria-hidden", "true");

  document.body.appendChild(feed);
  document.body.appendChild(scan);
}

createTacticalBackground();

// Ambient floating particles
function createParticles() {
  const count = 18;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "vw";
    particle.style.animationDuration = 15 + Math.random() * 15 + "s";
    particle.style.animationDelay = Math.random() * 10 + "s";
    particle.style.width = 1 + Math.random() * 2 + "px";
    particle.style.height = particle.style.width;
    document.body.appendChild(particle);
  }
}

createParticles();
