class Card {
    constructor(title, imgSrc, imgAlt) {
        this.title = title;
        this.imgSrc = imgSrc;
        this.imgAlt = imgAlt;
        this.background = getRandomBackground();
        this.xRotation = Math.random() * 1.2;
        this.yRotation = Math.random() * 1.2;
    }

    createCard() {
        const cardWrap = document.createElement('div');
        cardWrap.className = 'card-wrap';
        cardWrap.style.setProperty('--random-rotation-x', this.xRotation);
        cardWrap.style.setProperty('--random-rotation-y', this.yRotation);

        const card = document.createElement('article');
        card.className = 'card';
        card.style.backgroundImage = `url(${this.background})`;

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
        card.appendChild(cardContent);
        cardWrap.appendChild(card);

        return cardWrap;
    }
}

const getRandomBackground = () => `./assets/img/card-backgrounds/card-background-${Math.floor(Math.random() * 5) + 1}.svg`;

const cardsData = [
    { title: 'Brimstone', imgSrc: './assets/img/agents-full/brimstone.webp', imgAlt: 'Brimstone' },
    { title: 'Phoenix', imgSrc: './assets/img/agents-full/phoenix.webp', imgAlt: 'Phoenix' },
    { title: 'Sage', imgSrc: './assets/img/agents-full/sage.webp', imgAlt: 'Sage' }
];

const mainElement = document.querySelector('main');
cardsData.forEach(data => {
    const card = new Card(data.title, data.imgSrc, data.imgAlt);
    mainElement.appendChild(card.createCard());
});

