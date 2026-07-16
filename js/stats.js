/* ============================================
   WORDSY — Statistics Manager
   Handles localStorage persistence, tracking,
   and share text generation for both Daily and
   Practice modes.
   ============================================ */

const WordsyStats = (() => {
    const STORAGE_KEYS = {
        daily: 'wordsy-stats',
        practice: 'wordsy-stats-practice'
    };

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

    function load(mode = 'daily') {
        const key = STORAGE_KEYS[mode] || STORAGE_KEYS.daily;
        try {
            const raw = localStorage.getItem(key);
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

    function save(stats, mode = 'daily') {
        const key = STORAGE_KEYS[mode] || STORAGE_KEYS.daily;
        try {
            localStorage.setItem(key, JSON.stringify(stats));
        } catch (e) {
            console.warn(`[Wordsy] Failed to save ${mode} stats:`, e);
        }
    }

    function recordWin(puzzleNumber, guessCount, mode = 'daily') {
        const stats = load(mode);

        // Prevent double-counting the same puzzle in daily, but in practice, maybe they can replay?
        // Let's allow replay in practice mode but increment played/won or keep historical record.
        if (stats.history[puzzleNumber]?.won) return stats;

        stats.played++;
        stats.won++;
        stats.totalGuesses += guessCount;
        stats.lastPuzzle = puzzleNumber;

        if (mode === 'daily') {
            // Streak: continues if the previous puzzle was also won
            const prev = puzzleNumber - 1;
            if (stats.history[prev]?.won || stats.played === 1) {
                stats.streak++;
            } else {
                stats.streak = 1;
            }
            stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
        } else {
            // No daily streak tracking for practice mode
            stats.streak = 0;
            stats.maxStreak = 0;
        }

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

        save(stats, mode);
        return stats;
    }

    function getAvgGuesses(mode = 'daily') {
        const stats = load(mode);
        if (stats.won === 0) return '—';
        return Math.round(stats.totalGuesses / stats.won);
    }

    function generateShareText(puzzleNumber, guessCount, guesses, mode = 'daily') {
        let green = 0, yellow = 0, orange = 0, red = 0;
        guesses.forEach(g => {
            if (g.rank <= 100) green++;
            else if (g.rank <= 500) yellow++;
            else if (g.rank <= 1500) orange++;
            else red++;
        });

        const label = mode === 'daily' ? `Daily #${puzzleNumber}` : `Practice #${puzzleNumber}`;

        return [
            `🔤 Wordsy (${label})`,
            `Solved in ${guessCount} guess${guessCount !== 1 ? 'es' : ''}!`,
            ``,
            `🟢 ${green} | 🟡 ${yellow} | 🟠 ${orange} | 🔴 ${red}`,
            ``,
            `https://Wordsy.niksoriginals.in`
        ].join('\n');
    }

    function _clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    return { load, save, recordWin, getAvgGuesses, generateShareText };
})();
