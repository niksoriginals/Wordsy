/* ============================================
   WORDSY — UI Manager
   Handles all DOM rendering, animations,
   modals, toasts, and confetti.
   ============================================ */

const WordsyUI = (() => {
    // Cached DOM references
    const els = {};

    function init() {
        // Cache all DOM elements
        els.guessForm = document.getElementById('guess-form');
        els.guessInput = document.getElementById('guess-input');
        els.btnSubmit = document.getElementById('btn-submit');
        els.guessCount = document.getElementById('guess-count');
        els.guessList = document.getElementById('guess-list');
        els.puzzleNumber = document.getElementById('puzzle-number');
        els.messageBar = document.getElementById('message-bar');
        els.messageText = document.getElementById('message-text');
        els.winOverlay = document.getElementById('win-overlay');
        els.winWord = document.getElementById('win-word');
        els.winSubtitle = document.getElementById('win-subtitle');
        els.btnShare = document.getElementById('btn-share');
        els.btnShareStats = document.getElementById('btn-share-stats');
        els.btnCloseWin = document.getElementById('btn-close-win');
        els.btnHint = document.getElementById('btn-hint');
        els.hintCount = document.getElementById('hint-count');
        els.btnHowToPlay = document.getElementById('btn-how-to-play');
        els.btnStats = document.getElementById('btn-stats');
        els.toast = document.getElementById('toast');
        els.toastText = document.getElementById('toast-text');
        els.confettiCanvas = document.getElementById('confetti-canvas');

        // Stats display
        els.statPlayed = document.getElementById('stat-played');
        els.statWon = document.getElementById('stat-won');
        els.statStreak = document.getElementById('stat-streak');
        els.statMaxStreak = document.getElementById('stat-max-streak');
        els.statAvgGuesses = document.getElementById('stat-avg-guesses');

        _setupEventListeners();
    }

    // ── Event Listeners ──

    function _setupEventListeners() {
        // Open modals
        els.btnHowToPlay.addEventListener('click', () => showModal('modal-how-to-play'));
        els.btnStats.addEventListener('click', () => {
            refreshStatsDisplay();
            showModal('modal-stats');
        });

        // Close modal via × button
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => hideModal(btn.dataset.closeModal));
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) hideModal(overlay.id);
            });
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.visible').forEach(m => hideModal(m.id));
                hideWinOverlay();
            }
        });

        // Win overlay close
        els.btnCloseWin.addEventListener('click', hideWinOverlay);
    }

    // ── Puzzle & Guess Count ──

    function setPuzzleNumber(num) {
        els.puzzleNumber.textContent = `PUZZLE #${num}`;
    }

    function updateGuessCount(count) {
        els.guessCount.textContent = `${count} guess${count !== 1 ? 'es' : ''}`;
    }

    function updateHintCount(remaining) {
        els.hintCount.textContent = `(${remaining})`;
        if (remaining <= 0) els.btnHint.disabled = true;
    }

    // ── Color & Bar Helpers ──

    function getColorClass(rank) {
        if (rank <= 100) return 'green';
        if (rank <= 500) return 'yellow';
        if (rank <= 1500) return 'orange';
        return 'red';
    }

    function _getBarWidth(rank) {
        // Logarithmic scale: rank 1 → 100%, rank 10000 → ~5%
        const maxRank = 10000;
        return Math.max(3, 100 - (Math.log(rank) / Math.log(maxRank)) * 92);
    }

    // ── Guess Rendering ──

    function renderGuessList(guesses) {
        const sorted = [...guesses].sort((a, b) => a.rank - b.rank);
        els.guessList.innerHTML = '';

        sorted.forEach((guess, i) => {
            const li = _createGuessRow(guess, i);
            els.guessList.appendChild(li);
        });

        // Trigger bar width animation after paint
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                els.guessList.querySelectorAll('.guess-bar').forEach(bar => {
                    bar.style.width = bar.dataset.width + '%';
                });
            });
        });
    }

    function addGuessRow(guess, allGuesses) {
        renderGuessList(allGuesses);

        // Scroll the newly added guess into view
        const sorted = [...allGuesses].sort((a, b) => a.rank - b.rank);
        const index = sorted.findIndex(g => g.word === guess.word);
        if (index >= 0 && els.guessList.children[index]) {
            els.guessList.children[index].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }

    function _createGuessRow(guess, index) {
        const li = document.createElement('li');
        const color = getColorClass(guess.rank);
        const barWidth = _getBarWidth(guess.rank);
        const isTarget = guess.rank === 1;

        li.className = `guess-row${isTarget ? ' is-target' : ''}`;
        li.style.animationDelay = `${index * 0.025}s`;

        li.innerHTML = `
            <span class="guess-rank ${color}">#${guess.rank.toLocaleString()}</span>
            <span class="guess-word">${_escapeHtml(guess.word)}</span>
            <div class="guess-bar-track">
                <div class="guess-bar ${color}" data-width="${barWidth}"></div>
            </div>
        `;

        return li;
    }

    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Messages ──

    let _messageTimer = null;

    function showMessage(text, type = 'info') {
        els.messageBar.className = `message-bar visible ${type}`;
        els.messageText.textContent = text;

        clearTimeout(_messageTimer);
        _messageTimer = setTimeout(() => {
            els.messageBar.className = 'message-bar';
        }, 3000);
    }

    // ── Modals ──

    function showModal(id) {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.classList.add('visible');
            // Trap focus
            const firstFocusable = overlay.querySelector('button, input, [tabindex]');
            if (firstFocusable) firstFocusable.focus();
        }
    }

    function hideModal(id) {
        const overlay = document.getElementById(id);
        if (overlay) overlay.classList.remove('visible');
    }

    // ── Win Overlay ──

    function showWinOverlay(targetWord, guessCount) {
        els.winWord.textContent = targetWord;
        els.winSubtitle.textContent = `You found it in ${guessCount} guess${guessCount !== 1 ? 'es' : ''}!`;
        els.winOverlay.classList.add('visible');
        _launchConfetti();
    }

    function hideWinOverlay() {
        els.winOverlay.classList.remove('visible');
    }

    // ── Toast ──

    let _toastTimer = null;

    function showToast(text, duration = 2500) {
        els.toastText.textContent = text;
        els.toast.classList.add('visible');

        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => {
            els.toast.classList.remove('visible');
        }, duration);
    }

    // ── Stats Display ──

    function refreshStatsDisplay() {
        const stats = WordsyStats.load();

        els.statPlayed.textContent = stats.played;
        els.statWon.textContent = stats.won;
        els.statStreak.textContent = stats.streak;
        els.statMaxStreak.textContent = stats.maxStreak;
        els.statAvgGuesses.textContent = WordsyStats.getAvgGuesses();

        // Distribution bars
        const maxDist = Math.max(...stats.distribution, 1);
        ['dist-1', 'dist-2', 'dist-3', 'dist-4'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = stats.distribution[i];
            const pct = Math.max(8, (val / maxDist) * 100);
            el.style.width = pct + '%';
            el.querySelector('span').textContent = val;
        });
    }

    // ── Input Helpers ──

    function clearInput() {
        els.guessInput.value = '';
        els.guessInput.focus();
    }

    function disableInput() {
        els.guessInput.disabled = true;
        els.btnSubmit.disabled = true;
        els.btnHint.disabled = true;
    }

    // ── Confetti ──

    function _launchConfetti() {
        const canvas = els.confettiCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const COLORS = [
            '#E2196C', '#22c55e', '#eab308', '#f97316',
            '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'
        ];

        const particles = Array.from({ length: 160 }, () => ({
            x: Math.random() * canvas.width,
            y: -20 - Math.random() * 300,
            w: 4 + Math.random() * 6,
            h: 8 + Math.random() * 10,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            vx: (Math.random() - 0.5) * 5,
            vy: 2 + Math.random() * 5,
            rot: Math.random() * 360,
            rotV: (Math.random() - 0.5) * 12,
            opacity: 1
        }));

        let frame = 0;
        const MAX_FRAMES = 200;

        function animate() {
            if (frame > MAX_FRAMES) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.06; // gravity
                p.rot += p.rotV;

                // Fade out in last third
                if (frame > MAX_FRAMES * 0.65) {
                    p.opacity = Math.max(0, p.opacity - 0.025);
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rot * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            frame++;
            requestAnimationFrame(animate);
        }

        animate();
    }

    // ── Public API ──
    return {
        init,
        els,
        setPuzzleNumber,
        updateGuessCount,
        updateHintCount,
        getColorClass,
        renderGuessList,
        addGuessRow,
        showMessage,
        showModal,
        hideModal,
        showWinOverlay,
        hideWinOverlay,
        showToast,
        refreshStatsDisplay,
        clearInput,
        disableInput
    };
})();
