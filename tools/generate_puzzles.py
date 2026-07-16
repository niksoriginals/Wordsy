"""
WORDSY — Puzzle Generator
Downloads GloVe word embeddings directly from Stanford NLP
and computes semantic similarity rankings for each target word.

Usage:
    pip install numpy
    python generate_puzzles.py

Output:
    ../data/puzzles/puzzle_001.json through puzzle_365.json
"""

import json
import os
import sys
import time
import zipfile
import urllib.request
import numpy as np

GLOVE_URL = "https://nlp.stanford.edu/data/glove.6B.zip"
GLOVE_FILE = "glove.6B.100d.txt"  # 100-dimensional vectors


def main():
    print("=" * 50)
    print("  WORDSY — Puzzle Generator")
    print("=" * 50)

    # ── Step 1: Download & load GloVe vectors ──
    print("\n[1/5] Loading GloVe embeddings...")
    cache_dir = os.path.join(os.path.dirname(__file__), ".cache")
    os.makedirs(cache_dir, exist_ok=True)

    glove_txt_path = os.path.join(cache_dir, GLOVE_FILE)
    glove_zip_path = os.path.join(cache_dir, "glove.6B.zip")

    if not os.path.exists(glove_txt_path):
        if not os.path.exists(glove_zip_path):
            print(f"       Downloading GloVe embeddings (~862MB)...")
            print(f"       URL: {GLOVE_URL}")
            _download_with_progress(GLOVE_URL, glove_zip_path)
        print(f"       Extracting {GLOVE_FILE}...")
        with zipfile.ZipFile(glove_zip_path, "r") as zf:
            zf.extract(GLOVE_FILE, cache_dir)
        print("       Done extracting.")
    else:
        print(f"       Using cached {GLOVE_FILE}")

    print("[2/5] Parsing GloVe vectors...")
    word_to_index, vectors = _load_glove(glove_txt_path)
    print(f"       Loaded {len(word_to_index)} words (100-dimensional)")

    # ── Step 2: Load target words ──
    print("\n[3/5] Loading target words...")
    targets_path = os.path.join(os.path.dirname(__file__), "target_words.json")
    with open(targets_path, "r") as f:
        target_words = json.load(f)

    # Validate targets exist in vocabulary
    valid_targets = []
    for w in target_words:
        w_lower = w.lower()
        if w_lower in word_to_index:
            valid_targets.append(w_lower)
        else:
            print(f"  [!] Target word '{w}' not in GloVe vocabulary — skipping")

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for w in valid_targets:
        if w not in seen:
            seen.add(w)
            deduped.append(w)
    valid_targets = deduped
    print(f"  {len(valid_targets)} valid target words")

    # ── Step 3: Build vocabulary ──
    print("\n[4/5] Building vocabulary...")
    vocab, vocab_indices = _build_vocabulary(word_to_index, set(valid_targets), max_words=10000)
    print(f"  Vocabulary size: {len(vocab)} words")

    # Pre-compute normalized vocab vectors for fast cosine similarity
    vocab_vectors = vectors[vocab_indices]  # shape: (vocab_size, 100)
    vocab_norms = np.linalg.norm(vocab_vectors, axis=1, keepdims=True)
    vocab_norms[vocab_norms == 0] = 1  # avoid division by zero
    vocab_vectors_normed = vocab_vectors / vocab_norms

    # ── Step 4: Generate puzzles ──
    print("\n[5/5] Generating puzzles...")
    output_dir = os.path.join(os.path.dirname(__file__), "..", "data", "puzzles")
    os.makedirs(output_dir, exist_ok=True)

    total = len(valid_targets)
    for i, target in enumerate(valid_targets):
        puzzle_num = i + 1
        padded = str(puzzle_num).zfill(3)
        output_path = os.path.join(output_dir, f"puzzle_{padded}.json")

        # Compute similarities using vectorized numpy ops
        target_idx = word_to_index[target]
        target_vec = vectors[target_idx]
        target_norm = np.linalg.norm(target_vec)
        if target_norm == 0:
            target_norm = 1
        target_vec_normed = target_vec / target_norm

        # Cosine similarity = dot product of normalized vectors
        similarities = vocab_vectors_normed @ target_vec_normed

        # Sort by similarity (descending)
        sorted_indices = np.argsort(-similarities)

        # Assign ranks
        puzzle_data = {}
        # Ensure the target word is always rank 1
        puzzle_data[target] = 1

        rank = 1
        for idx in sorted_indices:
            word = vocab[idx]
            if word == target:
                continue
            rank += 1
            puzzle_data[word] = rank

        # Write JSON
        with open(output_path, "w") as f:
            json.dump(puzzle_data, f, separators=(",", ":"))

        # Progress
        elapsed_pct = (i + 1) / total * 100
        word_count = len(puzzle_data)
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  [{puzzle_num:3d}/{total}] puzzle_{padded}.json — "
              f"target: '{target}', {word_count} words, {size_kb:.0f}KB "
              f"({elapsed_pct:.0f}%)")

    print(f"\n[OK] Done! Generated {total} puzzles in {output_dir}")
    print(f"   Total size: {_dir_size_mb(output_dir):.1f} MB")


