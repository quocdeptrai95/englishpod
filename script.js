let currentFilter = 'all';
let displayedCount = 30;
const LOAD_MORE_COUNT = 30;
let currentSearchQuery = '';
let searchCache = new Map(); // Cache search results

// Recently Played System
const RECENTLY_PLAYED_KEY = 'englishpod_recent';
const MAX_RECENT = 10;

function getRecentlyPlayed() {
    try {
        const data = localStorage.getItem(RECENTLY_PLAYED_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function addToRecentlyPlayed(episodeId, title, level) {
    try {
        let recent = getRecentlyPlayed();
        // Remove if already exists
        recent = recent.filter(ep => ep.id !== episodeId);
        // Add to front
        recent.unshift({ id: episodeId, title, level, timestamp: Date.now() });
        // Keep only last 10
        recent = recent.slice(0, MAX_RECENT);
        localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(recent));
        updateRecentlyPlayedUI();
    } catch (e) {
        console.error('Failed to save recently played:', e);
    }
}

function updateRecentlyPlayedUI() {
    const container = document.getElementById('recentlyPlayed');
    if (!container) return;
    
    const recent = getRecentlyPlayed();
    if (recent.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    const grid = container.querySelector('.recent-grid');
    if (!grid) return;
    
    grid.innerHTML = recent.map(ep => `
        <div class="recent-item" data-id="${ep.id}">
            <div class="recent-number">#${ep.id}</div>
            <div class="recent-info">
                <div class="recent-title">${ep.title}</div>
                <div class="recent-level">${ep.level}</div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    grid.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            const episode = await getEpisode(id);
            if (episode) playEpisode(episode);
        });
    });
}

// Notification function
function showNotification(message) {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Chunk loading system
const loadedChunks = new Set();
const episodesData = new Map(); // id -> full episode data

// Function to get episodes index (handles async loading)
function getEpisodesIndex() {
    return window.episodesIndex || [];
}

// Load a chunk file
async function loadChunk(chunkNumber) {
    if (loadedChunks.has(chunkNumber)) return;
    
    return new Promise((resolve, reject) => {
        // Check if chunk data already exists in window
        const existingChunk = window[`episodesChunk${chunkNumber}`];
        if (existingChunk) {
            existingChunk.forEach(ep => episodesData.set(ep.id, ep));
            loadedChunks.add(chunkNumber);
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = `episodes-chunk-${chunkNumber}.js`;
        script.onload = () => {
            // Get the chunk data
            const chunkData = window[`episodesChunk${chunkNumber}`];
            if (chunkData) {
                chunkData.forEach(ep => episodesData.set(ep.id, ep));
                loadedChunks.add(chunkNumber);
            }
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Get episode with auto-loading
async function getEpisode(id) {
    if (episodesData.has(id)) {
        return episodesData.get(id);
    }
    
    // Find which chunk this episode is in
    const episodeIndex = getEpisodesIndex().find(ep => ep.id === id);
    if (!episodeIndex) return null;
    
    // Load the chunk
    await loadChunk(episodeIndex.chunk);
    return episodesData.get(id);
}

const episodesGrid = document.getElementById('episodesGrid');
const episodeDetail = document.getElementById('episodeDetail');
const audioPlayer = document.getElementById('audioPlayer');
const detailTitle = document.getElementById('detailTitle');
const detailLevel = document.getElementById('detailLevel');
const showBtn = document.getElementById('showBtn');
const closeBtn = document.getElementById('closeBtn');
const transcriptContent = document.getElementById('transcriptContent');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const searchResultsInfo = document.getElementById('searchResultsInfo');

// Theme Management
const THEME_KEY = 'englishpod_theme';

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
}

function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showNotification(newTheme === 'light' ? '☀️ Light mode' : '🌙 Dark mode');
}

// Search System
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function searchEpisodes(query) {
    if (!query || query.length < 2) {
        currentSearchQuery = '';
        searchResultsInfo.style.display = 'none';
        renderEpisodes();
        return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    currentSearchQuery = lowerQuery;
    
    // Check cache first
    if (searchCache.has(lowerQuery)) {
        const cached = searchCache.get(lowerQuery);
        displaySearchResults(cached, lowerQuery);
        return;
    }
    
    // Search in episodes index first (title and level)
    const episodesIndex = getEpisodesIndex();
    const results = [];
    
    for (const ep of episodesIndex) {
        let score = 0;
        let matched = false;
        
        // Search in title (highest priority)
        if (ep.title.toLowerCase().includes(lowerQuery)) {
            score += 100;
            matched = true;
        }
        
        // Search in level
        if (ep.level.toLowerCase().includes(lowerQuery)) {
            score += 50;
            matched = true;
        }
        
        if (matched) {
            results.push({ ...ep, score });
        }
    }
    
    // Load episodes and search in vocab/transcript for remaining episodes
    const detailedSearchPromises = episodesIndex
        .filter(ep => !results.find(r => r.id === ep.id))
        .slice(0, 50) // Limit detailed search to 50 episodes for performance
        .map(async (ep) => {
            try {
                const episode = await getEpisode(ep.id);
                if (!episode) return null;
            
            let score = 0;
            let matched = false;
            
            // Search in vocabulary (with safety checks)
            if (episode.vocabulary) {
                try {
                    const keyMatch = Array.isArray(episode.vocabulary.key) && 
                        episode.vocabulary.key.some(v => v && v.word && v.word.toLowerCase().includes(lowerQuery));
                    const suppMatch = Array.isArray(episode.vocabulary.supplementary) && 
                        episode.vocabulary.supplementary.some(v => v && v.word && v.word.toLowerCase().includes(lowerQuery));
                    
                    if (keyMatch || suppMatch) {
                        score += 30;
                        matched = true;
                    }
                } catch (e) {
                    // Skip vocab search if error
                }
            }
            
            // Search in transcript (with safety checks)
            if (Array.isArray(episode.dialogue)) {
                try {
                    const transcriptMatch = episode.dialogue.some(line => 
                        line && line.text && line.text.toLowerCase().includes(lowerQuery)
                    );
                    if (transcriptMatch) {
                        score += 20;
                        matched = true;
                    }
                } catch (e) {
                    // Skip transcript search if error
                }
            }
            
            return matched ? { ...ep, score } : null;
            } catch (error) {
                // If episode loading fails, skip it
                console.warn(`Failed to search episode ${ep.id}:`, error);
                return null;
            }
        });
    
    try {
        const detailedResults = (await Promise.all(detailedSearchPromises)).filter(Boolean);
        const allResults = [...results, ...detailedResults].sort((a, b) => b.score - a.score);
    
        // Cache results
        searchCache.set(lowerQuery, allResults);
        
        // Limit cache size
        if (searchCache.size > 20) {
            const firstKey = searchCache.keys().next().value;
            searchCache.delete(firstKey);
        }
        
        displaySearchResults(allResults, lowerQuery);
    } catch (error) {
        console.error('Search error:', error);
        // Show title/level results at least
        displaySearchResults(results, lowerQuery);
    }
}

function displaySearchResults(results, query) {
    if (currentSearchQuery !== query) return; // Query changed, ignore
    
    if (!searchResultsInfo || !episodesGrid) {
        console.error('Search UI elements not found');
        return;
    }
    
    if (!Array.isArray(results) || results.length === 0) {
        searchResultsInfo.style.display = 'block';
        searchResultsInfo.innerHTML = `No results found for "<span class="highlight">${escapeHtml(query)}</span>"`;
        episodesGrid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Try different keywords</div>';
        return;
    }
    
    searchResultsInfo.style.display = 'block';
    searchResultsInfo.innerHTML = `Found <span class="highlight">${results.length}</span> episode${results.length > 1 ? 's' : ''} for "<span class="highlight">${escapeHtml(query)}</span>"`;
    
    // Render filtered results
    displayedCount = Math.min(30, results.length);
    renderFilteredEpisodes(results);
}

function renderFilteredEpisodes(filteredEpisodes) {
    episodesGrid.innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(12);
    
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        const toDisplay = filteredEpisodes.slice(0, displayedCount);
        
        toDisplay.forEach((ep, index) => {
            const card = document.createElement('div');
            card.className = 'episode-card';
            card.dataset.id = ep.id;
            card.style.opacity = '0';
            card.style.animation = `fadeIn 0.2s ease-out ${Math.min(index * 10, 200)}ms forwards`;
            
            card.innerHTML = `
                <div class="episode-number">${ep.id}</div>
                <h3>${ep.title}</h3>
                <span class="level-badge">${ep.level}</span>
            `;
            
            card.addEventListener('click', async () => {
                const originalHTML = card.innerHTML;
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
                card.innerHTML = `
                    <div class="episode-number">${ep.id}</div>
                    <h3>${ep.title}</h3>
                    <span class="level-badge">${ep.level}</span>
                    <div style="text-align: center; margin-top: 10px; color: #6366f1;">Loading...</div>
                `;
                
                const episode = await getEpisode(ep.id);
                if (episode) {
                    playEpisode(episode);
                } else {
                    card.innerHTML = originalHTML;
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                    showNotification('❌ Failed to load episode');
                }
            });
            
            fragment.appendChild(card);
        });
        
        episodesGrid.innerHTML = '';
        episodesGrid.appendChild(fragment);
        
        // Add "Load More" button if there are more results
        if (displayedCount < filteredEpisodes.length) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.textContent = `Load More (${filteredEpisodes.length - displayedCount} remaining)`;
            loadMoreBtn.onclick = () => {
                displayedCount += LOAD_MORE_COUNT;
                loadMoreBtn.remove();
                renderFilteredEpisodes(filteredEpisodes);
            };
            episodesGrid.appendChild(loadMoreBtn);
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Debounced search handler
const debouncedSearch = debounce(searchEpisodes, 300);

// Initialize app
function initApp() {
    // Apply saved theme
    setTheme(getTheme());
    
    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Main title click to go home
    const mainTitle = document.getElementById('mainTitle');
    if (mainTitle) {
        mainTitle.addEventListener('click', () => location.reload());
    }
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query) {
                searchClear.style.display = 'flex';
            } else {
                searchClear.style.display = 'none';
            }
            
            debouncedSearch(query);
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchClear.style.display = 'none';
                currentSearchQuery = '';
                searchResultsInfo.style.display = 'none';
                renderEpisodes();
            }
        });
    }
    
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            currentSearchQuery = '';
            searchResultsInfo.style.display = 'none';
            searchCache.clear();
            renderEpisodes();
            searchInput.focus();
        });
    }
    
    // Show recently played episodes
    updateRecentlyPlayedUI();
    
    renderEpisodes();
    
    // Force service worker update check
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.update().catch(() => {});
        });
        
        // Listen for updates
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // New service worker activated, show notification
            if (window.localStorage.getItem('sw-updated') !== 'true') {
                window.localStorage.setItem('sw-updated', 'true');
                showNotification('✨ App updated! Refresh for new features.');
                setTimeout(() => {
                    window.localStorage.removeItem('sw-updated');
                }, 5000);
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.level;
        
        // Clear search when changing filters
        if (searchInput) {
            searchInput.value = '';
            searchClear.style.display = 'none';
            currentSearchQuery = '';
            searchResultsInfo.style.display = 'none';
        }
        
        renderEpisodes();
    });
});

// Close button
closeBtn.addEventListener('click', () => {
    episodeDetail.style.display = 'none';
    episodesGrid.style.display = 'grid';
    audioPlayer.pause();
    
    // Cleanup: Stop recording if active
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        if (targetTab === 'transcript') {
            document.getElementById('transcriptTab').classList.add('active');
        } else if (targetTab === 'vocab') {
            document.getElementById('vocabTab').classList.add('active');
        } else if (targetTab === 'practice') {
            document.getElementById('practiceTab').classList.add('active');
        }
    });
});

// Show transcript button
const showTranscriptBtn = document.getElementById('showTranscriptBtn');
showTranscriptBtn.addEventListener('click', () => {
    if (transcriptContent.style.display === 'none') {
        if (transcriptContent.innerHTML.includes('Click')) {
            loadTranscript();
        }
        transcriptContent.style.display = 'block';
        showTranscriptBtn.textContent = '👁 Hide';
    } else {
        transcriptContent.style.display = 'none';
        showTranscriptBtn.textContent = '👁 Show';
    }
});

// Show vocab button
const showVocabBtn = document.getElementById('showVocabBtn');
const vocabContent = document.getElementById('vocabContent');
showVocabBtn.addEventListener('click', () => {
    if (vocabContent.style.display === 'none') {
        if (vocabContent.innerHTML.includes('Click')) {
            loadVocab();
        }
        vocabContent.style.display = 'block';
        showVocabBtn.textContent = '👁 Hide';
    } else {
        vocabContent.style.display = 'none';
        showVocabBtn.textContent = '👁 Show';
    }
});

function renderEpisodes(append = false) {
    // If search is active, don't override search results
    if (currentSearchQuery) return;
    
    const episodesIndex = getEpisodesIndex();
    
    // Wait for episodes index to load if not ready yet
    if (!episodesIndex || episodesIndex.length === 0) {
        setTimeout(() => renderEpisodes(append), 50);
        return;
    }
    
    const filtered = currentFilter === 'all' 
        ? episodesIndex 
        : episodesIndex.filter(ep => ep.level === currentFilter);

    // Reset displayed count if not appending
    if (!append) {
        displayedCount = 30;
        // Show skeleton loading (minimal HTML for faster render)
        episodesGrid.innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(12);
    }

    // Render actual content immediately for better performance
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        // When appending, only slice the new episodes
        const startIndex = append ? displayedCount - LOAD_MORE_COUNT : 0;
        const toDisplay = filtered.slice(startIndex, displayedCount);
        
        toDisplay.forEach((ep, index) => {
            const card = document.createElement('div');
            card.className = 'episode-card';
            card.dataset.id = ep.id;
            card.style.opacity = '0';
            // Reduced animation delay for faster perceived loading
            card.style.animation = `fadeIn 0.2s ease-out ${append ? 0 : Math.min(index * 10, 200)}ms forwards`;
            
                card.innerHTML = `
                    <div class="episode-number">${ep.id}</div>
                    <h3>${ep.title}</h3>
                    <span class="level-badge">${ep.level}</span>
                `;
                
                // Add click listener directly
                card.addEventListener('click', async () => {
                    // Show loading state
                    const originalHTML = card.innerHTML;
                    card.style.opacity = '0.5';
                    card.style.pointerEvents = 'none';
                    card.innerHTML = `
                        <div class="episode-number">${ep.id}</div>
                        <h3>${ep.title}</h3>
                        <span class="level-badge">${ep.level}</span>
                        <div style="text-align: center; margin-top: 10px; color: #6366f1;">Loading...</div>
                    `;
                    
                    const episode = await getEpisode(ep.id);
                    if (episode) {
                        playEpisode(episode);
                    } else {
                        // Restore original state if failed
                        card.innerHTML = originalHTML;
                        card.style.opacity = '1';
                        card.style.pointerEvents = 'auto';
                        showNotification('❌ Failed to load episode');
                    }
                });
                
                fragment.appendChild(card);
            });
            
            if (!append) {
                episodesGrid.innerHTML = '';
            }
            episodesGrid.appendChild(fragment);
            
            // Add "Load More" button if there are more episodes
            if (displayedCount < filtered.length) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = `Load More (${filtered.length - displayedCount} remaining)`;
                loadMoreBtn.onclick = () => {
                    displayedCount += LOAD_MORE_COUNT;
                    loadMoreBtn.remove();
                    renderEpisodes(true);
                };
                episodesGrid.appendChild(loadMoreBtn);
            }
    });
}

let currentEpisode = null;

function playEpisode(episode) {
    currentEpisode = episode;
    
    // Add to recently played
    addToRecentlyPlayed(episode.id, episode.title, episode.level);
    
    detailTitle.textContent = episode.title;
    detailLevel.textContent = episode.level;
    
    // Update mini player
    updateMiniPlayer();
    
    // Show episode detail immediately
    episodesGrid.style.display = 'none';
    episodeDetail.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Reset audio player and start loading
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    
    audioPlayer.src = episode.mp3;
    audioPlayer.preload = 'auto'; // Load audio data for instant playback
    audioPlayer.load(); // Force load the audio
    
    // Show ready notification
    showNotification('▶️ Tap play to start');
    
    // Setup Media Session API for background playback
    if ('mediaSession' in navigator) {
        // Create a simple canvas icon for artwork
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Draw a gradient background
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw episode number
        ctx.fillStyle = 'white';
        ctx.font = 'bold 120px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(episode.id.toString(), 256, 256);
        
        // Convert canvas to blob URL
        canvas.toBlob(blob => {
            // Revoke previous artwork URL if exists
            if (window.currentArtworkUrl) {
                URL.revokeObjectURL(window.currentArtworkUrl);
            }
            
            const iconUrl = URL.createObjectURL(blob);
            window.currentArtworkUrl = iconUrl;
            
            navigator.mediaSession.metadata = new MediaMetadata({
                title: episode.title,
                artist: 'EnglishPod',
                album: episode.level,
                artwork: [
                    { src: iconUrl, sizes: '512x512', type: 'image/png' }
                ]
            });
        });
        
        // Fallback if canvas fails
        setTimeout(() => {
            if (!navigator.mediaSession.metadata) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: episode.title,
                    artist: 'EnglishPod',
                    album: episode.level
                });
            }
        }, 100);

        // Set up action handlers for background controls (locks, notifications)
        navigator.mediaSession.setActionHandler('play', () => {
            audioPlayer.play().catch(() => {}); // Silently fail
        });
        navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
        });
        navigator.mediaSession.setActionHandler('previoustrack', async () => {
            const episodesIndex = getEpisodesIndex();
            const currentIndex = episodesIndex.findIndex(ep => ep.id === currentEpisode.id);
            if (currentIndex > 0) {
                const prevEpisode = await getEpisode(episodesIndex[currentIndex - 1].id);
                if (prevEpisode) playEpisode(prevEpisode);
            }
        });
        navigator.mediaSession.setActionHandler('nexttrack', async () => {
            const episodesIndex = getEpisodesIndex();
            const currentIndex = episodesIndex.findIndex(ep => ep.id === currentEpisode.id);
            if (currentIndex < episodesIndex.length - 1) {
                const nextEpisode = await getEpisode(episodesIndex[currentIndex + 1].id);
                if (nextEpisode) playEpisode(nextEpisode);
            }
        });
    }
    
    // Reset transcript and vocab
    transcriptContent.innerHTML = '<p>Click "Show" to view the transcript.</p>';
    transcriptContent.style.display = 'none';
    showTranscriptBtn.textContent = '👁 Show';
    
    vocabContent.innerHTML = '<p>Click "Show" to view the vocabulary.</p>';
    vocabContent.style.display = 'none';
    showVocabBtn.textContent = '👁 Show';
    
    // Reset to transcript tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="transcript"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('transcriptTab').classList.add('active');
    
    // Setup custom player controls (will handle loading state)
    setupCustomPlayer();
    
    // Initialize practice controls
    initializePracticeControls();
}

// Flag to prevent duplicate event listeners
let playerInitialized = false;

function setupCustomPlayer() {
    // Only setup event listeners once to prevent memory leaks
    if (playerInitialized) return;
    playerInitialized = true;
    
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const speedBtn = document.getElementById('speedBtn');
    const volumeBtn = document.getElementById('volumeBtn');
    const repeatBtn = document.getElementById('repeatBtn');
    const progressBar = document.querySelector('.progress-bar');
    const progressFilled = document.getElementById('progressFilled');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');
    const loadingSpinner = playBtn.querySelector('.loading-spinner');
    
    let speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    let currentSpeedIndex = 2; // Start at 1x (index 2)
    let repeatMode = null; // null, or {start: number, end: number, maxRepeats: number, currentRepeat: number}
    let isSettingRepeatPoint = false;
    const repeatOptions = [1, 2, 3, Infinity]; // 1x, 2x, 3x, ∞
    let currentRepeatOption = 0;
    
    // Show loading state
    const showLoading = () => {
        playBtn.querySelector('.play-icon').style.display = 'none';
        playBtn.querySelector('.pause-icon').style.display = 'none';
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        playBtn.disabled = true;
    };
    
    const hideLoading = () => {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        playBtn.disabled = false;
        // Restore play icon if audio is paused
        if (audioPlayer.paused) {
            playBtn.querySelector('.play-icon').style.display = 'block';
            playBtn.querySelector('.pause-icon').style.display = 'none';
        } else {
            playBtn.querySelector('.play-icon').style.display = 'none';
            playBtn.querySelector('.pause-icon').style.display = 'block';
        }
    };
    
    // Audio loading events
    audioPlayer.addEventListener('loadstart', () => {
        showLoading();
        // Safety timeout - hide loading after 2s even if canplay doesn't fire
        window.audioLoadTimeout = setTimeout(() => {
            hideLoading();
        }, 2000);
    });
    
    const onAudioReady = () => {
        // Clear loading timeout
        if (window.audioLoadTimeout) {
            clearTimeout(window.audioLoadTimeout);
        }
        
        hideLoading();
        showNotification('▶️ Ready! Tap play to start');
    };
    
    audioPlayer.addEventListener('canplay', onAudioReady);
    audioPlayer.addEventListener('loadeddata', onAudioReady);
    
    audioPlayer.addEventListener('error', (e) => {
        hideLoading();
        const errorMsg = audioPlayer.error ? 
            `Code: ${audioPlayer.error.code}, ${audioPlayer.error.message || 'Unknown error'}` : 
            'Failed to load audio';
        showNotification('❌ Audio error: ' + errorMsg);
    });
    
    audioPlayer.addEventListener('waiting', showLoading);
    audioPlayer.addEventListener('playing', hideLoading);
    
    // Play/Pause
    playBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            // Load audio on first play (mobile requires user gesture)
            if (audioPlayer.readyState === 0) {
                showLoading();
                audioPlayer.load();
            }
            
            // Show loading while waiting for play to start
            showLoading();
            
            audioPlayer.play().then(() => {
                // Play succeeded, make sure loading is hidden
                hideLoading();
            }).catch(err => {
                hideLoading();
                showNotification('❌ Cannot play: ' + err.message);
            });
        } else {
            audioPlayer.pause();
        }
    });
    
    audioPlayer.addEventListener('play', () => {
        playBtn.querySelector('.play-icon').style.display = 'none';
        playBtn.querySelector('.pause-icon').style.display = 'block';
        
        // Update Media Session playback state for background playback
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    });
    
    audioPlayer.addEventListener('pause', () => {
        playBtn.querySelector('.play-icon').style.display = 'block';
        playBtn.querySelector('.pause-icon').style.display = 'none';
        
        // Update Media Session playback state
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    });
    
    // Time update
    audioPlayer.addEventListener('timeupdate', () => {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFilled.style.width = percent + '%';
        
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        
        // A-B Repeat logic
        if (repeatMode && repeatMode.start !== null && repeatMode.end !== null) {
            if (audioPlayer.currentTime >= repeatMode.end) {
                repeatMode.currentRepeat++;
                if (repeatMode.currentRepeat < repeatMode.maxRepeats) {
                    audioPlayer.currentTime = repeatMode.start;
                } else {
                    // Finished all repeats
                    repeatMode = null;
                    repeatBtn.classList.remove('active');
                    clearRepeatMarkers();
                    showNotification('A-B Repeat completed');
                }
            }
        }
    });
    
    audioPlayer.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audioPlayer.duration);
    });
    
    // Auto-play next episode when current ends
    audioPlayer.addEventListener('ended', async () => {
        const episodesIndex = getEpisodesIndex();
        const currentIndex = episodesIndex.findIndex(ep => ep.id === currentEpisode.id);
        
        if (currentIndex < episodesIndex.length - 1) {
            showNotification('⏭️ Playing next episode...');
            const nextEpisode = await getEpisode(episodesIndex[currentIndex + 1].id);
            if (nextEpisode) {
                playEpisode(nextEpisode);
                // Auto-play the next episode
                setTimeout(() => {
                    audioPlayer.play().catch(() => {});
                }, 500);
            }
        } else {
            showNotification('🎉 You\'ve reached the end!');
        }
    });
    
    // Progress bar click and drag
    let isDraggingProgress = false;
    
    const updateProgressFromEvent = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        return percent * audioPlayer.duration;
    };
    
    progressBar.addEventListener('mousedown', (e) => {
        if (isSettingRepeatPoint) return;
        isDraggingProgress = true;
        const time = updateProgressFromEvent(e);
        audioPlayer.currentTime = time;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDraggingProgress) return;
        const time = updateProgressFromEvent(e);
        audioPlayer.currentTime = time;
    });
    
    document.addEventListener('mouseup', () => {
        isDraggingProgress = false;
    });
    
    progressBar.addEventListener('click', (e) => {
        if (isSettingRepeatPoint) {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const time = percent * audioPlayer.duration;
            
            if (repeatMode.start === null) {
                repeatMode.start = time;
                updateRepeatMarkers();
                // Show notification
                showNotification('Point A set. Click again to set Point B');
            } else if (repeatMode.end === null) {
                repeatMode.end = Math.max(time, repeatMode.start + 1);
                repeatMode.maxRepeats = repeatOptions[0]; // Start with 1x
                repeatMode.currentRepeat = 0;
                updateRepeatMarkers();
                isSettingRepeatPoint = false;
                repeatBtn.classList.add('active');
                const label = repeatMode.maxRepeats === Infinity ? '∞' : `${repeatMode.maxRepeats}x`;
                repeatBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${label}`;
                showNotification(`A-B Repeat enabled: ${label}`);
            }
        } else {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audioPlayer.currentTime = percent * audioPlayer.duration;
        }
    });
    
    // A-B Repeat button
    repeatBtn.addEventListener('click', () => {
        if (!repeatMode) {
            // Start setting repeat points
            repeatMode = { start: null, end: null, maxRepeats: 1, currentRepeat: 0 };
            isSettingRepeatPoint = true;
            currentRepeatOption = 0;
            repeatBtn.classList.add('setting');
            repeatBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> 1x';
            showNotification('Click on progress bar to set Point A');
        } else if (isSettingRepeatPoint) {
            // Cancel setting
            repeatMode = null;
            isSettingRepeatPoint = false;
            currentRepeatOption = 0;
            repeatBtn.classList.remove('setting', 'active');
            repeatBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
            clearRepeatMarkers();
            showNotification('A-B Repeat cancelled');
        } else {
            // Cycle through repeat options: 1x → 2x → 3x → ∞ → Clear
            currentRepeatOption++;
            if (currentRepeatOption >= repeatOptions.length) {
                // Clear repeat
                repeatMode = null;
                currentRepeatOption = 0;
                repeatBtn.classList.remove('active');
                repeatBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
                clearRepeatMarkers();
                showNotification('A-B Repeat cleared');
            } else {
                // Update max repeats
                const newMax = repeatOptions[currentRepeatOption];
                repeatMode.maxRepeats = newMax;
                repeatMode.currentRepeat = 0;
                const label = newMax === Infinity ? '∞' : `${newMax}x`;
                repeatBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${label}`;
                showNotification(`A-B Repeat: ${label}`);
            }
        }
    });
    
    function updateRepeatMarkers() {
        // Clear existing markers
        document.querySelectorAll('.repeat-marker').forEach(m => m.remove());
        
        if (!repeatMode) return;
        
        const duration = audioPlayer.duration;
        
        if (repeatMode.start !== null) {
            const marker = document.createElement('div');
            marker.className = 'repeat-marker repeat-start';
            marker.style.left = (repeatMode.start / duration * 100) + '%';
            marker.title = 'Point A: ' + formatTime(repeatMode.start);
            progressBar.appendChild(marker);
        }
        
        if (repeatMode.end !== null) {
            const marker = document.createElement('div');
            marker.className = 'repeat-marker repeat-end';
            marker.style.left = (repeatMode.end / duration * 100) + '%';
            marker.title = 'Point B: ' + formatTime(repeatMode.end);
            progressBar.appendChild(marker);
            
            // Add highlighted region
            const region = document.createElement('div');
            region.className = 'repeat-region';
            region.style.left = (repeatMode.start / duration * 100) + '%';
            region.style.width = ((repeatMode.end - repeatMode.start) / duration * 100) + '%';
            progressBar.appendChild(region);
        }
    }
    
    function clearRepeatMarkers() {
        document.querySelectorAll('.repeat-marker, .repeat-region').forEach(m => m.remove());
    }
    
    // Speed control
    speedBtn.addEventListener('click', () => {
        currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
        audioPlayer.playbackRate = speeds[currentSpeedIndex];
        speedBtn.textContent = speeds[currentSpeedIndex] + 'x';
    });
    
    // Volume control
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeSliderContainer = document.querySelector('.volume-slider');
    const volumeHighIcon = volumeBtn.querySelector('.volume-high-icon');
    const volumeMutedIcon = volumeBtn.querySelector('.volume-muted-icon');
    const volumePercentage = document.querySelector('.volume-percentage');
    let previousVolume = 1;
    
    function updateVolumeIcon() {
        if (audioPlayer.muted || audioPlayer.volume === 0) {
            volumeHighIcon.style.display = 'none';
            volumeMutedIcon.style.display = 'block';
        } else {
            volumeHighIcon.style.display = 'block';
            volumeMutedIcon.style.display = 'none';
        }
    }
    
    volumeBtn.addEventListener('click', () => {
        if (volumeSliderContainer.style.display === 'none') {
            volumeSliderContainer.style.display = 'flex';
        } else {
            volumeSliderContainer.style.display = 'none';
        }
    });
    
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        audioPlayer.volume = volume;
        audioPlayer.muted = false;
        volumePercentage.textContent = e.target.value + '%';
        // Update CSS custom property for gradient fill
        volumeSlider.style.setProperty('--volume-percent', e.target.value + '%');
        updateVolumeIcon();
    });
    
    // Click outside to close volume slider
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.volume-control')) {
            volumeSliderContainer.style.display = 'none';
        }
    });
    
    updateVolumeIcon();
    
    // Previous/Next Episode buttons
    prevBtn.addEventListener('click', async () => {
        const episodesIndex = getEpisodesIndex();
        const currentIndex = episodesIndex.findIndex(ep => ep.id === currentEpisode.id);
        
        if (currentIndex > 0) {
            showNotification('⏮️ Loading previous episode...');
            const prevEpisode = await getEpisode(episodesIndex[currentIndex - 1].id);
            if (prevEpisode) {
                playEpisode(prevEpisode);
            }
        } else {
            showNotification('⏮️ This is the first episode');
        }
    });
    
    nextBtn.addEventListener('click', async () => {
        const episodesIndex = getEpisodesIndex();
        const currentIndex = episodesIndex.findIndex(ep => ep.id === currentEpisode.id);
        
        if (currentIndex < episodesIndex.length - 1) {
            showNotification('⏭️ Loading next episode...');
            const nextEpisode = await getEpisode(episodesIndex[currentIndex + 1].id);
            if (nextEpisode) {
                playEpisode(nextEpisode);
            }
        } else {
            showNotification('⏭️ This is the last episode');
        }
    });
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

async function loadTranscript() {
    if (!currentEpisode || !currentEpisode.transcriptData) {
        transcriptContent.innerHTML = '<p style="color: #ef4444;">No transcript data available.</p>';
        return;
    }
    
    const dialogues = currentEpisode.transcriptData;
    
    if (dialogues.length === 0) {
        transcriptContent.innerHTML = '<p>No transcript available for this episode.</p>';
        return;
    }
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    dialogues.forEach((item, index) => {
        const line = document.createElement('div');
        line.className = 'dialogue-line';
        line.style.opacity = '0';
        line.style.animation = `slideInLeft 0.3s ease-out ${index * 50}ms forwards`;
        
        line.innerHTML = `
            <div class="speaker-badge speaker-${item.speaker.toLowerCase()}">${item.speaker}</div>
            <div class="dialogue-text">${item.text}</div>
        `;
        
        fragment.appendChild(line);
    });

    transcriptContent.innerHTML = '';
    transcriptContent.appendChild(fragment);
    
    // Setup practice mode for transcript lines
    setupPracticeMode();
}

async function loadVocab() {
    if (!currentEpisode || !currentEpisode.vocabData) {
        vocabContent.innerHTML = '<p style="color: #ef4444;">No vocabulary data available.</p>';
        return;
    }
    
    const vocab = currentEpisode.vocabData;
    let vocabHTML = '';
    
    // Key Vocabulary
    if (vocab.key && vocab.key.length > 0) {
        vocabHTML += '<div class="vocab-section"><h3>Key Vocabulary</h3>';
        vocabHTML += '<table class="vocab-table">';
        vocab.key.forEach((item, index) => {
            vocabHTML += `
                <tr>
                    <td class="vocab-word">
                        <button class="speak-btn" onclick="speakWord('${item.word.replace(/'/g, "\\'")}')"
                                title="Pronunciation (UK)" aria-label="Speak ${item.word}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        </button>
                        ${item.word}
                    </td>
                    <td class="vocab-type">${item.type}</td>
                    <td class="vocab-def">${item.definition}</td>
                </tr>
            `;
        });
        vocabHTML += '</table></div>';
    }
    
    // Supplementary Vocabulary
    if (vocab.supplementary && vocab.supplementary.length > 0) {
        vocabHTML += '<div class="vocab-section"><h3>Supplementary Vocabulary</h3>';
        vocabHTML += '<table class="vocab-table">';
        vocab.supplementary.forEach((item, index) => {
            vocabHTML += `
                <tr>
                    <td class="vocab-word">
                        <button class="speak-btn" onclick="speakWord('${item.word.replace(/'/g, "\\'")}')"
                                title="Pronunciation (UK)" aria-label="Speak ${item.word}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        </button>
                        ${item.word}
                    </td>
                    <td class="vocab-type">${item.type}</td>
                    <td class="vocab-def">${item.definition}</td>
                </tr>
            `;
        });
        vocabHTML += '</table></div>';
    }
    
    if (!vocabHTML) {
        vocabHTML = '<p>No vocabulary available for this episode.</p>';
    }

    vocabContent.innerHTML = vocabHTML;
}

// Get best UK female voice
function getUKFemaleVoice() {
    const voices = window.speechSynthesis.getVoices();
    
    // Priority 1: Female UK voices
    let voice = voices.find(v => 
        (v.lang === 'en-GB' || v.lang.startsWith('en-GB')) && 
        (v.name.includes('Female') || v.name.includes('female'))
    );
    
    // Priority 2: Any female voice with UK in name
    if (!voice) {
        voice = voices.find(v => 
            v.name.toLowerCase().includes('uk') && 
            (v.name.includes('Female') || v.name.includes('female'))
        );
    }
    
    // Priority 3: Google UK Female
    if (!voice) {
        voice = voices.find(v => v.name.includes('Google UK English Female'));
    }
    
    // Priority 4: Any UK voice
    if (!voice) {
        voice = voices.find(v => v.lang === 'en-GB' || v.lang.startsWith('en-GB'));
    }
    
    return voice;
}

// Text-to-Speech for vocabulary pronunciation (UK accent)
function speakWord(word) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-GB'; // UK English
        utterance.rate = 0.8; // Slightly slower for clarity
        utterance.pitch = 1;
        
        // Use UK female voice
        const ukVoice = getUKFemaleVoice();
        if (ukVoice) {
            utterance.voice = ukVoice;
        }
        
        window.speechSynthesis.speak(utterance);
    } else {
        showNotification('Text-to-speech not supported in this browser');
    }
}

// Practice vocabulary word - switch to practice tab
function practiceVocabWord(word) {
    practiceText = word;
    
    // Initialize controls if needed
    if (!recordBtn) {
        initializePracticeControls();
    }
    
    if (practiceTextEl) {
        practiceTextEl.innerHTML = `
            <div style="padding: 24px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 2px solid rgba(99, 102, 241, 0.3); text-align: center;">
                <div style="display: inline-block; padding: 8px 16px; background: rgba(99, 102, 241, 0.15); border-radius: 8px; margin-bottom: 12px;">
                    <span style="color: var(--accent); font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🎯 Vocabulary</span>
                </div>
                <p style="font-size: 32px; font-weight: 700; color: var(--text-primary); margin-top: 8px;">${word}</p>
            </div>
        `;
    }
    if (recordBtn) recordBtn.disabled = false;
    if (playOriginalBtn) playOriginalBtn.disabled = false;
    
    // Switch to practice tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="practice"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('practiceTab').classList.add('active');
    
    showNotification('🎤 Ready to practice: ' + word);
}

// ===== PRONUNCIATION PRACTICE =====
let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let practiceText = '';
let practiceMode = 'single'; // 'single', 'dialogue', or 'roleplay'
let rolePlayRole = null; // 'A' or 'B'
let rolePlayDialogues = [];
let rolePlayCurrentIndex = 0;

// Will be initialized after DOM loads
let recordBtn = null;
let playOriginalBtn = null;
let playRecordingBtn = null;
let recordingStatus = null;
let pronunciationScore = null;
let scoreValue = null;
let scoreFeedback = null;
let practiceTextEl = null;
let practiceControlsInitialized = false;

// Pronunciation scoring removed - not needed

// Initialize practice controls after DOM loads
function initializePracticeControls() {
    // Only initialize once to prevent duplicate event listeners
    if (practiceControlsInitialized) return;
    
    recordBtn = document.getElementById('recordBtn');
    playOriginalBtn = document.getElementById('playOriginalBtn');
    playRecordingBtn = document.getElementById('playRecordingBtn');
    recordingStatus = document.getElementById('recordingStatus');
    pronunciationScore = document.getElementById('pronunciationScore');
    scoreValue = document.getElementById('scoreValue');
    scoreFeedback = document.getElementById('scoreFeedback');
    practiceTextEl = document.getElementById('practiceText');
    
    if (!recordBtn) {
        // Controls not found
        return;
    }
    
    practiceControlsInitialized = true;
    
    // Practice mode selector
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            practiceMode = btn.dataset.mode;
            
            const rolePlaySetup = document.getElementById('rolePlaySetup');
            
            if (practiceMode === 'dialogue') {
                if (rolePlaySetup) rolePlaySetup.style.display = 'none';
                startFullDialoguePractice();
            } else if (practiceMode === 'roleplay') {
                // Show role selector and reset
                if (rolePlaySetup) {
                    rolePlaySetup.style.display = 'block';
                    const roleSelector = rolePlaySetup.querySelector('.role-selector');
                    if (roleSelector) roleSelector.style.display = 'block';
                }
                startRolePlay(); // Setup role selector with dynamic speakers
                recordBtn.disabled = true;
                playOriginalBtn.disabled = true;
            } else {
                if (rolePlaySetup) rolePlaySetup.style.display = 'none';
                practiceTextEl.innerHTML = '<p style="opacity: 0.6;">Select a line from transcript to practice...</p>';
                recordBtn.disabled = true;
                playOriginalBtn.disabled = true;
            }
        });
    });
    
    // Note: Role selector event listeners are attached dynamically in startRolePlay()
    // to handle dynamic speaker detection
    
    // Record button
    recordBtn.addEventListener('click', handleRecordClick);
    
    // Play original audio with stop functionality
    let isPlayingOriginal = false;
    playOriginalBtn.addEventListener('click', () => {
        if (!practiceText) return;
        
        // If currently playing, stop it
        if (isPlayingOriginal) {
            window.speechSynthesis.cancel();
            isPlayingOriginal = false;
            playOriginalBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Play Original</span>
            `;
            return;
        }
        
        // Start playing
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(practiceText);
        utterance.lang = 'en-GB';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        // Use UK female voice
        const ukVoice = getUKFemaleVoice();
        if (ukVoice) {
            utterance.voice = ukVoice;
        }
        
        // Update button to show Stop
        isPlayingOriginal = true;
        playOriginalBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
            <span>Stop</span>
        `;
        
        // When speech ends, restore button
        utterance.onend = () => {
            isPlayingOriginal = false;
            playOriginalBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Play Original</span>
            `;
        };
        
        // Also restore on error
        utterance.onerror = () => {
            isPlayingOriginal = false;
            playOriginalBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Play Original</span>
            `;
        };
        
        window.speechSynthesis.speak(utterance);
    });
    
    // Play recorded audio with stop functionality
    let currentRecordingAudio = null;
    let isPlayingRecording = false;
    
    playRecordingBtn.addEventListener('click', () => {
        // If currently playing, stop it
        if (isPlayingRecording && currentRecordingAudio) {
            currentRecordingAudio.pause();
            currentRecordingAudio.currentTime = 0;
            currentRecordingAudio = null;
            isPlayingRecording = false;
            playRecordingBtn.disabled = false;
            playRecordingBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Play My Recording</span>
            `;
            return;
        }
        
        if (recordedBlob) {
            playRecordingBtn.disabled = true;
            playRecordingBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                </svg>
                <span>Loading...</span>
            `;
            
            const audioUrl = URL.createObjectURL(recordedBlob);
            const audio = new Audio(audioUrl);
            currentRecordingAudio = audio;
            
            // Wait for audio to be ready before playing
            audio.onloadeddata = () => {
                isPlayingRecording = true;
                playRecordingBtn.disabled = false;
                playRecordingBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                    <span>Stop</span>
                `;
                
                audio.play().catch(err => {
                    URL.revokeObjectURL(audioUrl);
                    isPlayingRecording = false;
                    currentRecordingAudio = null;
                    playRecordingBtn.disabled = false;
                    playRecordingBtn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>Play My Recording</span>
                    `;
                    showNotification('❌ Cannot play recording: ' + err.message);
                });
            };
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                isPlayingRecording = false;
                currentRecordingAudio = null;
                playRecordingBtn.disabled = false;
                playRecordingBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Play My Recording</span>
                `;
            };
            
            audio.onerror = (e) => {
                URL.revokeObjectURL(audioUrl);
                isPlayingRecording = false;
                currentRecordingAudio = null;
                playRecordingBtn.disabled = false;
                playRecordingBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Play My Recording</span>
                `;
                showNotification('❌ Cannot play recording - format not supported');
            };
            
            // Start loading the audio
            audio.load();
        } else {
            showNotification('❌ No recording available. Please record first.');
        }
    });
}

// Handle transcript line click for practice
function setupPracticeMode() {
    if (!recordBtn) {
        initializePracticeControls();
    }
    
    document.querySelectorAll('.dialogue-line').forEach(line => {
        line.addEventListener('click', () => {
            // Switch to single line mode
            practiceMode = 'single';
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.mode-btn[data-mode="single"]').classList.add('active');
            
            const speaker = line.querySelector('.speaker-badge').textContent;
            const speakerClass = speaker.toLowerCase();
            practiceText = line.querySelector('.dialogue-text').textContent.trim();
            
            if (practiceTextEl) {
                practiceTextEl.innerHTML = `
                    <div class="dialogue-line" style="margin-bottom: 0;">
                        <span class="speaker-badge speaker-${speakerClass}">${speaker}</span>
                        <div class="dialogue-text">${practiceText}</div>
                    </div>
                `;
            }
            if (recordBtn) recordBtn.disabled = false;
            if (playOriginalBtn) playOriginalBtn.disabled = false;
            
            // Switch to practice tab
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="practice"]').classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('practiceTab').classList.add('active');
            
            showNotification('Click Record to practice pronunciation');
        });
    });
}

// Start full dialogue practice mode
function startFullDialoguePractice() {
    if (!currentEpisode || !currentEpisode.transcriptData) {
        showNotification('Please load an episode first');
        return;
    }
    
    const dialogues = currentEpisode.transcriptData;
    let fullDialogue = dialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');
    
    practiceText = fullDialogue;
    
    if (practiceTextEl) {
        let dialogueHTML = '<div class="full-dialogue">';
        dialogues.forEach(d => {
            const speakerClass = d.speaker.toLowerCase();
            dialogueHTML += `
                <div class="dialogue-line">
                    <span class="speaker-badge speaker-${speakerClass}">${d.speaker}</span>
                    <div class="dialogue-text">${d.text}</div>
                </div>
            `;
        });
        dialogueHTML += '</div>';
        practiceTextEl.innerHTML = dialogueHTML;
    }
    
    if (recordBtn) recordBtn.disabled = false;
    if (playOriginalBtn) playOriginalBtn.disabled = false;
    
    showNotification('Full dialogue loaded. Click Record when ready!');
}

// Start Role Play mode
function startRolePlay() {
    if (!currentEpisode || !currentEpisode.transcriptData) {
        showNotification('Please load an episode first');
        return;
    }
    
    rolePlayDialogues = currentEpisode.transcriptData;
    
    // Get unique speakers from dialogue
    const speakers = [...new Set(rolePlayDialogues.map(d => d.speaker))];
    
    if (speakers.length < 2) {
        showNotification('Need at least 2 speakers for role play');
        return;
    }
    
    // Update role selector with actual speakers
    const roleSelector = document.querySelector('.role-selector');
    if (roleSelector) {
        let html = '<div class="role-buttons">';
        speakers.forEach(speaker => {
            html += `<button class="role-btn" data-role="${speaker}">I am ${speaker}</button>`;
        });
        html += '</div>';
        roleSelector.innerHTML = html;
        
        // Re-attach event listeners
        document.querySelectorAll('.role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                rolePlayRole = btn.dataset.role;
                rolePlayCurrentIndex = 0;
                
                // Hide role selector after selection
                if (roleSelector) roleSelector.style.display = 'none';
                
                showNextRolePlayLine();
            });
        });
    }
}

function showNextRolePlayLine() {
    // Find next line for user's role
    while (rolePlayCurrentIndex < rolePlayDialogues.length) {
        const currentLine = rolePlayDialogues[rolePlayCurrentIndex];
        
        if (currentLine.speaker === rolePlayRole) {
            // This is user's turn
            practiceText = currentLine.text;
            
            if (practiceTextEl) {
                let contextHTML = '<div class="roleplay-context">';
                
                // Show previous line for context (if exists)
                if (rolePlayCurrentIndex > 0) {
                    const prevLine = rolePlayDialogues[rolePlayCurrentIndex - 1];
                    const prevSpeakerClass = prevLine.speaker.toLowerCase();
                    contextHTML += `
                        <div class="dialogue-line" style="opacity: 0.6; margin-bottom: 12px;">
                            <span class="speaker-badge speaker-${prevSpeakerClass}">${prevLine.speaker}</span>
                            <div class="dialogue-text">${prevLine.text}</div>
                        </div>
                    `;
                }
                
                // Show current line (user's turn)
                const currentSpeakerClass = currentLine.speaker.toLowerCase();
                contextHTML += `
                    <div class="dialogue-line" style="border: 2px solid var(--accent); box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);">
                        <span class="speaker-badge speaker-${currentSpeakerClass}">${currentLine.speaker}</span>
                        <div class="dialogue-text" style="font-weight: 500;">${currentLine.text}</div>
                    </div>
                `;
                contextHTML += '<p style="margin-top: 16px; text-align: center; color: var(--accent); font-weight: 600; font-size: 14px;">👆 Your turn - Click Record</p>';
                contextHTML += '</div>';
                
                practiceTextEl.innerHTML = contextHTML;
            }
            
            if (recordBtn) recordBtn.disabled = false;
            if (playOriginalBtn) playOriginalBtn.disabled = false;
            
            return;
        }
        
        rolePlayCurrentIndex++;
    }
    
    // End of dialogue
    if (practiceTextEl) {
        practiceTextEl.innerHTML = '<p style="color: #10b981; font-size: 18px;">🎉 Great job! You completed the role play!</p>';
    }
    if (recordBtn) recordBtn.disabled = true;
    if (playOriginalBtn) playOriginalBtn.disabled = true;
    showNotification('🎉 Role play completed!');
}

function speakOtherRoleAndContinue() {
    // Speak all lines until next user turn
    let speakQueue = [];
    let tempIndex = rolePlayCurrentIndex + 1;
    
    while (tempIndex < rolePlayDialogues.length) {
        const line = rolePlayDialogues[tempIndex];
        
        if (line.speaker === rolePlayRole) {
            // Found next user turn, stop here
            break;
        }
        
        speakQueue.push(line);
        tempIndex++;
    }
    
    // Speak all queued lines
    if (speakQueue.length > 0) {
        speakLinesSequentially(speakQueue, 0, () => {
            // After speaking, move to next user turn
            rolePlayCurrentIndex = tempIndex;
            showNextRolePlayLine();
        });
    } else {
        // No more lines, end
        rolePlayCurrentIndex = tempIndex;
        showNextRolePlayLine();
    }
}

function speakLinesSequentially(lines, index, callback) {
    if (index >= lines.length) {
        if (callback) callback();
        return;
    }
    
    const line = lines[index];
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    // Use UK female voice
    const ukVoice = getUKFemaleVoice();
    if (ukVoice) {
        utterance.voice = ukVoice;
    }
    
    utterance.onend = () => {
        setTimeout(() => {
            speakLinesSequentially(lines, index + 1, callback);
        }, 500); // Small pause between lines
    };
    
    window.speechSynthesis.speak(utterance);
}

// Record button handler
async function handleRecordClick() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Auto-detect best supported audio format
            let options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options.mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    options.mimeType = 'audio/ogg';
                } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                    options.mimeType = 'audio/wav';
                } else {
                    options = {}; // Let browser use default
                }
            }
            
            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                // Use the actual MIME type from MediaRecorder
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                recordedBlob = new Blob(audioChunks, { type: mimeType });
                if (playRecordingBtn) playRecordingBtn.disabled = false;
                
                // In role play mode, auto-continue after recording
                if (practiceMode === 'roleplay') {
                    setTimeout(() => {
                        speakOtherRoleAndContinue();
                    }, 500);
                } else {
                    // Recording saved successfully
                    if (recordingStatus) {
                        recordingStatus.innerHTML = '<span style="color: #10b981;">✓ Recording saved! Click Play to listen.</span>';
                        setTimeout(() => {
                            recordingStatus.innerHTML = '';
                        }, 3000);
                    }
                }
            };
            
            mediaRecorder.start();
            if (recordBtn) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                    <span>Stop</span>
                `;
            }
            if (recordingStatus) {
                recordingStatus.innerHTML = '<span style="color: #ef4444;">● Recording...</span>';
            }
            showNotification('Recording... Click Stop when done');
        } catch (err) {
            showNotification('❌ Microphone access denied. Please allow microphone permissions.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        if (recordBtn) {
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span>Record</span>
            `;
        }
        if (recordingStatus) {
            recordingStatus.innerHTML = '';
        }
    }
}

// Pronunciation scoring feature removed - not necessary

// Prevent page from pausing audio when screen turns off or tab goes to background
document.addEventListener('visibilitychange', () => {
    // Don't do anything - let audio continue playing in background
    // This is important for mobile background playback
});

// Mini Player Logic
const miniPlayer = document.getElementById('miniPlayer');
const miniPlayBtn = document.getElementById('miniPlayBtn');
const miniExpandBtn = document.getElementById('miniExpandBtn');

function updateMiniPlayer() {
    if (!currentEpisode) return;
    
    document.getElementById('miniEpisodeNumber').textContent = `#${currentEpisode.id}`;
    document.getElementById('miniEpisodeTitle').textContent = currentEpisode.title;
    document.getElementById('miniEpisodeLevel').textContent = currentEpisode.level;
}

function updateMiniPlayerState() {
    const playIcon = miniPlayBtn.querySelector('.mini-play-icon');
    const pauseIcon = miniPlayBtn.querySelector('.mini-pause-icon');
    
    if (audioPlayer.paused) {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    } else {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    }
}

// Show mini player when scrolling down and episode is playing
let lastScrollY = 0;
let scrollTimeout;

window.addEventListener('scroll', () => {
    if (!currentEpisode || !audioPlayer.src) return;
    
    // Throttle scroll event for better performance
    if (scrollTimeout) return;
    
    scrollTimeout = setTimeout(() => {
        const currentScrollY = window.scrollY;
        const episodeDetailVisible = episodeDetail.style.display !== 'none';
        
        // Show mini player when scrolled down and episode detail is visible
        if (currentScrollY > 300 && episodeDetailVisible) {
            miniPlayer.classList.add('show');
            miniPlayer.style.display = 'flex';
        } else {
            miniPlayer.classList.remove('show');
        }
        
        lastScrollY = currentScrollY;
        scrollTimeout = null;
    }, 100); // Throttle to 100ms
}, { passive: true });

// Mini player play/pause button
miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => {});
    } else {
        audioPlayer.pause();
    }
});

