/* ============================================
   WORDSY — Core Game Logic
   Puzzle loading, guess processing, hints,
   state persistence, mode switching, and initialization.
   ============================================ */

const WordsyGame = (() => {
    // ── Config ──
    const EPOCH = new Date('2026-07-16T00:00:00');
    const TOTAL_PUZZLES = 301; // We have puzzle_001 to puzzle_301
    const DAILY_STATE_KEY = 'wordsy-game-state';
    const PRACTICE_STATE_KEY = 'wordsy-game-state-practice';
    const MAX_HINTS = 3;
    const HINT_TARGET_RANKS = [500, 100, 50]; // Ranks for each hint level

    // ── Game Modes ──
    let activeMode = 'daily';   // 'daily' or 'practice'

    // ── State ──
    let puzzleNumber = 0;
    let puzzleData = null;       // { word: rank, ... }
    let reverseLookup = null;    // { rank: word, ... }
    let targetWord = '';
    let guesses = [];            // [{ word, rank }, ...]
    let hintsUsed = 0;
    let solved = false;

    // ── Puzzle Number Calculation ──

    function getPuzzleNumber() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diff = now.getTime() - EPOCH.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return (((days % TOTAL_PUZZLES) + TOTAL_PUZZLES) % TOTAL_PUZZLES) + 1;
    }

    // ── Mode Switching ──

    async function switchMode(newMode) {
        if (newMode === activeMode && puzzleData) return;

        // Save current mode state before leaving
        saveState();

        activeMode = newMode;
        WordsyUI.updateModeUI(activeMode);
        WordsyUI.enableInput();
        WordsyUI.showMessage('', 'info');

        // Load correct puzzle number
        if (activeMode === 'daily') {
            puzzleNumber = getPuzzleNumber();
        } else {
            // Check if there is a saved practice state
            const savedPractice = loadState();
            if (savedPractice) {
                puzzleNumber = savedPractice.puzzleNumber;
            } else {
                // Generate a random practice puzzle
                puzzleNumber = _getRandomPracticeNumber();
            }
        }

        await _startPuzzle(puzzleNumber);
    }

    function _getRandomPracticeNumber() {
        // Pick a random puzzle between 1 and TOTAL_PUZZLES
        let rand = Math.floor(Math.random() * TOTAL_PUZZLES) + 1;
        // Avoid picking the daily puzzle if possible
        const dailyNum = getPuzzleNumber();
        if (rand === dailyNum) {
            rand = (rand % TOTAL_PUZZLES) + 1;
        }
        return rand;
    }

    // ── Puzzle Loader ──

    async function loadPuzzle(number) {
        const padded = String(number).padStart(3, '0');
        const url = `data/puzzles/puzzle_${padded}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            puzzleData = await response.json();

            // Build reverse lookup and find target
            reverseLookup = {};
            targetWord = '';

            for (const [word, rank] of Object.entries(puzzleData)) {
                reverseLookup[rank] = word;
                if (rank === 1) targetWord = word;
            }

            if (!targetWord) {
                throw new Error('No target word (rank 1) found in puzzle data');
            }

            console.log(`[Wordsy] Puzzle #${number} loaded (${activeMode}) — ${Object.keys(puzzleData).length} words`);
            return true;
        } catch (e) {
            console.error('[Wordsy] Failed to load puzzle:', e);
            return false;
        }
    }

    async function _startPuzzle(number) {
        WordsyUI.setPuzzleNumber(number, activeMode);

        const loaded = await loadPuzzle(number);
        if (!loaded) {
            WordsyUI.showMessage('Failed to load puzzle. Please refresh.', 'error');
            WordsyUI.disableInput();
            return;
        }

        // Restore state or initialize clean state
        const savedState = loadState();
        if (savedState && savedState.puzzleNumber === number) {
            restoreState(savedState);
            WordsyUI.renderGuessList(guesses);
            WordsyUI.updateGuessCount(guesses.length);
            WordsyUI.updateHintCount(MAX_HINTS - hintsUsed);

            if (solved) {
                WordsyUI.disableInput();
                WordsyUI.showMessage(`You already found "${targetWord}"! 🎉`, 'success');
            }
        } else {
            // Reset state
            guesses = [];
            hintsUsed = 0;
            solved = false;
            WordsyUI.renderGuessList([]);
            WordsyUI.updateGuessCount(0);
            WordsyUI.updateHintCount(MAX_HINTS);
        }

        WordsyUI.clearInput();
    }

    // ── Guess Processing ──

    function processGuess(input) {
        const word = input.toLowerCase().trim().replace(/[^a-z]/g, '');

        if (!word) {
            return { error: 'Please type a word' };
        }

        if (word.length < 2) {
            return { error: 'Word must be at least 2 letters' };
        }

        if (!puzzleData) {
            return { error: 'Puzzle not loaded yet' };
        }

        // Duplicate check
        if (guesses.some(g => g.word === word)) {
            return { error: 'Already guessed!' };
        }

        // Look up rank
        const rank = puzzleData[word];
        if (rank === undefined) {
            return { error: 'Word not in vocabulary' };
        }

        const guess = { word, rank };
        guesses.push(guess);
        saveState();

        const isTarget = rank === 1;
        if (isTarget) {
            solved = true;
            saveState();
        }

        return { guess, isTarget };
    }

    // ── Hints ──

    function getHint() {
        if (hintsUsed >= MAX_HINTS) return null;
        if (!reverseLookup) return null;

        const targetRank = HINT_TARGET_RANKS[hintsUsed];
        const guessedWords = new Set(guesses.map(g => g.word));

        // Find the word closest to the target hint rank that hasn't been guessed
        let bestWord = null;
        let bestDiff = Infinity;

        for (const [rankStr, word] of Object.entries(reverseLookup)) {
            const rank = parseInt(rankStr);
            if (guessedWords.has(word)) continue;
            if (rank === 1) continue; // Never give away the answer

            const diff = Math.abs(rank - targetRank);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestWord = word;
            }
        }

        if (!bestWord) return null;

        hintsUsed++;
        const result = processGuess(bestWord);
        WordsyUI.updateHintCount(MAX_HINTS - hintsUsed);

        return result;
    }

    // ── State Persistence ──

    function saveState() {
        const key = activeMode === 'daily' ? DAILY_STATE_KEY : PRACTICE_STATE_KEY;
        try {
            localStorage.setItem(key, JSON.stringify({
                puzzleNumber,
                guesses,
                hintsUsed,
                solved
            }));
        } catch (e) {
            console.warn(`[Wordsy] Failed to save ${activeMode} state:`, e);
        }
    }

    function loadState() {
        const key = activeMode === 'daily' ? DAILY_STATE_KEY : PRACTICE_STATE_KEY;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function restoreState(state) {
        guesses = state.guesses || [];
        hintsUsed = state.hintsUsed || 0;
        solved = state.solved || false;
    }

    // ── Sharing ──

    function shareResult() {
        if (!solved || guesses.length === 0) return;

        const text = WordsyStats.generateShareText(puzzleNumber, guesses.length, guesses, activeMode);

        if (navigator.share) {
            navigator.share({ text }).catch(() => _copyToClipboard(text));
        } else {
            _copyToClipboard(text);
        }
    }

    function _copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            WordsyUI.showToast('Copied to clipboard!');
        }).catch(() => {
            WordsyUI.showToast('Could not copy — try manually');
        });
    }

    // ── Win Handler ──

    function handleWin() {
        WordsyStats.recordWin(puzzleNumber, guesses.length, activeMode);
        WordsyUI.disableInput();

        setTimeout(() => {
            WordsyUI.showWinOverlay(targetWord, guesses.length, activeMode);
        }, 700);
    }

    // ── Initialization ──

    async function init() {
        // Initialize UI
        WordsyUI.init();

        // ── Check if user was last in practice mode ──
        let lastMode = 'daily';
        try {
            const savedPractice = localStorage.getItem(PRACTICE_STATE_KEY);
            if (savedPractice) {
                // If they have practice progress, or if they explicitly selected practice mode before (we can save it)
                const storedMode = localStorage.getItem('wordsy-active-mode');
                if (storedMode === 'practice') lastMode = 'practice';
            }
        } catch {}

        // Launch into last selected mode
        await switchMode(lastMode);

        // ── Wire up form submission ──
        WordsyUI.els.guessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (solved) return;

            const input = WordsyUI.els.guessInput.value;
            const result = processGuess(input);

            if (result.error) {
                WordsyUI.showMessage(result.error, 'error');
                // Shake the input
                WordsyUI.els.guessInput.classList.add('shake');
                setTimeout(() => WordsyUI.els.guessInput.classList.remove('shake'), 400);
                return;
            }

            WordsyUI.clearInput();
            WordsyUI.addGuessRow(result.guess, guesses);
            WordsyUI.updateGuessCount(guesses.length);

            if (result.isTarget) {
                handleWin();
            }
        });

        // ── Wire up hint button ──
        WordsyUI.els.btnHint.addEventListener('click', () => {
            if (solved) return;

            const result = getHint();
            if (!result) {
                WordsyUI.showMessage('No more hints available', 'error');
                return;
            }
            if (result.error) {
                WordsyUI.showMessage(result.error, 'error');
                return;
            }

            WordsyUI.addGuessRow(result.guess, guesses);
            WordsyUI.updateGuessCount(guesses.length);
            WordsyUI.showMessage(`💡 Hint: "${result.guess.word}" — Rank #${result.guess.rank.toLocaleString()}`, 'info');

            if (result.isTarget) handleWin();
        });

        // ── Wire up new/next practice puzzle triggers ──
        const triggerNewPractice = async () => {
            if (activeMode !== 'practice') return;
            // Clear current practice state so it forces generating a new random puzzle
            localStorage.removeItem(PRACTICE_STATE_KEY);
            puzzleNumber = _getRandomPracticeNumber();
            WordsyUI.enableInput();
            WordsyUI.hideWinOverlay();
            WordsyUI.showMessage('', 'info');
            await _startPuzzle(puzzleNumber);
            // Save state immediately to lock in this new puzzle number
            saveState();
        };

        if (WordsyUI.els.btnNewPractice) {
            WordsyUI.els.btnNewPractice.addEventListener('click', () => {
                if (confirm("Are you sure you want to skip this puzzle and start a new one?")) {
                    triggerNewPractice();
                }
            });
        }

        if (WordsyUI.els.btnNextPracticeWin) {
            WordsyUI.els.btnNextPracticeWin.addEventListener('click', () => {
                triggerNewPractice();
            });
        }

        // Keep local storage synced with mode preference
        const originalSwitch = switchMode;
        switchMode = async function(mode) {
            await originalSwitch(mode);
            try {
                localStorage.setItem('wordsy-active-mode', mode);
            } catch {}
        };

        // ── Wire up share buttons ──
        WordsyUI.els.btnShare.addEventListener('click', shareResult);
        WordsyUI.els.btnShareStats.addEventListener('click', shareResult);

        // ── First visit: show tutorial ──
        if (!localStorage.getItem('wordsy-seen-tutorial')) {
            setTimeout(() => WordsyUI.showModal('modal-how-to-play'), 600);
            localStorage.setItem('wordsy-seen-tutorial', 'true');
        }

        // Focus input
        WordsyUI.els.guessInput.focus();
    }

    // ── Boot ──
    document.addEventListener('DOMContentLoaded', init);

    return { getPuzzleNumber, switchMode };
})();