def _download_with_progress(url, dest):
    """Download a file with a simple progress indicator."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    response = urllib.request.urlopen(req)
    total = int(response.headers.get("Content-Length", 0))
    downloaded = 0
    chunk_size = 1024 * 1024  # 1MB

    with open(dest, "wb") as f:
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            if total > 0:
                pct = downloaded / total * 100
                mb = downloaded / (1024 * 1024)
                total_mb = total / (1024 * 1024)
                print(f"\r       {mb:.0f}/{total_mb:.0f} MB ({pct:.0f}%)",
                      end="", flush=True)
    print()  # newline after progress


def _load_glove(path):
    """
    Parse a GloVe text file into a word-to-index dict
    and a numpy matrix of vectors.
    """
    words = []
    vecs = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip().split(" ")
            word = parts[0]
            vec = [float(x) for x in parts[1:]]
            words.append(word)
            vecs.append(vec)

    word_to_index = {w: i for i, w in enumerate(words)}
    vectors = np.array(vecs, dtype=np.float32)
    return word_to_index, vectors


def _build_vocabulary(word_to_index, target_words_set, max_words=10000):
    """
    Build a clean vocabulary from the GloVe word list.
    Filters out: numbers, single chars, words with special characters,
    very short words, and common stopwords.
    Always includes any words that are valid target words.
    Returns (list of words, list of their indices in the vectors matrix).
    """
    stopwords = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "must", "need", "dare",
        "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
        "into", "through", "during", "before", "after", "above", "below",
        "between", "out", "off", "over", "under", "again", "further", "then",
        "once", "here", "there", "when", "where", "why", "how", "all", "both",
        "each", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "because", "but", "and", "or", "if", "while", "although", "though",
        "that", "this", "these", "those", "it", "its", "he", "she", "they",
        "we", "you", "i", "me", "my", "your", "his", "her", "their", "our",
        "us", "them", "what", "which", "who", "whom", "whose"
    }

    vocab = []
    indices = []
    seen = set()

    for word, idx in word_to_index.items():
        w_lower = word.lower()
        # Always preserve valid targets to make them guessable and rankable
        if w_lower in target_words_set:
            if w_lower not in seen:
                seen.add(w_lower)
                vocab.append(w_lower)
                indices.append(idx)
            continue

        if len(word) < 3:
            continue
        if not word.isalpha():
            continue
        if word.isupper():
            continue
        if w_lower in stopwords:
            continue
        if w_lower in seen:
            continue
        seen.add(w_lower)
        vocab.append(w_lower)
        indices.append(idx)
        if len(vocab) >= max_words:
            break

    return vocab, indices


def _dir_size_mb(path):
    """Calculate total size of a directory in MB."""
    total = 0
    for f in os.listdir(path):
        fp = os.path.join(path, f)
        if os.path.isfile(fp):
            total += os.path.getsize(fp)
    return total / (1024 * 1024)


if __name__ == "__main__":
    start = time.time()
    main()
    elapsed = time.time() - start
    print(f"   Time elapsed: {elapsed:.1f}s")