// Mini player expand button - scroll back to episode detail
miniExpandBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    window.scrollTo({ top: 0, behavior: 'smooth' });
    miniPlayer.classList.remove('show');
});

// Mini player info click - also expand
miniPlayer.querySelector('.mini-player-info').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    miniPlayer.classList.remove('show');
});

// Update mini player when audio state changes
audioPlayer.addEventListener('play', updateMiniPlayerState);
audioPlayer.addEventListener('pause', updateMiniPlayerState);

// Handle orientation changes smoothly
window.addEventListener('orientationchange', () => {
    // Recalculate mini player visibility after orientation change
    setTimeout(() => {
        if (currentEpisode && audioPlayer.src) {
            const currentScrollY = window.scrollY;
            const episodeDetailVisible = episodeDetail.style.display !== 'none';
            if (currentScrollY > 300 && episodeDetailVisible) {
                miniPlayer.classList.add('show');
                miniPlayer.style.display = 'flex';
            }
        }
    }, 300);
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Space: Play/Pause
    if (e.code === 'Space') {
        e.preventDefault();
        if (episodeDetail.style.display !== 'none' && audioPlayer.src) {
            if (audioPlayer.paused) {
                audioPlayer.play().catch(() => {});
            } else {
                audioPlayer.pause();
            }
        }
    }
    
    // Left Arrow: Seek backward 10s
    if (e.code === 'ArrowLeft' && audioPlayer.src) {
        e.preventDefault();
        audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
        showNotification('⏪ -10s');
    }
    
    // Right Arrow: Seek forward 10s
    if (e.code === 'ArrowRight' && audioPlayer.src) {
        e.preventDefault();
        audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
        showNotification('⏩ +10s');
    }
    
    // Up Arrow: Volume up
    if (e.code === 'ArrowUp' && audioPlayer.src) {
        e.preventDefault();
        audioPlayer.volume = Math.min(1, audioPlayer.volume + 0.1);
        audioPlayer.muted = false;
        const volumeBtn = document.getElementById('volumeBtn');
        if (volumeBtn) volumeBtn.style.opacity = '1';
        showNotification(`🔊 ${Math.round(audioPlayer.volume * 100)}%`);
    }
    
    // Down Arrow: Volume down
    if (e.code === 'ArrowDown' && audioPlayer.src) {
        e.preventDefault();
        audioPlayer.volume = Math.max(0, audioPlayer.volume - 0.1);
        showNotification(`🔉 ${Math.round(audioPlayer.volume * 100)}%`);
    }
    
    // N: Next Episode
    if ((e.key === 'n' || e.key === 'N') && currentEpisode) {
        e.preventDefault();
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.click();
    }
    
    // P: Previous Episode
    if ((e.key === 'p' || e.key === 'P') && currentEpisode) {
        e.preventDefault();
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) prevBtn.click();
    }
    
    // L: Toggle Loop/Repeat
    if ((e.key === 'l' || e.key === 'L') && currentEpisode && audioPlayer.src) {
        e.preventDefault();
        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn) repeatBtn.click();
    }
    
    // Escape: Close episode detail
    if (e.code === 'Escape' && episodeDetail.style.display !== 'none') {
        e.preventDefault();
        const closeBtn = document.getElementById('closeBtn');
        if (closeBtn) closeBtn.click();
    }
});

// Translation cache to avoid repeated API calls


