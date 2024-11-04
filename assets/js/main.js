// Dictionary of image sources and alt texts
const imgDict = {
    "Astra": "assets/img/icons/astra-icon.webp",
    "Breach": "assets/img/icons/breach-icon.webp",
    "Brimstone": "assets/img/icons/brimstone-icon.webp",
    "Chamber": "assets/img/icons/chamber-icon.webp",
    "Clove": "assets/img/icons/clove-icon.webp",
    "Cypher": "assets/img/icons/cypher-icon.webp",
    "Deadlock": "assets/img/icons/deadlock-icon.webp",
    "Fade": "assets/img/icons/fade-icon.webp",
    "Gekko": "assets/img/icons/gekko-icon.webp",
    "Harbor": "assets/img/icons/harbor-icon.webp",
    "Iso": "assets/img/icons/iso-icon.webp",
    "Jett": "assets/img/icons/jett-icon.webp",
    "Kayo": "assets/img/icons/kayo-icon.webp",
    "Killjoy": "assets/img/icons/killjoy-icon.webp",
    "Neon": "assets/img/icons/neon-icon.webp",
    "Omen": "assets/img/icons/omen-icon.webp",
    "Phoenix": "assets/img/icons/phoenix-icon.webp",
    "Raze": "assets/img/icons/raze-icon.webp",
    "Reyna": "assets/img/icons/reyna-icon.webp",
    "Sage": "assets/img/icons/sage-icon.webp",
    "Skye": "assets/img/icons/skye-icon.webp",
    "Sova": "assets/img/icons/sova-icon.webp",
    "Viper": "assets/img/icons/viper-icon.webp",
    "Vyse": "assets/img/icons/vyse-icon.webp",
    "Yoru": "assets/img/icons/yoru-icon.webp"
};

const timeUntilChosen = 3000; // in milliseconds
const checkInterval = 100; // in milliseconds
let chosenAgent;
let intervalId;

    function populateAgents() {
    const agentsDiv = document.getElementById('agents');
    const imgKeys = Object.keys(imgDict);
    const totalImages = 102;

    for (let i = 0; i < totalImages; i++) {
        const randomKey = imgKeys[Math.floor(Math.random() * imgKeys.length)];
        const imgElement = document.createElement('img');
        imgElement.src = imgDict[randomKey];
        imgElement.alt = randomKey;
        agentsDiv.appendChild(imgElement);
    }
}
let counter = 0;

function checkIntersectionWithRedLine() {
    const redLine = document.getElementById('red-line');
    const redLineRect = redLine.getBoundingClientRect();
    const images = document.querySelectorAll('#agents > img');
    images.forEach(img => {
        const imgRect = img.getBoundingClientRect();
        // Check if the image is intersecting the red line
        if (
            imgRect.left < redLineRect.left &&
            imgRect.right > redLineRect.left && counter < (timeUntilChosen / checkInterval)
        ) {
            counter++;
        } else if (imgRect.left < redLineRect.left &&
            imgRect.right > redLineRect.left && counter === (timeUntilChosen / checkInterval)) {
            // img.classList.add('chosen-agent');
            console.log(`${img.alt}`);
            clearInterval(intervalId);
            intervalId = null;
            chosenAgent = img.alt;
            const modal = document.getElementById('modal');
            modal.style.display = 'block';
            const agentName = document.getElementById('agent-name');
            agentName.textContent = chosenAgent;
            const agentImg = document.getElementById('agent-image');
            agentImg.src = "assets/img/agents-full/" + chosenAgent.toLowerCase() + ".webp";
            console.log(agentImg.src);

            counter++;
        }
    });
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
}

function resetRaffle() {
    const agentsDiv = document.getElementById('agents');
    agentsDiv.innerHTML = '<div id="red-line"></div>';
    counter = 0;
    if (intervalId) {
        clearInterval(intervalId);
    }
}

async function startRaffle() {
    const raffleButton = document.getElementById('btn');
    raffleButton.disabled = true;
    await resetRaffle();

    populateAgents();
    intervalId = setInterval(checkIntersectionWithRedLine, checkInterval);
    setTimeout(() => {
        raffleButton.disabled = false;
    }, timeUntilChosen);
}

