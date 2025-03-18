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
    { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' },
    { title: 'Sova', imgSrc: './assets/img/agents-full/sova.webp', imgAlt: 'Sova' },
    { title: 'Viper', imgSrc: './assets/img/agents-full/viper.webp', imgAlt: 'Viper' },
    { title: 'Cypher', imgSrc: './assets/img/agents-full/cypher.webp', imgAlt: 'Cypher' },
    { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' },
    { title: 'Sova', imgSrc: './assets/img/agents-full/sova.webp', imgAlt: 'Sova' },
    { title: 'Viper', imgSrc: './assets/img/agents-full/viper.webp', imgAlt: 'Viper' },
    { title: 'Cypher', imgSrc: './assets/img/agents-full/cypher.webp', imgAlt: 'Cypher' }, { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' },
    { title: 'Sova', imgSrc: './assets/img/agents-full/sova.webp', imgAlt: 'Sova' },
    { title: 'Viper', imgSrc: './assets/img/agents-full/viper.webp', imgAlt: 'Viper' },
    { title: 'Cypher', imgSrc: './assets/img/agents-full/cypher.webp', imgAlt: 'Cypher' },
    { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' },
    { title: 'Sova', imgSrc: './assets/img/agents-full/sova.webp', imgAlt: 'Sova' },
    { title: 'Viper', imgSrc: './assets/img/agents-full/viper.webp', imgAlt: 'Viper' },
    { title: 'Cypher', imgSrc: './assets/img/agents-full/cypher.webp', imgAlt: 'Cypher' }, { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' },
    { title: 'Sova', imgSrc: './assets/img/agents-full/sova.webp', imgAlt: 'Sova' },
];

const sliderElement = document.querySelector('.slider');
let cardPosition = 0;
cardsData.forEach(data => {
    const card = new Card(data.title, data.imgSrc, data.imgAlt, cardPosition++);
    sliderElement.appendChild(card.createCard());
});

sliderElement.style.setProperty('--quantity', cardsData.length);

