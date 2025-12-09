// Элементы DOM
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const chatInterface = document.getElementById('chatInterface');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const resetButton = document.getElementById('resetButton');
const backButton = document.getElementById('backButton');
const modalOverlay = document.getElementById('modalOverlay');
const cancelButton = document.getElementById('cancelButton');
const confirmButton = document.getElementById('confirmButton');
const messageCount = document.getElementById('messageCount');
const aiStatus = document.getElementById('aiStatus');
const scrollIndicator = document.getElementById('scrollIndicator');

const MAX_VISIBLE_MESSAGES = 100;
const API_ENDPOINTS = {
    CHAT: '/chat',
    HISTORY: '/api/history',
    CLEAR: '/api/clear'
};

let messages = [];
let isScrolledToBottom = true;
let isLoading = false;

// Загрузка истории с сервера Flask
async function loadMessagesFromServer() {
    try {
        showLoading(true);
        const response = await fetch(API_ENDPOINTS.HISTORY);
        const data = await response.json();
        
        if (data.success) {
            messages = data.messages || [];
            return messages;
        } else {
            console.error('Ошибка загрузки истории:', data.error);
            return [];
        }

    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        return [];
    } finally {
        showLoading(false);
    }
}

function showLoading(isLoading) {
    if (isLoading) {
        aiStatus.innerHTML = '<span class="ai-loading"></span> Загрузка...';
        aiStatus.style.color = '#ffb347';
    }
}

function updateAIStatus(status) {
    aiStatus.textContent = status;
    aiStatus.style.color = status === 'Подключен' ? '#2dd4bf' : 
                          status === 'Генерация...' ? '#ffb347' : 
                          '#ff6b6b';
}

// Отправка сообщения ИИ через Flask API
async function sendMessageToAI(userMessage) {
    
    try {
        isLoading = true;
        updateAIStatus('Генерация...');
        
        const response = await fetch(API_ENDPOINTS.CHAT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage })
        });

        const data = await response.json();
        isLoading = false;
        
        if (data.success) {
            updateAIStatus('Подключен');
            return data.reply;
        } else {
            updateAIStatus('Ошибка');
            return `Ошибка: ${data.error}`;
        }
    } catch (error) {
        console.error('Ошибка при запросе к ИИ:', error);
        isLoading = false;
        updateAIStatus('Ошибка');
        return 'Извините, произошла ошибка при обращении к ИИ. Попробуйте еще раз.';
    }
}

// Инициализация при загрузке страницы
async function init() {
    try {
        // Загружаем историю с сервера
        messages = await loadMessagesFromServer();
        
        if (messages && messages.length > 0) {
            // Если есть сохраненные сообщения, показываем чат
            showChatInterface();
            displayMessages();
            updateStats();
        } else {
            // Если нет сохраненных сообщений, показываем начальный экран
            showStartScreen();
        }
        
        // Добавляем обработчик прокрутки
        chatMessages.addEventListener('scroll', handleScroll);
        
        // Обновляем статус ИИ
        updateAIStatus('Подключен');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showStartScreen();
        updateAIStatus('Ошибка подключения');
    }
}

// Показать начальный экран
function showStartScreen() {
    startScreen.style.display = 'flex';
    chatInterface.style.display = 'none';
    chatInput.blur();
}

// Показать интерфейс чата
function showChatInterface() {
    startScreen.style.display = 'none';
    chatInterface.style.display = 'flex';
    setTimeout(() => chatInput.focus(), 100);
}

// Функция обновления статистики
function updateStats() {
    const count = messages.length;
    messageCount.textContent = count;
}

function adjustMessageFontSize(messageElement, text) {
    // Удаляем предыдущие классы размера
    messageElement.classList.remove(
        'long-text',
        'data-char-count-high',
        'data-char-count-very-high',
        'data-char-count-extreme',
        'data-char-count-super-extreme'
    );
    
    // Удаляем старые data-атрибуты
    messageElement.removeAttribute('data-char-count');
    
    // Подсчитываем количество символов (без пробелов)
    const charCount = text.replace(/\s/g, '').length;
    
    // Устанавливаем классы в зависимости от длины текста
    if (charCount > 300) {
        messageElement.classList.add('long-text');
        messageElement.setAttribute('data-char-count', 'super-extreme');
    } else if (charCount > 200) {
        messageElement.classList.add('long-text');
        messageElement.setAttribute('data-char-count', 'extreme');
    } else if (charCount > 150) {
        messageElement.setAttribute('data-char-count', 'very-high');
    } else if (charCount > 100) {
        messageElement.setAttribute('data-char-count', 'high');
    }
    
    // Дополнительная проверка: если текст не помещается, динамически уменьшаем шрифт
    setTimeout(() => {
        ensureTextFits(messageElement);
    }, 10);
}

