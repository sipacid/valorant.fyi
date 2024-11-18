const CONFIG = {
  checkInterval: 8,
  agentsPerRound: 310,
  modalFadeTime: 500,
  scrollSpeed: 3,
  easeEffect: "cubic-bezier(0.4, 0, 0.2, 1)",
  intersectionDistance: 100,
};

/** @type {Object.<string, string>} */
const imgDict = {
  Astra: "assets/img/icons/astra-icon.webp",
  Breach: "assets/img/icons/breach-icon.webp",
  Brimstone: "assets/img/icons/brimstone-icon.webp",
  Chamber: "assets/img/icons/chamber-icon.webp",
  Clove: "assets/img/icons/clove-icon.webp",
  Cypher: "assets/img/icons/cypher-icon.webp",
  Deadlock: "assets/img/icons/deadlock-icon.webp",
  Fade: "assets/img/icons/fade-icon.webp",
  Gekko: "assets/img/icons/gekko-icon.webp",
  Harbor: "assets/img/icons/harbor-icon.webp",
  Iso: "assets/img/icons/iso-icon.webp",
  Jett: "assets/img/icons/jett-icon.webp",
  Kayo: "assets/img/icons/kayo-icon.webp",
  Killjoy: "assets/img/icons/killjoy-icon.webp",
  Neon: "assets/img/icons/neon-icon.webp",
  Omen: "assets/img/icons/omen-icon.webp",
  Phoenix: "assets/img/icons/phoenix-icon.webp",
  Raze: "assets/img/icons/raze-icon.webp",
  Reyna: "assets/img/icons/reyna-icon.webp",
  Sage: "assets/img/icons/sage-icon.webp",
  Skye: "assets/img/icons/skye-icon.webp",
  Sova: "assets/img/icons/sova-icon.webp",
  Viper: "assets/img/icons/viper-icon.webp",
  Vyse: "assets/img/icons/vyse-icon.webp",
  Yoru: "assets/img/icons/yoru-icon.webp",
};

/** @type {Object.<string, HTMLElement>} */
const elements = {
  modalAgentName: document.getElementById("agent-name"),
  modalAgentImg: document.getElementById("agent-image"),
  modal: document.getElementById("modal"),
  agentsList: document.getElementById("agents"),
  raffleButton: document.getElementById("btn"),
  centerLine: document.querySelector(".center-line"),
};

let intervalId = null;
let counter = 0;
let isRaffleRunning = false;

/**
 * @returns {void}
 * @throws {Error} If required DOM elements are not found
 */
function validateElements() {
  for (const [key, element] of Object.entries(elements)) {
    if (!element) throw new Error(`Required element ${key} not found`);
  }
}

async function populateAgents() {
  const fragment = document.createDocumentFragment();
  const imgKeys = Object.keys(imgDict);
  const imageLoadPromises = [];

  for (let i = 0; i < CONFIG.agentsPerRound; i++) {
    const randomAgent = imgKeys[Math.floor(Math.random() * imgKeys.length)];
    const intersectObject = document.createElement("div");
    intersectObject.classList.add("intersect_object");
    intersectObject.id = randomAgent;

    const imgElement = document.createElement("img");
    imgElement.src = imgDict[randomAgent];
    imgElement.alt = randomAgent;

    const loadPromise = new Promise((resolve, reject) => {
      imgElement.onload = resolve;
      imgElement.onerror = reject;
    });
    imageLoadPromises.push(loadPromise);

    intersectObject.appendChild(imgElement);
    fragment.appendChild(intersectObject);
  }

  elements.agentsList.innerHTML = "";
  elements.agentsList.appendChild(fragment);

  await Promise.all(imageLoadPromises);
}

function checkIntersectionWithLine() {
  if (!isRaffleRunning) return;

  const firstAgent = document.querySelector(".intersect_object");
  const progress = getAnimationProgress(firstAgent);

  if (progress < 0.99) return;

  const centerX = window.innerWidth / 2;
  const agents = document.querySelectorAll(".intersect_object");
  let closestAgent = null;
  let minDistance = Infinity;

  agents.forEach((agent) => {
    const rect = agent.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - centerX);
    if (distance < minDistance) {
      minDistance = distance;
      closestAgent = { element: agent, distance };
    }
  });

  if (closestAgent && closestAgent.distance < 50) {
    closestAgent.element.classList.add("active");
    clearInterval(intervalId);
    isRaffleRunning = false;
    showModal(closestAgent.element.id);
  }
}

function getAnimationProgress(element) {
  if (!element) return 1;
  const animation = element.getAnimations()[0];
  if (!animation) return 1;
  return animation.currentTime / animation.effect.getComputedTiming().duration;
}

function showModal(chosenAgent) {
  if (!chosenAgent || elements.modal.style.display === "flex") return;

  elements.modalAgentName.textContent = chosenAgent;
  elements.modalAgentImg.src = `assets/img/agents-full/${chosenAgent.toLowerCase()}.webp`;
  elements.modal.classList.remove("hidden");
  elements.modal.style.display = "flex";
}

const closeModal = () => {
  elements.modal.classList.add("hidden");
  resetRaffle();
};

function resetRaffle() {
  elements.agentsList.innerHTML = "";
  elements.centerLine.style.visibility = "hidden";
  elements.centerLine.style.opacity = "0";
  counter = 0;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  setTimeout(() => {
    elements.modal.style.display = "none";
    elements.modalAgentImg.src = "";
    elements.modalAgentName.textContent = "";
  }, CONFIG.modalFadeTime);
}

async function startRaffle() {
  if (isRaffleRunning) return;

  try {
    isRaffleRunning = true;
    elements.raffleButton.disabled = true;
    elements.agentsList.innerHTML = "";
    elements.centerLine.style.visibility = "visible";
    elements.centerLine.style.opacity = "1";

    await populateAgents();

    requestAnimationFrame(() => {
      document.querySelectorAll(".intersect_object").forEach((div) => {
        div.style.animation = `scroll ${CONFIG.scrollSpeed}s ${CONFIG.easeEffect} forwards`;
      });
      intervalId = setInterval(checkIntersectionWithLine, CONFIG.checkInterval);
    });

    setTimeout(
      () => {
        if (isRaffleRunning) {
          checkIntersectionWithLine();
        }
        elements.raffleButton.disabled = false;
      },
      CONFIG.scrollSpeed * 1000 + 100,
    );
  } catch (error) {
    console.error("Raffle error:", error);
    elements.raffleButton.disabled = false;
    isRaffleRunning = false;
    elements.centerLine.style.visibility = "hidden";
    elements.centerLine.style.opacity = "0";
  }
}

elements.modal.addEventListener("click", closeModal);
elements.raffleButton.addEventListener("click", startRaffle);
