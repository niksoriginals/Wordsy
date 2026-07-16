/* ============================================
   WORDSY — Statistics Manager
   Handles localStorage persistence, tracking,
   and share text generation.
   ============================================ */

const WordsyStats = (() => {
    const STORAGE_KEY = 'wordsy-stats';

    const defaults = {
        played: 0,
        won: 0,
        streak: 0,
        maxStreak: 0,
        totalGuesses: 0,
        distribution: [0, 0, 0, 0], // [1-10, 11-50, 51-100, 100+]
        lastPuzzle: -1,
        history: {} // { puzzleNumber: { won, guesses, date } }
    };

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return _clone(defaults);
            const parsed = JSON.parse(raw);
            return {
                ...defaults,
                ...parsed,
                distribution: parsed.distribution || [0, 0, 0, 0],
                history: parsed.history || {}
            };
        } catch {
            return _clone(defaults);
        }
    }

    function save(stats) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
        } catch (e) {
            console.warn('[Wordsy] Failed to save stats:', e);
        }
    }

    function recordWin(puzzleNumber, guessCount) {
        const stats = load();

        // Prevent double-counting the same puzzle
        if (stats.history[puzzleNumber]?.won) return stats;

        stats.played++;
        stats.won++;
        stats.totalGuesses += guessCount;
        stats.lastPuzzle = puzzleNumber;

        // Streak: continues if the previous puzzle was also won
        const prev = puzzleNumber - 1;
        if (stats.history[prev]?.won || stats.played === 1) {
            stats.streak++;
        } else {
            stats.streak = 1;
        }
        stats.maxStreak = Math.max(stats.maxStreak, stats.streak);

        // Distribution buckets
        if (guessCount <= 10) stats.distribution[0]++;
        else if (guessCount <= 50) stats.distribution[1]++;
        else if (guessCount <= 100) stats.distribution[2]++;
        else stats.distribution[3]++;

        stats.history[puzzleNumber] = {
            won: true,
            guesses: guessCount,
            date: new Date().toISOString().split('T')[0]
        };

        save(stats);
        return stats;
    }

    function getAvgGuesses() {
        const stats = load();
        if (stats.won === 0) return '—';
        return Math.round(stats.totalGuesses / stats.won);
    }

    function generateShareText(puzzleNumber, guessCount, guesses) {
        let green = 0, yellow = 0, orange = 0, red = 0;
        guesses.forEach(g => {
            if (g.rank <= 100) green++;
            else if (g.rank <= 500) yellow++;
            else if (g.rank <= 1500) orange++;
            else red++;
        });

        return [
            `🔤 Wordsy #${puzzleNumber}`,
            `Solved in ${guessCount} guess${guessCount !== 1 ? 'es' : ''}!`,
            ``,
            `🟢 ${green} | 🟡 ${yellow} | 🟠 ${orange} | 🔴 ${red}`,
            ``,
            `https://niksoriginals.in/wordsy`
        ].join('\n');
    }

    function _clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    return { load, save, recordWin, getAvgGuesses, generateShareText };
})();
