if (typeof crypto.randomUUID === 'undefined') {
    crypto.randomUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
}

class TrieNode {
    constructor() {
        this.children = new Map();
        this.isEndOfWord = false;
        this.word = null;
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word) {
        let currentNode = this.root;
        for (const char of word) {
            if (!currentNode.children.has(char)) {
                currentNode.children.set(char, new TrieNode());
            }
            currentNode = currentNode.children.get(char);
        }
        currentNode.isEndOfWord = true;
        currentNode.word = word;
    }

    searchPrefix(prefix) {
        let currentNode = this.root;
        for (const char of prefix) {
            if (!currentNode.children.has(char)) {
                return [];
            }
            currentNode = currentNode.children.get(char);
        }
        const suggestions = [];
        this._collectWords(currentNode, suggestions);
        return suggestions;
    }

    _collectWords(node, collectedWords) {
        if (node.isEndOfWord) {
            collectedWords.push(node.word);
        }
        for (const childNode of node.children.values()) {
            this._collectWords(childNode, collectedWords);
        }
    }
}

function levenshteinDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        costs[i] = [];
        costs[i][0] = i;
    }
    for (let j = 0; j <= s2.length; j++) {
        costs[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const substitutionCost = (s1[i - 1] === s2[j - 1]) ? 0 : 1;

            costs[i][j] = Math.min(
                costs[i - 1][j] + 1,
                costs[i][j - 1] + 1,
                costs[i - 1][j - 1] + substitutionCost
            );
        }
    }
    return costs[s1.length][s2.length];
}

function highlightFuzzyDifferences(originalWord, query) {
    const s1 = originalWord.toLowerCase();
    const s2 = query.toLowerCase();
    let highlightedHtml = '';
    let i = 0, j = 0;

    while (i < s1.length || j < s2.length) {
        if (i < s1.length && j < s2.length && s1[i] === s2[j]) {
            highlightedHtml += originalWord[i];
            i++;
            j++;
        } else {
            if (i < s1.length) {
                highlightedHtml += `<span class="fuzzy-highlight">${originalWord[i]}</span>`;
                i++;
            }
            if (j < s2.length) {
                j++;
            }
        }
    }
    return highlightedHtml;
}

const LS_FREQUENCIES_KEY = 'searchFrequencies';
const LS_RECENT_KEY = 'recentSearches';

function loadFrequencies() {
    try {
        const json = localStorage.getItem(LS_FREQUENCIES_KEY);
        if (json) {
            return new Map(JSON.parse(json));
        }
    } catch (e) {
        console.error("Error loading frequencies from Local Storage:", e);
    }
    return new Map();
}

function saveFrequencies(frequencies) {
    try {
        localStorage.setItem(LS_FREQUENCIES_KEY, JSON.stringify(Array.from(frequencies.entries())));
    } catch (e) {
        console.error("Error saving frequencies to Local Storage:", e);
    }
}

function loadRecentSearches() {
    try {
        const json = localStorage.getItem(LS_RECENT_KEY);
        if (json) {
            return new Set(JSON.parse(json));
        }
    } catch (e) {
        console.error("Error loading recent searches from Local Storage:", e);
    }
    return new Set();
}

function saveRecentSearches(searches) {
    try {
        localStorage.setItem(LS_RECENT_KEY, JSON.stringify(Array.from(searches)));
    } catch (e) {
        console.error("Error saving recent searches to Local Storage:", e);
    }
}

