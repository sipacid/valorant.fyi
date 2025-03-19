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
        const cardWrap = document.createElement('div');
        cardWrap.className = 'card-wrap';
        cardWrap.style.setProperty('--random-rotation-x', this.xRotation);
        cardWrap.style.setProperty('--random-rotation-y', this.yRotation);
        cardWrap.style.setProperty('--position', this.position);

        const card = document.createElement('article');
        card.className = 'card';

        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';
        cardFront.style.backgroundImage = `url(${this.background})`;

        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';

        const header = document.createElement('header');
        const h1 = document.createElement('h1');
        h1.textContent = this.title;

        const img = document.createElement('img');
        img.src = this.imgSrc;
        img.alt = this.imgAlt;

        header.appendChild(h1);
        cardContent.appendChild(header);
        cardContent.appendChild(img);
        cardFront.appendChild(cardContent);

        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';

        card.appendChild(cardFront);
        card.appendChild(cardBack);
        cardWrap.appendChild(card);

        return cardWrap;
    }
}

const getRandomBackground = () => `./assets/img/card-backgrounds/card-background-${Math.floor(Math.random() * 5) + 1}.svg`;

const cardsData = [
    { title: 'Astra', imgSrc: './assets/img/agents-full/astra.webp', imgAlt: 'Astra' },
    { title: 'Breach', imgSrc: './assets/img/agents-full/breach.webp', imgAlt: 'Breach' },
    { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Chamber', imgSrc: './assets/img/agents-full/chamber.webp', imgAlt: 'Chamber' },
    { title: 'Clove', imgSrc: './assets/img/agents-full/clove.webp', imgAlt: 'Clove' },
    { title: 'Cypher', imgSrc: './assets/img/agents-full/cypher.webp', imgAlt: 'Cypher' },
    { title: 'Deadlock', imgSrc: './assets/img/agents-full/deadlock.webp', imgAlt: 'Deadlock' },
    { title: 'Fade', imgSrc: './assets/img/agents-full/fade.webp', imgAlt: 'Fade' },
    { title: 'Gekko', imgSrc: './assets/img/agents-full/gekko.webp', imgAlt: 'Gekko' },
    { title: 'Harbor', imgSrc: './assets/img/agents-full/harbor.webp', imgAlt: 'Harbor' },
    { title: 'Iso', imgSrc: './assets/img/agents-full/iso.webp', imgAlt: 'Iso' },
    { title: 'Jett', imgSrc: './assets/img/agents-full/jett.webp', imgAlt: 'Jett' },
    { title: 'KAY/O', imgSrc: './assets/img/agents-full/kayo.webp', imgAlt: 'KAY/O' },
    { title: 'Killjoy', imgSrc: './assets/img/agents-full/killjoy.webp', imgAlt: 'Killjoy' },
    { title: 'Neon', imgSrc: './assets/img/agents-full/neon.webp', imgAlt: 'Neon' },
    { title: 'Omen', imgSrc: './assets/img/agents-full/omen.webp', imgAlt: 'Omen' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Raze', imgSrc: './assets/img/agents-full/raze.webp', imgAlt: 'Raze' },
    { title: 'Reyna', imgSrc: './assets/img/agents-full/reyna.webp', imgAlt: 'Reyna' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' },
    { title: 'Skye', imgSrc: './assets/img/agents-full/skye.webp', imgAlt: 'Skye' },
    { title: 'Sova', imgSrc: './assets/img/agents-full/sova.webp', imgAlt: 'Sova' },
    { title: 'Tejo', imgSrc: './assets/img/agents-full/tejo.webp', imgAlt: 'Tejo' },
    { title: 'Viper', imgSrc: './assets/img/agents-full/viper.webp', imgAlt: 'Viper' },
    { title: 'Vyse', imgSrc: './assets/img/agents-full/vyse.webp', imgAlt: 'Vyse' },
    { title: "Waylay", imgSrc: './assets/img/agents-full/waylay.webp', imgAlt: 'Waylay' },
    { title: 'Yoru', imgSrc: './assets/img/agents-full/yoru.webp', imgAlt: 'Yoru' },
];
const sliderElement = document.querySelector('.slider');

function start() {
    let cardPosition = 0;

    cardsData.sort(() => Math.random() - 0.5);
    // make sure cards data has exactly 25 cards
    while (cardsData.length < 25) {
        cardsData.push(cardsData[Math.floor(Math.random() * cardsData.length)]);
    }
    while (cardsData.length > 25) {
        cardsData.pop();
    }

    cardsData.forEach(data => {
        const card = new Card(data.title, data.imgSrc, data.imgAlt, cardPosition++);
        sliderElement.appendChild(card.createCard());
    });
    console.log(cardsData[1].title);
    sliderElement.style.setProperty('--quantity', cardsData.length);
}

start();