document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chat-box");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const FAQ_PATH = "faq.json"; // put your faq.json here

  // ---- SUGGESTIONS BOX (anchored under input) ----
  const inputWrapper = document.querySelector(".input-wrapper");
  let suggestionsBox = document.getElementById("suggestions");

  // ---------- config ----------
  const MIN_SCORE = 0.4; // threshold for auto-accept on send (original matching)
  const N = 2; // bigram size
  const SUGGEST_LIMIT = 10; // prefix suggestions count
  const DEBUG = false;

  // ---------- stopwords & synonyms ----------
  const STOPWORDS = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "then",
    "than",
    "to",
    "for",
    "of",
    "in",
    "on",
    "at",
    "by",
    "with",
    "from",
    "as",
    "is",
    "am",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "do",
    "does",
    "did",
    "doing",
    "can",
    "could",
    "should",
    "would",
    "will",
    "shall",
    "may",
    "might",
    "must",
    "i",
    "me",
    "my",
    "mine",
    "you",
    "your",
    "yours",
    "we",
    "our",
    "ours",
    "they",
    "them",
    "their",
    "theirs",
    "he",
    "she",
    "it",
    "this",
    "that",
    "these",
    "those",
    "there",
    "here",
    "how",
    "what",
    "when",
    "where",
    "which",
    "who",
    "whom",
    "why",
    "please",
    "plz",
    "hi",
    "hello",
    "hey",
    "ok",
    "okay",
    "thanks",
    "thank",
    "thanx",
  ]);

  const SYNONYM_MAP = {
    borrow: [
      "borrow",
      "borrowed",
      "borrowings",
      "issue",
      "issued",
      "loan",
      "checkout",
      "check-out",
      "checkouts",
    ],
    return: [
      "return",
      "returned",
      "returns",
      "giveback",
      "handin",
      "hand-in",
      "submit",
      "submitted",
    ],
    renew: ["renew", "renewal", "extend", "extension"],
    wifi: ["wifi", "wi-fi", "wi fi", "wireless", "internet"],
    ebook: ["ebook", "e-book", "e book", "e_books"],
    fine: [
      "fine",
      "fines",
      "penalty",
      "penalties",
      "late",
      "latefee",
      "late-fee",
    ],
    library: ["library", "lib", "libary", "librarys", "libraries"],
    hours: [
      "hour",
      "hours",
      "timing",
      "timings",
      "open",
      "opening",
      "schedule",
    ],
    card: ["card", "id", "identification", "librarycard", "library-id"],
    alumni: ["alumni", "alumnus", "alumna"],
    print: [
      "print",
      "printing",
      "photocopy",
      "photocopying",
      "scanner",
      "scan",
    ],
  };

  const synonymLookup = {};
  Object.keys(SYNONYM_MAP).forEach((key) => {
    SYNONYM_MAP[key].forEach((variant) => (synonymLookup[variant] = key));
  });

  // ---------- NLP helpers ----------
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/wi[-\s]?fi/g, "wifi")
      .replace(/e[-\s]?mail/g, "email")
      .replace(/e[-\s]?book/g, "ebook")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lightStem(word) {
    let w = word;
    if (w.length > 6)
      w = w.replace(
        /(ations|ition|ing|ment|ments|ities|ified|fully|lessly)$/,
        ""
      );
    if (w.length > 5)
      w = w.replace(
        /(ingly|edly|ment|tion|sion|able|ible|ance|ence|ness|less|ship)$/,
        ""
      );
    w = w.replace(/(ing|ed|es|s)$/, "");
    return w;
  }

  function tokenize(text) {
    const norm = normalize(text);
    if (!norm) return [];
    const toks = norm
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !/^\d+$/.test(w))
      .filter((w) => !STOPWORDS.has(w))
      .map((w) => {
        if (synonymLookup[w]) return synonymLookup[w];
        const s = lightStem(w);
        if (synonymLookup[s]) return synonymLookup[s];
        return s;
      })
      .filter(Boolean);
    return [...new Set(toks)];
  }

  function ngrams(words, n = 2) {
    const out = new Set();
    for (let i = 0; i <= words.length - n; i++) {
      out.add(words.slice(i, i + n).join(" "));
    }
    return out;
  }

  // levenshtein & ratio
  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length,
      bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const v0 = new Array(bl + 1).fill(0);
    const v1 = new Array(bl + 1).fill(0);
    for (let j = 0; j <= bl; j++) v0[j] = j;
    for (let i = 0; i < al; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < bl; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= bl; j++) v0[j] = v1[j];
    }
    return v1[bl];
  }
  function levRatio(a, b) {
    if (!a && !b) return 1;
    const dist = levenshtein(a, b);
    const maxl = Math.max(a.length, b.length);
    return maxl === 0 ? 1 : 1 - dist / maxl;
  }

  // ---------- Indexes ----------
  let faqList = []; // raw loaded JSON
  let index = []; // per-faq index (tokens, bigrams, questionNorm, answer)
  let variantIndex = []; // per-question-variant list: { textRaw, textNorm, tokens:Set, bigrams:Set, faqIndex }
  let idf = {};
  let Nfaqs = 0;

  function buildIndex(list) {
    Nfaqs = list.length;
    const df = {}; // doc freq based on per-faq tokens
    index = list.map((item, idx) => {
      let rawQuestions = [];
      if (Array.isArray(item.questions)) rawQuestions = item.questions;
      else if (typeof item.question === "string")
        rawQuestions = [item.question];
      else rawQuestions = [String(item.question || "")];

      const qJoined = rawQuestions.join(" | ");
      const qNorm = normalize(qJoined);
      const tokens = new Set(tokenize(qJoined));
      tokens.forEach((t) => (df[t] = (df[t] || 0) + 1));

      const words = qNorm.split(/\s+/).filter(Boolean);
      const bigr = ngrams(words, N);

      return {
        questionRaw: qJoined,
        questionNorm: qNorm,
        tokens,
        bigrams: bigr,
        answer: item.answer || "",
        rawVariants: rawQuestions,
        faqIndex: idx,
      };
    });

    // compute idf
    idf = {};
    Object.keys(df).forEach((t) => {
      idf[t] = Math.log((Nfaqs + 1) / (df[t] + 1)) + 1; // smoothed
    });
    idf["_default"] = 0.8;

    // build variants index (individual possible suggestions)
    const seen = new Set();
    variantIndex = [];
    list.forEach((item, idx) => {
      let rawQuestions = [];
      if (Array.isArray(item.questions)) rawQuestions = item.questions;
      else if (typeof item.question === "string")
        rawQuestions = [item.question];
      else rawQuestions = [String(item.question || "")];

      rawQuestions.forEach((q) => {
        const qRaw = String(q || "").trim();
        if (!qRaw) return;
        const lower = qRaw.toLowerCase();
        if (seen.has(lower)) return; // dedupe same phrase
        seen.add(lower);

        const qNorm = normalize(qRaw);
        const qTokens = new Set(tokenize(qRaw));
        const qBigrams = ngrams(qNorm.split(/\s+/).filter(Boolean), N);

        variantIndex.push({
          textRaw: qRaw,
          textNorm: qNorm,
          tokens: qTokens,
          bigrams: qBigrams,
          faqIndex: idx,
        });
      });
    });

    if (DEBUG) {
      console.log("Built index with", variantIndex.length, "question variants");
    }
  }

  // ---------- scoring helpers (kept for original matching) ----------
  function scoreTokenOverlap(userTokens, targetTokens) {
    let intersectSum = 0;
    let unionSum = 0;
    const faqTokensArr = Array.from(targetTokens);
    const unionSet = new Set([...faqTokensArr, ...userTokens]);
    for (const t of unionSet) {
      const w = idf[t] || idf._default || 1;
      unionSum += w;
    }
    for (const t of userTokens) {
      if (targetTokens.has(t)) intersectSum += idf[t] || idf._default;
    }
    return unionSum === 0 ? 0 : intersectSum / unionSum;
  }

  function scoreVariantAgainstUser(userText, userTokens, userBigrams, variant) {
    const tokenScore = scoreTokenOverlap(userTokens, variant.tokens);

    let bigramIntersection = 0;
    for (const b of userBigrams)
      if (variant.bigrams.has(b)) bigramIntersection++;
    const bigramUnionSize =
      new Set([...variant.bigrams, ...userBigrams]).size || 1;
    const bigramScore = bigramIntersection / bigramUnionSize;

    const fuzzy = levRatio(normalize(userText), variant.textNorm);

    const final = 0.62 * tokenScore + 0.18 * fuzzy + 0.2 * bigramScore;
    return { final, tokenScore, fuzzy, bigramScore };
  }

  // Keep original top-variant scoring (not used for suggestions anymore)
  function getTopVariants(userText, limit = 6) {
    const normUser = normalize(userText);
    if (!normUser) return [];

    const userTokens = tokenize(userText);
    const userBigrams = Array.from(
      ngrams(normUser.split(/\s+/).filter(Boolean), N)
    );

    const scored = variantIndex.map((v) => {
      const s = scoreVariantAgainstUser(userText, userTokens, userBigrams, v);
      return { variant: v, score: s.final, comp: s };
    });

    scored.sort((a, b) => b.score - a.score);
    const out = [];
    for (const s of scored) {
      if (out.length >= limit) break;
      out.push({
        text: s.variant.textRaw,
        textNorm: s.variant.textNorm,
        faqIndex: s.variant.faqIndex,
        score: s.score,
        comp: s.comp,
      });
    }
    return out;
  }

  // ---------- NEW: prefix suggestions (requested behavior) ----------
  function getPrefixSuggestions(userText, limit = SUGGEST_LIMIT) {
    const norm = normalize(userText);
    if (!norm) return [];
    const out = [];
    for (const v of variantIndex) {
      // Show only questions that START with the typed prefix (Google-like)
      if (v.textNorm.startsWith(norm)) {
        out.push({
          text: v.textRaw,
          textNorm: v.textNorm,
          faqIndex: v.faqIndex,
        });
        if (out.length >= limit) break; // keep JSON order
      }
    }
    return out;
  }

  // ---------- FAQ matcher (unchanged) ----------
  function scoreFAQ(userText, userTokens, userBigrams) {
    const normUser = normalize(userText);
    let best = null;
    for (const faq of index) {
      if (faq.questionNorm === normUser) {
        best = { faq, score: 1.0, comp: { exact: 1 } };
        return best;
      }

      const allTokensPresent =
        userTokens.length > 0 && userTokens.every((t) => faq.tokens.has(t));
      if (allTokensPresent) {
        const sizePenalty = 1 - Math.min(faq.tokens.size / 30, 0.4);
        const sc = 0.92 * sizePenalty;
        best = { faq, score: sc, comp: { allTokens: true } };
        return best;
      }

      const tokenScore = scoreTokenOverlap(userTokens, faq.tokens);

      let bigramIntersection = 0;
      for (const b of userBigrams) if (faq.bigrams.has(b)) bigramIntersection++;
      const bigramUnionSize =
        new Set([...faq.bigrams, ...userBigrams]).size || 1;
      const bigramScore = bigramIntersection / bigramUnionSize;

      const fuzzy = levRatio(normUser, faq.questionNorm);

      const final = 0.62 * tokenScore + 0.18 * fuzzy + 0.2 * bigramScore;

      if (!best || final > best.score) {
        best = { faq, score: final, comp: { tokenScore, fuzzy, bigramScore } };
      }
    }
    return best;
  }

  function findAnswer(userText) {
    if (!index.length) return "Loading FAQs — try again in a moment.";
    const normUser = normalize(userText);
    if (!normUser) return "Please type a more specific question.";

    const userTokens = tokenize(userText);
    const userBigrams = Array.from(
      ngrams(normUser.split(/\s+/).filter(Boolean), N)
    );
    const best = scoreFAQ(userText, userTokens, userBigrams);
    if (!best) return "Sorry, I couldn't find an answer. Try rephrasing.";

    if (best.score >= 0.999 || (best.comp && best.comp.allTokens)) {
      return best.faq.answer;
    }
    if (best.score >= MIN_SCORE) {
      return best.faq.answer;
    }
    return "Sorry, I couldn't find an answer. Try different words or be more specific.";
  }

  // ---------- UI helpers ----------
  function escapeHTML(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function appendMessage(text, sender) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${
      sender === "user" ? "user-message" : "bot-message"
    }`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = escapeHTML(text);

    const time = document.createElement("div");
    time.className = "timestamp";
    time.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // ---------- send functions ----------
  function sendTypedQuery() {
    const text = userInput.value.trim();
    if (!text) return;
    appendMessage(text, "user");
    userInput.value = "";
    clearSuggestions();

    setTimeout(() => {
      const reply = findAnswer(text);
      appendMessage(reply, "bot");
    }, 120);
  }

  function sendAnswerFromFAQ(questionText, faqIndex) {
    appendMessage(questionText, "user");
    userInput.value = "";
    clearSuggestions();
    setTimeout(() => {
      const reply =
        index[faqIndex] && index[faqIndex].answer
          ? index[faqIndex].answer
          : "Sorry, couldn't find that answer.";
      appendMessage(reply, "bot");
    }, 110);
  }

  // ---------- suggestions UI ----------
  let activeSuggestion = -1;

  function clearSuggestions() {
    suggestionsBox.innerHTML = "";
    suggestionsBox.style.display = "none";
    activeSuggestion = -1;
  }

  function highlightPrefix(text, prefix) {
    const p = normalize(prefix);
    if (!p) return escapeHTML(text);
    const normText = text.toLowerCase();
    if (!normText.startsWith(p)) return escapeHTML(text);
    const head = escapeHTML(text.substring(0, p.length));
    const tail = escapeHTML(text.substring(p.length));
    return `<span class="suggestion-highlight">${head}</span>${tail}`;
  }

  function renderSuggestions(items, typed) {
    suggestionsBox.innerHTML = "";
    activeSuggestion = -1;
    if (!items || items.length === 0) {
      suggestionsBox.style.display = "none";
      return;
    }
    suggestionsBox.style.display = "block";

    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.innerHTML = highlightPrefix(it.text, typed);
      li.dataset.faqIndex = it.faqIndex;
      li.dataset.index = i;

      li.addEventListener("mouseenter", () => {
        setActive(i);
      });

      li.addEventListener("mouseleave", () => {
        setActive(-1);
      });

      li.addEventListener("click", () => {
        sendAnswerFromFAQ(it.text, it.faqIndex);
      });

      suggestionsBox.appendChild(li);
    });
  }

  function setActive(i) {
    const all = suggestionsBox.querySelectorAll("li");
    activeSuggestion = i;
    all.forEach((el, idx) => {
      el.classList.toggle("active", idx === i);
    });
    if (i >= 0 && all[i]) {
      all[i].scrollIntoView({ block: "nearest" });
    }
  }

  function updateActiveSuggestion(dir) {
    const all = suggestionsBox.querySelectorAll("li");
    if (!all.length) return;
    if (dir === 1) {
      activeSuggestion = Math.min(activeSuggestion + 1, all.length - 1);
    } else if (dir === -1) {
      activeSuggestion = Math.max(activeSuggestion - 1, 0);
    }
    setActive(activeSuggestion);
  }

  // ---------- events ----------
  sendBtn.addEventListener("click", sendTypedQuery);

  userInput.addEventListener("keydown", (e) => {
    const items = suggestionsBox.querySelectorAll("li");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length) updateActiveSuggestion(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) updateActiveSuggestion(-1);
      return;
    }
    if (e.key === "Enter") {
      // Accept active suggestion (or first), else send typed
      if (items.length) {
        e.preventDefault();
        const el =
          activeSuggestion >= 0 && items[activeSuggestion]
            ? items[activeSuggestion]
            : items[0];
        el.click();
        return;
      }
      e.preventDefault();
      sendTypedQuery();
      return;
    }
    if (e.key === "Escape") {
      clearSuggestions();
    }
  });

  userInput.addEventListener("input", () => {
    const q = userInput.value.trim();
    clearSuggestions();
    if (!q) return;
    // Use PREFIX suggestions only (requested)
    const top = getPrefixSuggestions(q, SUGGEST_LIMIT);
    renderSuggestions(top, q);
  });

  // hide suggestions if clicked outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-wrapper")) {
      clearSuggestions();
    }
  });

  // ---------- load FAQ JSON ----------
  // For demo purposes, we'll use a sample FAQ if the file isn't found
  const sampleFAQ = [
    {
      questions: ["How do I borrow a book?", "How can I check out books?"],
      answer:
        "To borrow a book, bring your student ID to the circulation desk. You can check out up to 10 books for 3 weeks.",
    },
    {
      questions: [
        "When are the library hours?",
        "What are your opening hours?",
      ],
      answer:
        "The library is open Monday-Friday 8am-9pm, Saturday 10am-6pm, and Sunday 12pm-5pm.",
    },
    {
      questions: ["How do I renew a book?", "Can I extend my loan period?"],
      answer:
        "You can renew books online through your library account, by phone, or in person. Items can be renewed up to 2 times unless reserved by another patron.",
    },
    {
      questions: [
        "How do I access online resources?",
        "How can I use e-books?",
      ],
      answer:
        "Access online resources by logging into the library portal with your student credentials. E-books are available through our digital collection.",
    },
    {
      questions: [
        "Where can I find study rooms?",
        "How do I book a study room?",
      ],
      answer:
        "Study rooms can be booked online through the library website or at the information desk. Rooms are available for groups of 2 or more.",
    },
  ];

  function loadFAQ() {
    try {
      // Try to load from external file first
      fetch(FAQ_PATH)
        .then((res) => {
          if (!res.ok) throw new Error("Could not load FAQ JSON");
          return res.json();
        })
        .then((data) => {
          if (!Array.isArray(data))
            throw new Error(
              "Expected FAQ JSON to be an array of {question/questions, answer}"
            );
          faqList = data;
          buildIndex(faqList);
          appendMessage(
            "Hi! I'm the Library Assistant. Ask me anything about library services or pick a question from the dropdown.",
            "bot"
          );
        })
        .catch((err) => {
          console.error("FAQ load error:", err);
          // Fall back to sample data
          faqList = sampleFAQ;
          buildIndex(faqList);
          appendMessage(
            "Hi! I'm the Library Assistant with sample data. Ask me anything about library services or pick a question from the dropdown.",
            "bot"
          );
        });
    } catch (err) {
      console.error("Error loading FAQ:", err);
      // Fall back to sample data
      faqList = sampleFAQ;
      buildIndex(faqList);
      appendMessage(
        "Hi! I'm the Library Assistant with sample data. Ask me anything about library services or pick a question from the dropdown.",
        "bot"
      );
    }
  }

  loadFAQ();
});

// faq form toggle logic

const faqbtn = document.querySelector(".faq-icon");
const overlay = document.querySelector(".overlay");
const faqform = document.querySelector(".faq-form");
const faqclosebtn = document.querySelector(".faq-close-btn");
const body = document.querySelector("body");

faqbtn.addEventListener("mousedown", () => {
  overlay.style.display = "block";
  faqform.style.display = "block";
  body.style.overflow = "hidden";
});

overlay.addEventListener("mousedown", () => {
  overlay.style.display = "none";
  faqform.style.display = "none";
  body.style.overflow = "auto";
});

faqclosebtn.addEventListener("click", () => {
  overlay.style.display = "none";
  faqform.style.display = "none";
  body.style.overflow = "auto";
});