const searchInput = document.getElementById('searchInput');
const suggestionsBox = document.getElementById('suggestionsBox');
const recentSearchesBox = document.getElementById('recentSearchesBox');
const recentSearchesList = document.getElementById('recentSearchesList');
const clearInputBtn = document.getElementById('clearInputBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

const trie = new Trie();
const wordFrequencies = loadFrequencies();
const recentSearches = loadRecentSearches();

const MAX_EDIT_DISTANCE = 2;
const MAX_RECENT_SEARCHES = 10;

const dictionary = [
    "algorithm", "data structure", "trie", "hash map", "linked list", "binary tree", "graph theory",
    "recursion", "dynamic programming", "object-oriented programming", "functional programming",
    "operating system", "database management", "network protocols", "cybersecurity", "cloud computing",
    "distributed systems", "parallel computing", "quantum computing",

    "javascript", "python", "java", "c++", "c#", "go", "rust", "swift", "kotlin", "php",
    "ruby", "typescript", "scala", "haskell", "r", "matlab", "perl", "sql", "html", "css",

    "react", "angular", "vue.js", "next.js", "node.js", "express.js", "django", "flask",
    "spring boot", "ruby on rails", "asp.net", "laravel", "tailwind css", "bootstrap",
    "webpack", "babel", "npm", "yarn", "rest api", "graphql", "websocket", "http", "https",
    "frontend development", "backend development", "full stack development", "responsive design", "web accessibility",

    "aws", "amazon web services", "azure", "google cloud platform", "gcp", "firebase",
    "heroku", "netlify", "vercel", "docker", "kubernetes", "serverless", "lambda functions",
    "s3", "ec2", "rds", "cloudfront", "firestore", "google bigquery", "machine learning engine",

    "machine learning", "deep learning", "artificial intelligence", "ai", "data science",
    "natural language processing", "nlp", "computer vision", "cv", "reinforcement learning",
    "neural network", "convolutional neural network", "recurrent neural network", "transformer model",
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras", "matplotlib", "seaborn",
    "data analysis", "data visualization", "big data", "data mining", "predictive analytics",

    "git", "github", "gitlab", "bitbucket", "vscode", "intellij idea", "pycharm",
    "jira", "confluence", "slack", "zoom", "microsoft teams", "postman", "insomnia",
    "nginx", "apache", "mongodb", "mysql", "postgresql", "redis", "kafka", "rabbitMQ",
    "blockchain", "cryptocurrency", "devops", "ci/cd", "agile", "scrum", "kanban",

    "operating system", "linux", "windows", "macos", "unix", "virtual machine", "containerization",
    "api", "sdk", "ide", "cli", "gui", "ux", "ui", "user interface", "user experience",
    "debugging", "testing", "unit testing", "integration testing", "system design", "software architecture",
    "agile methodology", "design patterns", "software engineering", "version control",
    "cyber security", "encryption", "firewall", "vpn", "malware", "phishing", "authentication", "authorization",
    "computer science", "internship", "career", "interview", "portfolio", "resume", "google", "microsoft", "amazon",

    "how to learn javascript", "best data structures for interviews", "machine learning basics",
    "what is cloud computing", "guide to frontend development", "python for data science",
    "build a react app", "deploy nodejs app", "algorithms explained", "firebase tutorial",
    "google internship application tips", "interview preparation", "system design interview questions",
    "design patterns in python", "docker for beginners", "kubernetes deployment",
    "understanding blockchain", "cybersecurity fundamentals",
    "web security best practices", "data visualization tools", "clean code principles",
];

dictionary.forEach(word => {
    const lowerCaseWord = word.toLowerCase();
    trie.insert(lowerCaseWord);
    if (!wordFrequencies.has(lowerCaseWord)) {
        wordFrequencies.set(lowerCaseWord, 0);
    }
});

let currentSuggestions = [];
let selectedSuggestionIndex = -1;

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function highlightExactPrefixMatch(text, match) {
    const index = text.toLowerCase().indexOf(match.toLowerCase());
    if (index === -1) {
        return text;
    }
    const before = text.substring(0, index);
    const matched = text.substring(index, index + match.length);
    const after = text.substring(index + match.length);
    return `${before}<span class="highlight">${matched}</span>${after}`;
}

function renderSuggestions(suggestions, query, selectedIndex, onSuggestionClick) {
    suggestionsBox.innerHTML = '';
    recentSearchesBox.classList.remove('active');

    if (query.length > 0) {
        searchInput.setAttribute('aria-expanded', 'true');
    } else {
        searchInput.setAttribute('aria-expanded', 'false');
    }

    if (query.length === 0) {
        suggestionsBox.classList.remove('active');
        return;
    }

    if (suggestions.length === 0) {
        const noResultsItem = document.createElement('div');
        noResultsItem.classList.add('no-results');
        noResultsItem.textContent = `No results found for "${query}"`;
        suggestionsBox.appendChild(noResultsItem);
        suggestionsBox.setAttribute('aria-activedescendant', '');
        suggestionsBox.classList.add('active');
    } else {
        suggestions.forEach((suggestion, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add('suggestion-item');
            suggestionItem.id = `suggestion-${index}`;
            suggestionItem.setAttribute('role', 'option');

            let iconClass = 'fas fa-arrow-right';
            let displayHtml;

            if (suggestion.type === 'fuzzy') {
                iconClass = 'fas fa-question-circle';
                displayHtml = highlightFuzzyDifferences(suggestion.word, query);
            } else if (suggestion.type === 'exact-query-match') {
                iconClass = 'fas fa-check-circle';
                displayHtml = highlightExactPrefixMatch(suggestion.word, query);
            } else if (suggestion.type === 'perfect') {
                iconClass = 'fas fa-magnifying-glass-plus';
                displayHtml = highlightExactPrefixMatch(suggestion.word, query);
            } else {
                 displayHtml = suggestion.word;
            }

            suggestionItem.innerHTML = `<i class="${iconClass}"></i><span>${displayHtml}</span>`;

            if (suggestion.type === 'fuzzy') {
                const fuzzyLabel = document.createElement('span');
                fuzzyLabel.classList.add('fuzzy-label');
                fuzzyLabel.textContent = `Did you mean?`;
                suggestionItem.appendChild(fuzzyLabel);
            }

            if (index === selectedIndex) {
                suggestionItem.classList.add('selected');
                searchInput.setAttribute('aria-activedescendant', suggestionItem.id);
            }

            suggestionsBox.appendChild(suggestionItem);

            suggestionItem.addEventListener('click', () => {
                onSuggestionClick(suggestion.word);
            });
        });
        suggestionsBox.classList.add('active');
    }
}

function highlightSelectedSuggestion(selectedIndex) {
    const items = suggestionsBox.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            searchInput.setAttribute('aria-activedescendant', item.id);
        } else {
            item.classList.remove('selected');
        }
    });
}

