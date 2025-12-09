from flask_sqlalchemy import SQLAlchemy
import openai
import dotenv
import logging
from datetime import datetime, timezone, timedelta

# Настройка логгирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Загружаем переменные окружения
try:
    env = dotenv.dotenv_values(".env")
    YA_API_KEY = env.get("YA_API_KEY")
    YA_FOLDER_ID = env.get("YA_FOLDER_ID")    
except FileNotFoundError:
    raise FileNotFoundError("Файл .env не найден. Убедитесь, что он существует в корневой директории проекта.")
except KeyError as e:
    raise KeyError(f"Переменная окружения {str(e)} не найдена в файле .env. Проверьте его содержимое.")

db = SQLAlchemy()

class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(10), default='user')  # 'user' или 'assistant'
    content = db.Column(db.Text, nullable=False)  # Текст сообщения
    timestamp = db.Column(db.DateTime, default=datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=3))))

class LLMService:
    def __init__(self, prompt_file):
        try:
            with open(prompt_file, 'r', encoding='utf-8') as f:
                self.sys_prompt = f.read()
        except FileNotFoundError:
            logger.warning(f"Файл промпта {prompt_file} не найден.")
        
        try:
            self.client = openai.OpenAI(
                api_key=YA_API_KEY,
                base_url="https://llm.api.cloud.yandex.net/v1",
            )
            # self.model = f"gpt://{YA_FOLDER_ID}/yandexgpt-lite"
            self.model = f"gpt://{YA_FOLDER_ID}/yandexgpt/latest"
            logger.info("LLM сервис инициализирован успешно")
        except Exception as e:
            logger.error(f"Ошибка инициализации LLM: {str(e)}")

    def chat_with_history(self, user_message, conversation_history):
        """
        Отправляет сообщение с историей диалога
        
        Args:
            user_message: текущее сообщение пользователя
            conversation_history: список предыдущих сообщений в формате для API
        """
        try:
            # Формируем полный список сообщений
            messages = [{"role": "system", "content": self.sys_prompt}]

            for msg in conversation_history:
                # Проверяем, что это не системный промпт
                if msg.get("role") != "system":
                    messages.append(msg)
            
            # Добавляем историю
            # messages.extend(conversation_history)
            
            # Добавляем текущее сообщение пользователя
            messages.append({"role": "user", "content": user_message})
            
            logger.info(f"Отправка запроса с историей из {len(messages)} сообщений")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.8,
                max_tokens=4096,
            )
            
            reply = response.choices[0].message.content
            logger.info("LLM ответ получен с учетом истории")
            return reply
            
        except openai.APIError as e:
            logger.error(f"API ошибка: {str(e)}")
            return "Произошла ошибка API. Пожалуйста, попробуйте еще раз."
        except Exception as e:
            logger.error(f"Неизвестная ошибка: {str(e)}")
            return "Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже."

try:
    llm_service = LLMService('prompts/main_prompt.txt')
    logger.info("LLM сервис создан успешно")
except Exception as e:
    logger.error(f"Ошибка создания LLM сервиса: {str(e)}")

def save_conversation_turn(role, content):
    """Сохраняет одно сообщение в базу данных"""
    try:
        entry = ChatHistory(role=role, content=content)
        db.session.add(entry)
        db.session.commit()
        logger.info(f"Сохранено сообщение: {role}")
        return entry
    except Exception as e:
        logger.error(f"Ошибка сохранения сообщения: {str(e)}")
        db.session.rollback()
        raise

def get_conversation_history(limit=10):
    """
    Получает историю диалога из базы данных
    
    Аргументы:
        limit: количество последних сообщений для получения 
    """
    try:
        # Получаем последние N пар сообщений (пользователь + ассистент)
        # entries = ChatHistory.query.order_by(ChatHistory.timestamp.desc()).limit(limit * 2).all()
        entries = ChatHistory.query.order_by(ChatHistory.id.desc()).limit(limit * 2).all()
        # Преобразуем в обратном порядке (от старых к новым)
        entries = list(reversed(entries))
        
        history = []
        for entry in entries:
            role_map = {'user': 'user', 'assistant': 'assistant'}
            api_role = role_map.get(entry.role, entry.role)
            
            history.append({
                "role": api_role,
                "content": entry.content
            })
        
        logger.info(f"Получена история из {len(history)} сообщений")
        return history
    except Exception as e:
        logger.error(f"Ошибка получения истории: {str(e)}")
        return []

def chat_with_llm(user_message, use_history=True, history_limit=10):
    try:
        # Сохраняем сообщение пользователя
        save_conversation_turn('user', user_message)
        
        conversation_history = []
        if use_history:
            conversation_history = get_conversation_history(history_limit)
        
        # Получаем ответ от LLM
        llm_reply = llm_service.chat_with_history(user_message, conversation_history)
        
        # Сохраняем ответ ассистента
        save_conversation_turn('assistant', llm_reply)
        
        return llm_reply
    except Exception as e:
        logger.error(f"Ошибка в chat_with_llm: {str(e)}")
        return "Произошла ошибка при обработке запроса."
