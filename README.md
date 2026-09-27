# Instagram-UI-v2 + Games + Ask your circle (Muse)

Instagram web clone extended with GamePigeon-style chat games and a Muse-powered **Ask your circle** feature for the Meta social-connection hackathon track.

## Games (main demo)

Needs the API from [hackgt13-phishnet/Backend](https://github.com/hackgt13-phishnet/Backend).
Full run-from-scratch steps, multi-phone setup and how the AI rounds work: [GAMES.md](./GAMES.md).

```bash
../Backend/.venv/bin/python serve.py   # UI + /v1 proxy → http://localhost:8000/messages.html
```

## Ask your circle (separate prototype)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask openai python-dotenv
python server/app.py
```

Open http://localhost:8000

Optional Muse Spark live calls: copy `.env.example` → `.env` and set `MODEL_API_KEY` from https://ai.developer.meta.com/

Without a key, the API uses a local ranking fallback so demos still work.

## Ask your circle

See [DEMO.md](./DEMO.md) for the 90-second Ben Franklin demo script.

- UI: floating **Ask your circle** button + left-nav **Ask circle**
- API: `POST /api/ask-circle` with `{ "query": "..." }`
- Graph: `server/graph.json` (mock followers, posts, DMs, proximity)

## Original clone

Based on Seemikumari/Instagram-UI-v2.0 — home feed, stories, profile, explore, reels, messages.


# Table of Contents
  Demo
  Features
  Technologies Used
  Installation
  Usage
  Contributing
  License
# Demo
 Link to demo : https://seemikumari.github.io/Instagram-UI-v2.0/index.html

# Features
> Home Page: Displays a feed of images fetched from an API.
> Stories Section: Shows user stories with carousel functionality.
> Profile Page: Displays user profile information and posts.
> Explore Section: Allows users to explore various posts and content.
> Responsive Design: Fully responsive design ensuring seamless experience across all devices.
# Technologies Used
>> HTML & CSS
HTML: The backbone of the application providing the structure of the web pages.
CSS: Used for styling the HTML elements to create a visually appealing UI.
>> SCSS
SCSS: A powerful CSS preprocessor that allows for more modular and maintainable stylesheets. It introduces variables, nested rules, and mixins to keep the CSS organized and easier to manage.
>> JavaScript & jQuery
JavaScript: Handles the dynamic interactions on the web pages, such as fetching data from APIs and updating the UI accordingly.
jQuery: Simplifies DOM manipulation, event handling, and Ajax interactions, making the code more concise and easier to write.
>> Bootstrap
Bootstrap: A popular CSS framework that provides pre-styled components and a responsive grid system. It accelerates development and ensures a consistent look and feel across the application.
>> OwlCarousel
OwlCarousel: A jQuery plugin used to create responsive carousel sliders. It enhances the user experience by providing smooth transitions and touch support for the stories section.
# APIs
Image API: Used to fetch images displayed on the home page and stories section. This integration showcases the ability to work with external data sources and dynamically update the UI.

Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

License
This project is licensed under the MIT License. See the LICENSE file for details.

# Images
![Insta UI Home ](https://github.com/Seemikumari/Instagram-UI-v2.0/blob/main/images/Insta%20UI%20Home.jpg)
![Some more UI ](https://github.com/Seemikumari/Instagram-UI-v2.0/blob/main/images/Insta%20UI%202.jpg)
![Some more UI ](https://github.com/Seemikumari/Instagram-UI-v2.0/blob/main/images/Insta%20UI%203.jpg)
![Some more UI ](https://github.com/Seemikumari/Instagram-UI-v2.0/blob/main/images/Insta%20UI3.jpg)
![Some more UI ](https://github.com/Seemikumari/Instagram-UI-v2.0/blob/main/images/Insta%20UI%204.jpg)