function renderRecentSearches(recentSearchesData, onRecentSearchClick) {
    recentSearchesList.innerHTML = '';
    if (recentSearchesData.size === 0 || searchInput.value.trim().length > 0) {
        recentSearchesBox.classList.remove('active');
        return;
    }

    recentSearchesData.forEach(word => {
        const recentItem = document.createElement('div');
        recentItem.classList.add('recent-search-item');
        recentItem.innerHTML = `<i class="fas fa-history"></i><span>${word}</span>`;
        recentSearchesList.appendChild(recentItem);

        recentItem.addEventListener('click', () => {
            onRecentSearchClick(word);
        });
    });
    recentSearchesBox.classList.add('active');
}

function toggleClearButton() {
    if (searchInput.value.trim().length > 0) {
        clearInputBtn.classList.remove('hidden');
    } else {
        clearInputBtn.classList.add('hidden');
    }
}

function showLoadingSpinner() {
    loadingSpinner.classList.add('active');
}

function hideLoadingSpinner() {
    loadingSpinner.classList.remove('active');
}

function resetAriaAttributes() {
    searchInput.setAttribute('aria-activedescendant', '');
    searchInput.setAttribute('aria-expanded', 'false');
}

const initiateSearch = debounce(async () => {
    const query = searchInput.value.trim().toLowerCase();

    toggleClearButton();
    resetAriaAttributes();

    if (query.length === 0) {
        renderSuggestions([], query, selectedSuggestionIndex, handleSuggestionClick);
        renderRecentSearches(recentSearches, handleRecentSearchClick);
        hideLoadingSpinner();
        return;
    }

    showLoadingSpinner();

    let allSuggestionObjects = [];
    const seenWords = new Set();

    const exactMatch = dictionary.find(w => w.toLowerCase() === query);
    if (exactMatch && !seenWords.has(query)) {
        allSuggestionObjects.push({
            word: exactMatch,
            type: 'exact-query-match',
            score: (wordFrequencies.get(query) || 0) + 10000
        });
        seenWords.add(query);
    }

    const perfectMatches = trie.searchPrefix(query);
    perfectMatches.forEach(word => {
        if (!seenWords.has(word)) {
            allSuggestionObjects.push({
                word: word,
                type: 'perfect',
                score: (wordFrequencies.get(word) || 0)
            });
            seenWords.add(word);
        }
    });

    if (perfectMatches.length < 5 && query.length > 2) {
        dictionary.forEach(dictWord => {
            const lowerDictWord = dictWord.toLowerCase();
            if (!seenWords.has(lowerDictWord)) {
                const distance = levenshteinDistance(query, lowerDictWord);

                if (distance > 0 && distance <= MAX_EDIT_DISTANCE) {
                    allSuggestionObjects.push({
                        word: dictWord,
                        type: 'fuzzy',
                        score: (MAX_EDIT_DISTANCE - distance) * 1000 + (wordFrequencies.get(lowerDictWord) || 0),
                        distance: distance
                    });
                    seenWords.add(lowerDictWord);
                }
            }
        });
    }

    allSuggestionObjects.sort((a, b) => {
        const typeOrder = { 'exact-query-match': 3, 'perfect': 2, 'fuzzy': 1 };
        if (typeOrder[b.type] !== typeOrder[a.type]) {
            return typeOrder[b.type] - typeOrder[a.type];
        }

        if (b.score !== a.score) return b.score - a.score;

        if (a.type === 'fuzzy' && b.type === 'fuzzy' && a.distance !== b.distance) {
            return a.distance - b.distance;
        }

        return a.word.localeCompare(b.word);
    });

    currentSuggestions = allSuggestionObjects.slice(0, 10);
    renderSuggestions(currentSuggestions, query, selectedSuggestionIndex, handleSuggestionClick);

    hideLoadingSpinner();
}, 300);

