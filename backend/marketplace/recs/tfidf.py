"""Pure-Python TF-IDF Engine.
Builds an inverted index of product terms with BM25-style frequency saturation and sublinear scaling.
No numpy or external dependencies required.
"""
import math
import re
from collections import Counter, defaultdict
from .config import STOPWORDS, TFIDF_MAX_DF_RATIO, TFIDF_POSTINGS_CAP


def tokenize(text):
    if not text:
        return []
    clean = re.sub(r'[^a-zA-Z0-9\s-]', ' ', str(text).lower())
    words = clean.replace('-', ' ').split()
    return [w for w in words if len(w) >= 2 and w not in STOPWORDS]


class SimpleTFIDFIndex:
    def __init__(self):
        self.doc_lengths = {}      # pid -> total tokens
        self.avg_doc_length = 0.0
        self.df = Counter()        # term -> document count
        self.postings = defaultdict(dict)  # term -> {pid: tf}
        self.num_docs = 0

    def fit(self, documents):
        """documents: list of (pid, token_list)"""
        self.num_docs = len(documents)
        if self.num_docs == 0:
            return

        total_length = 0
        for pid, tokens in documents:
            counts = Counter(tokens)
            length = len(tokens)
            self.doc_lengths[pid] = length
            total_length += length
            for term, count in counts.items():
                self.df[term] += 1
                self.postings[term][pid] = count

        self.avg_doc_length = total_length / max(1, self.num_docs)
        max_df = max(2, int(self.num_docs * TFIDF_MAX_DF_RATIO))

        # Filter out overly common terms and prune postings
        for term in list(self.postings.keys()):
            if self.df[term] > max_df:
                del self.postings[term]
                del self.df[term]
            elif len(self.postings[term]) > TFIDF_POSTINGS_CAP:
                top_pids = sorted(self.postings[term].items(), key=lambda x: x[1], reverse=True)[:TFIDF_POSTINGS_CAP]
                self.postings[term] = dict(top_pids)

    def get_similar_candidates(self, tokens, exclude_pid=None, top_k=60):
        """Return list of (candidate_pid, tfidf_score) matching query tokens."""
        if not tokens or self.num_docs == 0:
            return []

        scores = defaultdict(float)
        query_counts = Counter(tokens)

        for term, q_count in query_counts.items():
            if term not in self.postings:
                continue
            df_val = self.df[term]
            idf = math.log((self.num_docs - df_val + 0.5) / (df_val + 0.5) + 1.0)
            if idf <= 0:
                continue

            for pid, tf in self.postings[term].items():
                if pid == exclude_pid:
                    continue
                doc_len = self.doc_lengths.get(pid, self.avg_doc_length)
                # BM25-style term score (k1=1.2, b=0.75)
                tf_norm = (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (doc_len / max(1.0, self.avg_doc_length))))
                scores[pid] += idf * tf_norm

        if not scores:
            return []

        return sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
