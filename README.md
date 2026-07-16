# Wordsy — Guess the Word by Context

[![Live Site](https://img.shields.io/badge/Live-Wordsy.niksoriginals.in-blueviolet?style=for-the-badge)](https://Wordsy.niksoriginals.in)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

**Wordsy** is a beautiful, modern, semantic word-guessing game (inspired by Contexto). Your goal is to find the secret daily word. With every guess, Wordsy tells you how semantically close your word is to the secret word using machine learning word embeddings.

🌐 **Play now at:** **[Wordsy.niksoriginals.in](https://Wordsy.niksoriginals.in)**

---

## 🎮 How to Play

1. **Type any word** in the input field.
2. Wordsy will calculate the **semantic distance** between your guess and the secret word.
3. The feedback shows a **rank** and a progress bar:
   * **Rank 1** is the secret word itself!
   * A lower rank (e.g., 2 to 500) means you are extremely close (colored green).
   * A higher rank (e.g., 500 to 3,000) means you are somewhat warm (colored orange/yellow).
   * Ranks above 3,000 mean you are far away (colored red/gray).
4. Use the feedback to narrow down the context of the secret word.
5. If you get stuck, use a **Hint** (up to 3 per game) to get a word that is closer than your current best guess.

---

## ✨ Features

- 📅 **301+ Daily Puzzles**: Pre-generated daily puzzles that rotationally activate based on the date.
- 💡 **Context-Based Hints**: Dynamically helps you find words closer to the target.
- 📊 **Detailed Game Statistics**: Track your games played, win percentage, current streak, max streak, and guess distribution.
- 📱 **Responsive Glassmorphism UI**: Beautiful animations, sleek dark-themed layout, and optimized for mobile/desktop.
- ⚡ **Lightning Fast & Serverless**: Puzzles are pre-calculated offline using natural language processing (NLP), meaning zero delay or heavy server requests during gameplay.
- 📲 **PWA Ready**: Install it on your phone or desktop directly from the browser.

---

## 🛠️ Behind the Scenes (How it Works)

Unlike games that query API servers for every guess, Wordsy compiles the relationships of **10,000+ words** per puzzle completely offline.

### Semantic Modeling
The similarity ranking is generated using the **GloVe (Global Vectors for Word Representation)** model developed by Stanford NLP (`glove-wiki-gigaword-100` dimension). We compute the **cosine similarity** between the 100-dimensional vectors of the target word and our vocabulary, then sort them to assign ranks.

### Puzzle Generator Script
Inside the `tools/` folder, the puzzle generator:
1. Downloads the GloVe embedding dataset directly.
2. Filters down a vocabulary of clean, non-stopword, non-acronym words.
3. Computes the cosine similarity matrix using **numpy** (vectorized dot products).
4. Outputs standalone compressed `.json` puzzle maps into `data/puzzles/`.

---

## 🚀 Running Locally

Want to host Wordsy locally or run the puzzle generator script? 

### 1. Web Application
Simply open `index.html` in any browser or run a simple local web server:
```bash
# Using Python
python -m http.server 8080
```
Then visit `http://localhost:8080` in your browser.

### 2. Generating New Puzzles
If you want to generate additional puzzles or change the target words:
```bash
cd tools
pip install numpy
python generate_puzzles.py
```
*Note: On the first run, the script will download the `glove.6B.zip` embeddings dataset (~822MB) and extract it to the `.cache` folder automatically.*

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