function handleSuggestionSelect(word) {
    searchInput.value = word;
    const lowerCaseWord = word.toLowerCase();
    wordFrequencies.set(lowerCaseWord, (wordFrequencies.get(lowerCaseWord) || 0) + 1);
    saveFrequencies(wordFrequencies);

    recentSearches.delete(lowerCaseWord);
    recentSearches.add(lowerCaseWord);
    const limitedSearches = Array.from(recentSearches).slice(-MAX_RECENT_SEARCHES);
    recentSearches.clear();
    limitedSearches.forEach(item => recentSearches.add(item));
    saveRecentSearches(recentSearches);

    renderSuggestions([], '', selectedSuggestionIndex, handleSuggestionClick);
    renderRecentSearches(recentSearches, handleRecentSearchClick);
    searchInput.focus();
    resetAriaAttributes();
}

function handleSuggestionClick(word) {
    handleSuggestionSelect(word);
}

function handleRecentSearchClick(word) {
    searchInput.value = word;
    const event = new Event('input', { bubbles: true });
    searchInput.dispatchEvent(event);
    searchInput.focus();
}

function handleKeyDown(e) {
    const items = suggestionsBox.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;
        highlightSelectedSuggestion(selectedSuggestionIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex - 1 + items.length) % items.length;
        highlightSelectedSuggestion(selectedSuggestionIndex);
    } else if (e.key === 'Enter') {
        if (selectedSuggestionIndex !== -1) {
            e.preventDefault();
            const selectedWord = currentSuggestions[selectedSuggestionIndex].word;
            handleSuggestionSelect(selectedWord);
        } else if (searchInput.value.trim().length > 0) {
            const queryLowercase = searchInput.value.trim().toLowerCase();
            if (dictionary.some(w => w.toLowerCase() === queryLowercase)) {
                handleSuggestionSelect(queryLowercase);
            } else {
                renderSuggestions([], queryLowercase, selectedSuggestionIndex, handleSuggestionClick);
                hideLoadingSpinner();
            }
        }
    } else if (e.key === 'Escape') {
        renderSuggestions([], '', selectedSuggestionIndex, handleSuggestionClick);
        renderRecentSearches(recentSearches, handleRecentSearchClick);
        selectedSuggestionIndex = -1;
        resetAriaAttributes();
        hideLoadingSpinner();
    }
}

function initializeApp() {
    searchInput.addEventListener('input', initiateSearch);
    searchInput.addEventListener('keydown', handleKeyDown);
    clearInputBtn.addEventListener('click', () => {
        searchInput.value = '';
        initiateSearch();
        searchInput.focus();
        toggleClearButton();
    });

    document.addEventListener('click', (e) => {
        if (!suggestionsBox.contains(e.target) && e.target !== searchInput &&
            !recentSearchesBox.contains(e.target) && !clearInputBtn.contains(e.target) &&
            e.target !== clearInputBtn && !loadingSpinner.contains(e.target) && e.target !== loadingSpinner) {
            renderSuggestions([], '', selectedSuggestionIndex, handleSuggestionClick);
            renderRecentSearches(recentSearches, handleRecentSearchClick);
            toggleClearButton();
            resetAriaAttributes();
            hideLoadingSpinner();
        }
    });

    searchInput.focus();
    toggleClearButton();
    renderRecentSearches(recentSearches, handleRecentSearchClick);
}

window.onload = initializeApp;
