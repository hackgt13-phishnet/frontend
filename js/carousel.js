/****************** Stories ******************/
const image_profile = [
    ['https://i.pravatar.cc/150?img=12', 'kaushme...'],
    ['https://i.pravatar.cc/150?img=33', 'rohan_de...'],
    ['https://i.pravatar.cc/150?img=5', 'ananya.s...'],
    ['https://i.pravatar.cc/150?img=47', 'dev_trades'],
    ['https://i.pravatar.cc/150?img=20', 'mia.chen'],
    ['https://i.pravatar.cc/150?img=68', 'alex.kim'],
    ['https://i.pravatar.cc/150?img=15', 'sara_lee'],
    ['https://i.pravatar.cc/150?img=25', 'jay.park'],
    ['https://i.pravatar.cc/150?img=41', 'nina.v'],
    ['https://i.pravatar.cc/150?img=52', 'omar.k'],
];

const story_container = document.querySelector('.owl-carousel.items');
if (story_container) {
    for (var i = 0; i < image_profile.length; i++) {
        const parentDiv = document.createElement('div');
        parentDiv.classList.add('item_s');
        parentDiv.innerHTML = `
            <div class="story-ring">
              <div class="story-ring-inner">
                <img src="${image_profile[i][0]}" alt="${image_profile[i][1]}">
              </div>
            </div>
            <p>${image_profile[i][1]}</p>
        `;
        story_container.appendChild(parentDiv);
    }
}

$(document).ready(function () {
    $('.owl-carousel').owlCarousel({
        loop: false,
        margin: 4,
        nav: true,
        dots: false,
        responsiveClass: true,
        responsive: {
            0: {
                items: 4,
                nav: false,
            },
            500: {
                items: 5,
                nav: true,
            },
            768: {
                items: 6,
                nav: true,
            },
        },
    });
});
