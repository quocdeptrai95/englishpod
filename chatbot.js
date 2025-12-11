// Google Gemini AI Assistant Integration (FREE!)
// Get your FREE API key here: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyBI1M-kBo4PowREUbykEE7JkMHz8XLbCVA';

let chatHistory = [];
let isChatOpen = false;

// Create chat widget
function createChatWidget() {
    const chatWidget = document.createElement('div');
    chatWidget.id = 'chat-widget';
    chatWidget.innerHTML = `
        <!-- Chat Button -->
        <button id="chat-toggle-btn" class="chat-toggle-btn" aria-label="Open AI Assistant">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        </button>

        <!-- Chat Window -->
        <div id="chat-window" class="chat-window" style="display: none;">
            <div class="chat-header">
                <div class="chat-title">
                    <span>English Learning Assistant</span>
                </div>
                <button id="chat-close-btn" class="chat-close-btn" aria-label="Close chat">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div id="chat-messages" class="chat-messages">
                <div class="chat-message assistant">
                    <div class="message-content">
                        👋 Hi! I'm your English learning assistant. Ask me anything:
                        <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">
                            <li>Word meanings & translations</li>
                            <li>Grammar explanations</li>
                            <li>Practice conversations</li>
                            <li>Episode content help</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="chat-input-container">
                <input 
                    type="text" 
                    id="chat-input" 
                    class="chat-input" 
                    placeholder="Ask me anything..." 
                    autocomplete="off"
                />
                <button id="chat-send-btn" class="chat-send-btn" aria-label="Send message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>

            <div class="chat-footer">
                Powered by Google Gemini
            </div>
        </div>
    `;
    document.body.appendChild(chatWidget);

    // Event listeners
    document.getElementById('chat-toggle-btn').addEventListener('click', toggleChat);
    document.getElementById('chat-close-btn').addEventListener('click', toggleChat);
    document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function toggleChat() {
    isChatOpen = !isChatOpen;
    const chatWindow = document.getElementById('chat-window');
    const chatBtn = document.getElementById('chat-toggle-btn');
    
    if (isChatOpen) {
        chatWindow.style.display = 'flex';
        chatBtn.style.display = 'none';
        document.getElementById('chat-input').focus();
    } else {
        chatWindow.style.display = 'none';
        chatBtn.style.display = 'flex';
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!GEMINI_API_KEY) {
        addMessage('⚠️ Vui lòng thêm Gemini API key (FREE) vào chatbot.js\n\nLấy key tại: https://aistudio.google.com/app/apikey', 'assistant', true);
        return;
    }

    // Add user message
    addMessage(message, 'user');
    input.value = '';

    // Add to history
    chatHistory.push({ role: 'user', content: message });

    // Show typing indicator
    const typingId = addTypingIndicator();

    try {
        // Build context from current episode
        const context = buildContext();
        
        // Build conversation history for Gemini
        const conversationText = chatHistory.map(msg => 
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');

        const systemPrompt = `You are a friendly English learning assistant. Help users learn English through the EnglishPod lessons. ${context} Answer in Vietnamese when explaining, but provide English examples. Be concise and helpful.`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\nConversation:\n${conversationText}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });

        removeTypingIndicator(typingId);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const reply = data.candidates[0].content.parts[0].text;

        // Add to history
        chatHistory.push({ role: 'assistant', content: reply });

        // Add assistant message
        addMessage(reply, 'assistant');

    } catch (error) {
        removeTypingIndicator(typingId);
        console.error('Gemini error:', error);
        addMessage('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.\n\n' + error.message, 'assistant', true);
    }
}

function buildContext() {
    if (window.currentEpisode) {
        const vocab = window.currentEpisode.vocabData;
        let context = `Current episode: "${window.currentEpisode.title}" (${window.currentEpisode.level}). `;
        
        if (vocab && vocab.key && vocab.key.length > 0) {
            const words = vocab.key.slice(0, 5).map(v => v.word).join(', ');
            context += `Key vocabulary: ${words}. `;
        }
        
        return context;
    }
    return '';
}

function addMessage(text, role, isError = false) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role} ${isError ? 'error' : ''}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    const id = 'typing-' + Date.now();
    typingDiv.id = id;
    typingDiv.className = 'chat-message assistant typing';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) indicator.remove();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createChatWidget);
} else {
    createChatWidget();
}
