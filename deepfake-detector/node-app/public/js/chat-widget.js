import { apiCall } from './api.js';

let currentSessionId = null;

export function renderChatWidget() {
  const shell = `
    <!-- Bubble -->
    <button id="chat-bubble-trigger" class="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 shadow-xl shadow-cyan-500/20 hover:border-cyan-500 flex items-center justify-center transition-all z-50">
      <svg class="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
    </button>

    <!-- Panel -->
    <div id="chat-panel" class="fixed bottom-6 right-6 w-[400px] h-[600px] max-h-[80vh] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-lg shadow-2xl flex-col hidden z-50 transform translate-y-4 opacity-0 transition-all duration-300">
      <!-- Header -->
      <div class="p-4 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <div class="font-mono uppercase tracking-widest text-xs text-zinc-500">HELP ASSISTANT</div>
          <div class="text-zinc-50 text-sm">Ask anything about your analyses</div>
        </div>
        <button id="close-chat-panel" class="text-zinc-400 hover:text-zinc-50">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Messages -->
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm pb-10">
        <div class="bg-zinc-800 text-zinc-100 rounded-lg px-4 py-2 max-w-[85%]">
          Hello! I'm your deepfake detection assistant. How can I help you interpret your results?
        </div>
      </div>

      <!-- Input Mode -->
      <div class="p-4 border-t border-zinc-800 bg-zinc-900 flex flex-col gap-2 rounded-b-lg shrink-0">
        <div class="flex gap-2">
            <textarea id="chat-input" rows="1" class="flex-1 resize-none bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-zinc-50 focus:outline-none focus:border-cyan-500 font-sans" placeholder="Type a message..."></textarea>
            <button id="chat-send" class="w-10 h-10 rounded-md bg-zinc-800 text-zinc-400 flex items-center justify-center transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
        </div>
        <div class="text-[10px] uppercase font-mono tracking-widest text-zinc-600 text-center">
          Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', shell);
  setupChatHandlers();
}

function setupChatHandlers() {
  const trigger = document.getElementById('chat-bubble-trigger');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('close-chat-panel');
  const navTrigger = document.getElementById('open-chat-btn');
  const sendBtn = document.getElementById('chat-send');
  const inputEl = document.getElementById('chat-input');
  const msgContainer = document.getElementById('chat-messages');

  const openPanel = () => {
    panel.classList.remove('hidden');
    trigger.classList.add('hidden');
    // slight delay for animation
    setTimeout(() => {
      panel.classList.remove('translate-y-4', 'opacity-0');
      inputEl.focus();
    }, 10);
  };

  const closePanel = () => {
    panel.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => {
      panel.classList.add('hidden');
      trigger.classList.remove('hidden');
    }, 300);
  };

  trigger?.addEventListener('click', openPanel);
  navTrigger?.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanel);

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = (Math.min(inputEl.scrollHeight, 120)) + 'px';
    if (inputEl.value.trim()) {
      sendBtn.classList.remove('bg-zinc-800', 'text-zinc-400');
      sendBtn.classList.add('bg-cyan-500', 'text-zinc-950');
    } else {
      sendBtn.classList.remove('bg-cyan-500', 'text-zinc-950');
      sendBtn.classList.add('bg-zinc-800', 'text-zinc-400');
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    
    // reset input
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.classList.remove('bg-cyan-500', 'text-zinc-950');
    sendBtn.classList.add('bg-zinc-800', 'text-zinc-400');

    // add to ui
    appendUserMsg(text);
    
    const loadingId = appendTypingIndicator();
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const res = await apiCall('/help/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, sessionId: currentSessionId })
      });
      document.getElementById(loadingId)?.remove();
      currentSessionId = res.sessionId;
      appendModelMsg(res.reply);
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      appendModelMsg(`*Error: ${err.message}. Please try again later.*`);
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function appendUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'bg-cyan-500 text-zinc-950 self-end rounded-lg px-4 py-2 max-w-[80%] ml-auto font-inter';
    div.innerText = text;
    msgContainer.appendChild(div);
  }

  function appendModelMsg(text) {
    const div = document.createElement('div');
    div.className = 'bg-zinc-800 text-zinc-100 rounded-lg px-4 py-2 max-w-[85%] markdown-body font-inter';
    if (window.marked) {
        div.innerHTML = window.marked.parse(text);
    } else {
        div.innerText = text;
    }
    // simple style to code blocks
    div.querySelectorAll('code').forEach(c => {
        c.classList.add('bg-zinc-950', 'text-cyan-400', 'px-1', 'py-0.5', 'rounded', 'font-mono');
    });
    msgContainer.appendChild(div);
  }

  function appendTypingIndicator() {
    const loadingId = 'loading-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.id = loadingId;
    div.className = 'bg-zinc-800 text-zinc-400 rounded-lg px-4 py-2 max-w-[50%] flex space-x-2 items-center h-10 w-16';
    div.innerHTML = `
      <div class="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
      <div class="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
      <div class="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
    `;
    msgContainer.appendChild(div);
    return loadingId;
  }
}