// Функция для гарантии, что текст помещается в сообщение
function ensureTextFits(messageElement) {
    const content = messageElement.querySelector('.message-content');
    if (!content) return;
    
    const messageRect = messageElement.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const scrollHeight = content.scrollHeight;
    const clientHeight = messageElement.clientHeight;
    
    // Если текст выходит за границы сообщения
    if (scrollHeight > clientHeight * 1.1) { // 10% допуск
        let currentSize = parseFloat(getComputedStyle(content).fontSize);
        
        // Постепенно уменьшаем шрифт, пока текст не поместится
        while (scrollHeight > clientHeight * 1.1 && currentSize > 12) {
            currentSize -= 0.5;
            content.style.fontSize = `${currentSize}px`;
            
            // Пересчитываем после изменения размера
            const newScrollHeight = content.scrollHeight;
            if (newScrollHeight <= clientHeight * 1.1) {
                break;
            }
        }
        
        // Добавляем индикатор длинного сообщения
        if (!messageElement.querySelector('.long-text-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'long-text-indicator';
            indicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
            indicator.style.cssText = `
                position: absolute;
                bottom: 5px;
                right: 10px;
                color: rgba(255,255,255,0.5);
                font-size: 12px;
                opacity: 0.7;
            `;
            messageElement.style.position = 'relative';
            messageElement.appendChild(indicator);
        }
    }
}

function displayMessages() {
    chatMessages.innerHTML = '';
    
    if (messages.length === 0) {
        // Показываем приветственное сообщение
        const welcomeMessage = document.createElement('div');
        welcomeMessage.classList.add('message', 'assistant', 'new-message');
        welcomeMessage.innerHTML = `
            <div class="message-content">
                В начале было слово. Сегодня это слово — ваше. Я лишь эхо, которое превратит его в легенду. Говорите — и мир ответит!
            </div>
        `;
        chatMessages.appendChild(welcomeMessage);
        adjustMessageFontSize(welcomeMessage, welcomeMessage.textContent);
    } else {
        // Отображаем сообщения
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const messageElement = document.createElement('div');
            
            messageElement.classList.add('message', message.sender, 'new-message');
            
            const contentDiv = document.createElement('div');
            contentDiv.classList.add('message-content');
            contentDiv.textContent = message.text;

            messageElement.appendChild(contentDiv);
            chatMessages.appendChild(messageElement);
            adjustMessageFontSize(messageElement, message.text);
        }
    }
    
    // Прокручиваем к последнему сообщению
    if (isScrolledToBottom) {
        scrollToBottom();
    }
    
    updateStats();
    updateScrollIndicator();
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const messageElements = document.querySelectorAll('.message');
        messageElements.forEach(element => {
            const content = element.querySelector('.message-content');
            if (content) {
                ensureTextFits(element);
            }
        });
    }, 250);
});

// Прокрутка к последнему сообщению
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    isScrolledToBottom = true;
    updateScrollIndicator();
}

// Обработчик события прокрутки
function handleScroll() {
    const threshold = 50;
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight <= threshold;
    isScrolledToBottom = isAtBottom;
    updateScrollIndicator();
}

// Обновление индикатора прокрутки
function updateScrollIndicator() {
    if (messages.length <= MAX_VISIBLE_MESSAGES) {
        scrollIndicator.classList.remove('show');
        return;
    }
    
    if (!isScrolledToBottom) {
        const hiddenCount = messages.length - MAX_VISIBLE_MESSAGES;
        scrollIndicator.innerHTML = `<i class="fas fa-chevron-up"></i> ${hiddenCount} более ранних сообщений`;
        scrollIndicator.classList.add('show');
    } else {
        scrollIndicator.classList.remove('show');
    }
}

// Добавление нового сообщения
async function addMessage(sender, text) {
    
    const tempMessage = { 
        sender, 
        text, 
        timestamp: new Date().toISOString() 
    };
    
    // Добавляем временное сообщение
    messages.push(tempMessage);
    displayMessages();
    
    // Если сообщение от пользователя, получаем ответ от ИИ
    if (sender === 'user' && !isLoading) {
        const aiResponse = await sendMessageToAI(text);
        
        // Добавляем ответ от ИИ
        const aiMessage = { 
            sender: 'assistant', 
            text: aiResponse, 
            timestamp: new Date().toISOString() 
        };
        messages.push(aiMessage);
        displayMessages();
    }
}

// Создание начального сообщения для нового чата
async function createInitialChat() {
    const welcomeMessage = "В начале было слово. Сегодня это слово — ваше. Я лишь эхо, которое превратит его в легенду. Говорите — и мир ответит";
    await addMessage('assistant', welcomeMessage);
}

// Полная очистка истории через Flask API
async function clearHistoryAndReset() {
    try {
        const response = await fetch(API_ENDPOINTS.CLEAR, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            // Если очистка успешна, перезагружаем страницу
            window.location.href = '/';
        } else {
            console.error('Ошибка очистки истории');
            alert('Произошла ошибка при очистке истории');
        }
    } catch (error) {
        console.error('Ошибка очистки истории:', error);
        alert('Произошла ошибка при очистке истории');
    }
}

// Обработчики событий

// Нажатие на кнопку "Начать приключение"
startButton.addEventListener('click', async () => {
    showChatInterface();
    if (messages.length === 0) {
        await createInitialChat();
    } else {
        displayMessages();
    }
});

// Нажатие на кнопку "Вернуться на главную"
backButton.addEventListener('click', () => {
    showStartScreen();
});

// Отправка сообщения
sendButton.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (text && !isLoading) {
        chatInput.value = '';
        await addMessage('user', text);
        chatInput.focus();
    }
});

// Отправка сообщения по Enter
chatInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && !isLoading) {
        sendButton.click();
    }
});

// Открытие модального окна сброса
resetButton.addEventListener('click', () => {
    modalOverlay.classList.add('active');
});

// Закрытие модального окна
cancelButton.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

// Закрытие по клику вне окна
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
    }
});

document.addEventListener('DOMContentLoaded', init);