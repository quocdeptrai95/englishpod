// Learning Progress & Favorites Management

// Favorites System
const FAVORITES_KEY = 'favorites';

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
        return [];
    }
}

function toggleFavorite(episodeId) {
    let favorites = getFavorites();
    const index = favorites.indexOf(episodeId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showNotification('💔 Removed from favorites');
    } else {
        favorites.push(episodeId);
        showNotification('⭐ Added to favorites');
    }
    
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    saveUserData(); // Sync to Firebase
    updateFavoritesUI();
    return favorites.includes(episodeId);
}

function isFavorite(episodeId) {
    return getFavorites().includes(episodeId);
}

// Progress Tracking System
const COMPLETED_KEY = 'completed';
const PROGRESS_KEY = 'progress';

function getCompleted() {
    try {
        return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]');
    } catch {
        return [];
    }
}

function getProgress() {
    try {
        return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    } catch {
        return {};
    }
}

function markAsCompleted(episodeId) {
    let completed = getCompleted();
    if (!completed.includes(episodeId)) {
        completed.push(episodeId);
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
        saveUserData();
        showNotification('✅ Episode completed!');
        updateProgressUI();
    }
}

function isCompleted(episodeId) {
    return getCompleted().includes(episodeId);
}

function saveProgress(episodeId, currentTime, duration) {
    const progress = getProgress();
    progress[episodeId] = {
        currentTime,
        duration,
        percentage: Math.round((currentTime / duration) * 100),
        lastPlayed: Date.now()
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    saveUserData();
}

function getEpisodeProgress(episodeId) {
    const progress = getProgress();
    return progress[episodeId] || null;
}

function updateProgressUI() {
    const completed = getCompleted();
    const totalEpisodes = episodes.length;
    const percentage = Math.round((completed.length / totalEpisodes) * 100);
    
    const progressContainer = document.getElementById('overallProgress');
    if (progressContainer) {
        progressContainer.innerHTML = `
            <div class="progress-stats">
                <div class="progress-header">
                    <h3>Your Learning Progress</h3>
                    <span class="progress-percentage">${percentage}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-text">
                    ${completed.length} of ${totalEpisodes} episodes completed
                </div>
            </div>
        `;
    }
    
    updateContinueLearning();
}

function updateContinueLearning() {
    const progress = getProgress();
    const completed = getCompleted();
    
    // Find last unfinished episode with progress
    let continueEpisode = null;
    let lastTime = 0;
    
    for (const [episodeId, data] of Object.entries(progress)) {
        if (!completed.includes(episodeId) && data.percentage < 95 && data.lastPlayed > lastTime) {
            continueEpisode = {
                id: episodeId,
                ...data,
                episode: episodes.find(ep => ep.id === episodeId)
            };
            lastTime = data.lastPlayed;
        }
    }
    
    const continueSection = document.getElementById('continueSection');
    if (continueEpisode && continueEpisode.episode) {
        continueSection.style.display = 'block';
        continueSection.innerHTML = `
            <div class="continue-card">
                <div class="continue-header">
                    <h3>📚 Continue Learning</h3>
                </div>
                <div class="continue-episode" data-episode-id="${continueEpisode.id}">
                    <div class="continue-info">
                        <div class="continue-number">#${continueEpisode.id}</div>
                        <div class="continue-details">
                            <div class="continue-title">${continueEpisode.episode.title}</div>
                            <div class="continue-level">${continueEpisode.episode.level}</div>
                        </div>
                    </div>
                    <div class="continue-progress-info">
                        <div class="continue-progress-bar">
                            <div class="continue-progress-fill" style="width: ${continueEpisode.percentage}%"></div>
                        </div>
                        <span class="continue-percentage">${continueEpisode.percentage}% complete</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add click handler
        continueSection.querySelector('.continue-episode').addEventListener('click', async () => {
            await openEpisode(continueEpisode.id);
            // Seek to last position
            setTimeout(() => {
                if (audioPlayer) {
                    audioPlayer.currentTime = continueEpisode.currentTime;
                }
            }, 500);
        });
    } else {
        continueSection.style.display = 'none';
    }
}

function updateFavoritesUI() {
    const favorites = getFavorites();
    const favSection = document.getElementById('favoritesSection');
    
    if (favorites.length === 0) {
        favSection.style.display = 'none';
        return;
    }
    
    favSection.style.display = 'block';
    const grid = favSection.querySelector('.favorites-grid');
    
    grid.innerHTML = favorites.map(id => {
        const ep = episodes.find(e => e.id === id);
        if (!ep) return '';
        
        return `
            <div class="episode-card" data-episode-id="${ep.id}">
                <div class="episode-header">
                    <span class="episode-number">#${ep.id}</span>
                    <span class="episode-level ${ep.level.toLowerCase()}">${ep.level}</span>
                </div>
                <h3 class="episode-title">${ep.title}</h3>
                ${isCompleted(ep.id) ? '<div class="completed-badge">✓ Completed</div>' : ''}
            </div>
        `;
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.episode-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.episodeId;
            openEpisode(id);
        });
    });
}

// Auto-save progress during playback
let progressSaveInterval;

function startProgressTracking(episodeId) {
    stopProgressTracking();
    
    progressSaveInterval = setInterval(() => {
        if (audioPlayer && !audioPlayer.paused && audioPlayer.duration > 0) {
            saveProgress(episodeId, audioPlayer.currentTime, audioPlayer.duration);
            
            // Auto-mark as completed at 95%
            const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            if (percentage >= 95 && !isCompleted(episodeId)) {
                markAsCompleted(episodeId);
            }
        }
    }, 5000); // Save every 5 seconds
}

function stopProgressTracking() {
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        progressSaveInterval = null;
    }
}
