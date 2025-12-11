let currentFilter = 'all';
let displayedCount = 30;
const LOAD_MORE_COUNT = 30;

// Chunk loading system
const loadedChunks = new Set();
const episodesData = new Map(); // id -> full episode data

// Load a chunk file
async function loadChunk(chunkNumber) {
    if (loadedChunks.has(chunkNumber)) return;
    
    return new Promise((resolve, reject) => {
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
    const episodeIndex = episodesIndex.find(ep => ep.id === id);
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        renderEpisodes();
        // Preload first 2 chunks for faster access to first 100 episodes
        loadChunk(1).catch(() => {});
        setTimeout(() => loadChunk(2).catch(() => {}), 500);
    });
} else {
    renderEpisodes();
    // Preload first 2 chunks for faster access to first 100 episodes
    loadChunk(1).catch(() => {});
    setTimeout(() => loadChunk(2).catch(() => {}), 500);
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.level;
        renderEpisodes();
    });
});

// Close button
closeBtn.addEventListener('click', () => {
    episodeDetail.style.display = 'none';
    episodesGrid.style.display = 'grid';
    audioPlayer.pause();
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
    const filtered = currentFilter === 'all' 
        ? episodesIndex 
        : episodesIndex.filter(ep => ep.level === currentFilter);

    // Reset displayed count if not appending
    if (!append) {
        displayedCount = 30;
        // Show skeleton loading
        episodesGrid.innerHTML = Array(12).fill(0).map(() => `
            <div class="skeleton skeleton-card">
                <div class="skeleton-text short"></div>
                <div class="skeleton-text long"></div>
                <div class="skeleton-text short"></div>
            </div>
        `).join('');
    }

    // Render actual content with slight delay for smooth transition
    requestAnimationFrame(() => {
        setTimeout(() => {
            const fragment = document.createDocumentFragment();
            const toDisplay = filtered.slice(0, displayedCount);
            
            toDisplay.forEach((ep, index) => {
                const card = document.createElement('div');
                card.className = 'episode-card';
                card.dataset.id = ep.id;
                card.style.opacity = '0';
                card.style.animation = `fadeIn 0.3s ease-out ${append ? 0 : index * 20}ms forwards`;
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
        }, append ? 0 : 100);
    });
}

let currentEpisode = null;

function playEpisode(episode) {
    currentEpisode = episode;
    
    detailTitle.textContent = episode.title;
    detailLevel.textContent = episode.level;
    
    // Show episode detail immediately
    episodesGrid.style.display = 'none';
    episodeDetail.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Reset audio player and start loading
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.src = episode.mp3;
    audioPlayer.preload = 'metadata'; // Preload metadata for faster start
    
    // Show loading notification
    showNotification('⏳ Loading audio...');
    
    // Setup Media Session API for background playback
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: episode.title,
            artist: 'English',
            album: episode.level,
            artwork: [
                { src: 'https://via.placeholder.com/96', sizes: '96x96', type: 'image/png' },
                { src: 'https://via.placeholder.com/128', sizes: '128x128', type: 'image/png' },
                { src: 'https://via.placeholder.com/192', sizes: '192x192', type: 'image/png' },
                { src: 'https://via.placeholder.com/256', sizes: '256x256', type: 'image/png' },
                { src: 'https://via.placeholder.com/384', sizes: '384x384', type: 'image/png' },
                { src: 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/png' }
            ]
        });

        // Set up action handlers for background controls
        navigator.mediaSession.setActionHandler('play', () => audioPlayer.play());
        navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            const currentIndex = episodes.findIndex(ep => ep.id === currentEpisode.id);
            if (currentIndex > 0) {
                playEpisode(episodes[currentIndex - 1]);
            }
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            const currentIndex = episodes.findIndex(ep => ep.id === currentEpisode.id);
            if (currentIndex < episodes.length - 1) {
                playEpisode(episodes[currentIndex + 1]);
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

function setupCustomPlayer() {
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
    };
    
    // Audio loading events
    audioPlayer.addEventListener('loadstart', showLoading);
    
    audioPlayer.addEventListener('canplay', () => {
        hideLoading();
        if (audioPlayer.paused) {
            playBtn.querySelector('.play-icon').style.display = 'block';
        } else {
            playBtn.querySelector('.pause-icon').style.display = 'block';
        }
        showNotification('✅ Audio ready!');
    });
    
    audioPlayer.addEventListener('error', () => {
        hideLoading();
        showNotification('❌ Failed to load audio');
    });
    
    audioPlayer.addEventListener('waiting', showLoading);
    audioPlayer.addEventListener('playing', hideLoading);
    
    // Play/Pause
    playBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play().catch(err => {
                // Silent fail
                hideLoading();
            });
        } else {
            audioPlayer.pause();
        }
    });
    
    audioPlayer.addEventListener('play', () => {
        playBtn.querySelector('.play-icon').style.display = 'none';
        playBtn.querySelector('.pause-icon').style.display = 'block';
    });
    
    audioPlayer.addEventListener('pause', () => {
        playBtn.querySelector('.play-icon').style.display = 'block';
        playBtn.querySelector('.pause-icon').style.display = 'none';
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
    
    // Progress bar click
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
    
    // Speed control
    speedBtn.addEventListener('click', () => {
        currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
        audioPlayer.playbackRate = speeds[currentSpeedIndex];
        speedBtn.textContent = speeds[currentSpeedIndex] + 'x';
    });
    
    // Volume control
    volumeBtn.addEventListener('click', () => {
        audioPlayer.muted = !audioPlayer.muted;
        volumeBtn.style.opacity = audioPlayer.muted ? '0.5' : '1';
    });
    
    // Previous/Next (placeholder - implement episode navigation)
    prevBtn.addEventListener('click', () => {
        audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
    });
    
    nextBtn.addEventListener('click', () => {
        audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
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
                        <button class="practice-vocab-btn" onclick="practiceVocabWord('${item.word.replace(/'/g, "\\'")}')"
                                title="Practice pronunciation" aria-label="Practice ${item.word}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
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
                        <button class="practice-vocab-btn" onclick="practiceVocabWord('${item.word.replace(/'/g, "\\'")}')"
                                title="Practice pronunciation" aria-label="Practice ${item.word}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
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

// Text-to-Speech for vocabulary pronunciation (UK accent)
function speakWord(word) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-GB'; // UK English
        utterance.rate = 0.8; // Slightly slower for clarity
        utterance.pitch = 1;
        
        // Try to find UK English voice
        const voices = window.speechSynthesis.getVoices();
        const ukVoice = voices.find(voice => 
            voice.lang === 'en-GB' || voice.lang.startsWith('en-GB')
        );
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

// Initialize Speech Recognition for pronunciation scoring
let recognition = null;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
} else if ('SpeechRecognition' in window) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

// Initialize practice controls after DOM loads
function initializePracticeControls() {
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
    
    // Play original audio
    playOriginalBtn.addEventListener('click', () => {
        if (!practiceText) return;
        const utterance = new SpeechSynthesisUtterance(practiceText);
        utterance.lang = 'en-GB';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    });
    
    // Play recorded audio
    playRecordingBtn.addEventListener('click', () => {
        if (recordedBlob) {
            playRecordingBtn.disabled = true;
            playRecordingBtn.textContent = 'Playing...';
            
            const audioUrl = URL.createObjectURL(recordedBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                playRecordingBtn.disabled = false;
                playRecordingBtn.textContent = '▶ Play My Recording';
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                playRecordingBtn.disabled = false;
                playRecordingBtn.textContent = '▶ Play My Recording';
                showNotification('❌ Cannot play recording');
            };
            
            audio.play().catch(err => {
                URL.revokeObjectURL(audioUrl);
                playRecordingBtn.disabled = false;
                playRecordingBtn.textContent = '▶ Play My Recording';
                showNotification('❌ Cannot play recording');
            });
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
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
                if (playRecordingBtn) playRecordingBtn.disabled = false;
                
                // In role play mode, auto-continue after recording (no scoring)
                if (practiceMode === 'roleplay') {
                    setTimeout(() => {
                        speakOtherRoleAndContinue();
                    }, 500);
                } else {
                    // Analyze pronunciation for single/dialogue mode
                    await analyzePronunciation();
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

// Analyze pronunciation using Speech Recognition
async function analyzePronunciation() {
    if (!recognition) {
        showNotification('Speech recognition not supported');
        return;
    }
    
    if (recordingStatus) {
        recordingStatus.innerHTML = '<span style="color: #fbbf24;">Analyzing pronunciation...</span>';
    }
    
    // Play the recorded audio and recognize it
    const audioUrl = URL.createObjectURL(recordedBlob);
    const audio = new Audio(audioUrl);
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        const expected = practiceText.toLowerCase().trim();
        
        // Calculate similarity score
        const score = calculateSimilarity(expected, transcript);
        
        // Display score
        if (pronunciationScore) pronunciationScore.style.display = 'block';
        if (scoreValue) scoreValue.textContent = score;
        
        let feedback = '';
        let color = '';
        if (score >= 90) {
            feedback = 'Excellent! Perfect pronunciation! 🎉';
            color = '#10b981';
        } else if (score >= 75) {
            feedback = 'Great job! Keep practicing! 👍';
            color = '#3b82f6';
        } else if (score >= 60) {
            feedback = 'Good effort! Try again for better clarity. 💪';
            color = '#fbbf24';
        } else {
            feedback = 'Keep practicing! Focus on clarity. 📚';
            color = '#ef4444';
        }
        
        if (scoreFeedback) {
            scoreFeedback.innerHTML = `
                <div style="color: ${color}; margin-bottom: 10px;">${feedback}</div>
                <div style="font-size: 13px; opacity: 0.8;">
                    <strong>You said:</strong> "${transcript}"<br>
                    <strong>Expected:</strong> "${practiceText}"
                </div>
            `;
        }
        
        if (recordingStatus) recordingStatus.innerHTML = '';
    };
    
    recognition.onerror = () => {
        if (recordingStatus) {
            recordingStatus.innerHTML = '<span style="color: #ef4444;">Could not analyze. Please try again.</span>';
        }
    };
    
    audio.play();
    recognition.start();
}

// Calculate text similarity (Levenshtein distance based)
function calculateSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return Math.round((1 - editDistance / longer.length) * 100);
}

function levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}
