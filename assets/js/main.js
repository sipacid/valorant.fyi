// Dictionary of image sources and alt texts
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

const timeUntilChosen = 3000; // in milliseconds
const checkInterval = 100; // in milliseconds
let intervalId;
const modalAgentName = document.getElementById("agent-name");
const modalAgentImg = document.getElementById("agent-image");
const modal = document.getElementById("modal");
const agentsListElement = document.getElementById("agents");
const raffleButton = document.getElementById("btn");

function populateAgents() {
  const imgKeys = Object.keys(imgDict);
  const totalImages = 102;

  for (let i = 0; i < totalImages; i++) {
    const randomAgent = imgKeys[Math.floor(Math.random() * imgKeys.length)];

    const intersectObject = document.createElement("div");
    intersectObject.classList.add("intersect_object");
    intersectObject.id = randomAgent;

    const imgElement = document.createElement("img");
    imgElement.src = imgDict[randomAgent];
    imgElement.alt = randomAgent;

    intersectObject.appendChild(imgElement);
    agentsListElement.appendChild(intersectObject);
  }
}

let counter = 0;

function checkIntersectionWithLine() {
  const intersectLine = document.getElementById("red-line");
  const intersectLineRect = intersectLine.getBoundingClientRect();
  const agents = document.querySelectorAll("#agents > .intersect_object");
  agents.forEach((agent) => {
    const imgRect = agent.getBoundingClientRect();
    // Check if the image is intersecting the red line
    if (
      imgRect.left < intersectLineRect.left &&
      imgRect.right > intersectLineRect.left &&
      counter < timeUntilChosen / checkInterval
    ) {
      counter++;
    } else if (
      imgRect.left < intersectLineRect.left &&
      imgRect.right > intersectLineRect.left &&
      counter === timeUntilChosen / checkInterval
    ) {
      clearInterval(intervalId);
      showModal(agent.id);
      counter++;
    }
  });
}

function showModal(chosenAgent) {
  modalAgentName.textContent = chosenAgent;
  modalAgentImg.src =
    "assets/img/agents-full/" + chosenAgent.toLowerCase() + ".webp";
  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function closeModal() {
  modal.classList.add("hidden");
  resetRaffle();
}

function resetRaffle() {
  agentsListElement.innerHTML = '<div id="red-line"></div>';
  counter = 0;
  if (intervalId) {
    clearInterval(intervalId);
  }
  intervalId = null;
  setTimeout(() => {
    modal.style.display = "none";
    modalAgentImg.src = "";
    modalAgentName.textContent = "";
  }, 500);
}

async function startRaffle() {
  raffleButton.disabled = true;
  await resetRaffle();
  populateAgents();
  intervalId = setInterval(checkIntersectionWithLine, checkInterval);
  setTimeout(() => {
    raffleButton.disabled = false;
  }, timeUntilChosen);
}
