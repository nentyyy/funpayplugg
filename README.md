# FunPay Automation

Проект автоматизирует обработку заказов на FunPay без Telegram-бота:

- определяет тип заказа: `Telegram Stars` или `Twiboost`
- ведет диалог с покупателем прямо в чате FunPay
- сохраняет состояния заказов в SQLite
- отправляет Stars через `Fragment`
- запускает услуги через `Twiboost`
- логирует действия в консоль и файл

## Структура проекта

```text
FunPayPLAGIN/
├─ main.py
├─ config.py
├─ models.py
├─ storage.py
├─ logger.py
├─ funpay_client.py
├─ fragment_client.py
├─ twiboost_client.py
├─ parser_utils.py
├─ message_templates.py
├─ requirements.txt
├─ .env.example
├─ README.md
└─ services/
   ├─ __init__.py
   ├─ orders.py
   ├─ stars.py
   └─ twiboost.py
```

## Установка

1. Установи Python `3.11+`.
2. Создай виртуальное окружение:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

3. Установи зависимости:

```powershell
pip install -r requirements.txt
python -m playwright install chromium
```

4. Скопируй `.env.example` в `.env` и заполни cookies и доступы.

## Запуск

```powershell
python main.py
```

## Конфиг

Основные параметры:

- `FUNPAY_COOKIES` - cookies от FunPay
- `FRAGMENT_COOKIES` - cookies от Fragment
- `TWIBOOST_API_KEY` - API ключ Twiboost, если есть
- `TWIBOOST_USERNAME` и `TWIBOOST_PASSWORD` - логин через сайт, если API нет
- `POLLING_INTERVAL` - интервал опроса в секундах
- `DATABASE_PATH` - путь до SQLite базы

## Как работает

### Telegram Stars

1. Бот находит новый заказ на FunPay.
2. Из системного текста извлекает:
   - `order_id`
   - `amount`
   - `username`, если он есть
3. Если username найден, сразу отправляет подтверждение и ждет `+` или `-`.
4. Если username нет, просит прислать `@username`.
5. После `+` запускает `FragmentClient.send_stars(username, amount)`.
6. После успеха отправляет сообщение с подтверждением заказа.

### Twiboost

1. Бот определяет, что заказ не относится к Stars.
2. Сразу просит ссылку на профиль или пост.
3. После получения ссылки просит подтверждение `+` или `-`.
4. После `+` вызывает `TwiboostClient.create_order(link, service_type, amount)`.
5. Сохраняет внутренний номер заказа и дальше опрашивает статус.
6. После завершения отправляет финальное сообщение в чат FunPay.

## Примеры сообщений в FunPay

### Telegram Stars

```text
🎁 Заказ принят
Спасибо за покупку Telegram Stars.

📌 Данные по заказу:
Юзернейм: @example
Количество: 13

✏️ Проверь данные:
Если всё верно, отправь +
Если нужно изменить данные, отправь -
```

```text
🚀 Начинаю выполнение
Зачисление занимает немного времени.
```

```text
🎉 Готово
Звезды отправлены на указанный аккаунт.

📌 Ссылка на подтверждение заказа:
https://funpay.com/orders/ABC123/

🙏 После проверки подтверди выполнение заказа.
```

### Twiboost

```text
⚡ Заказ принят
Спасибо за покупку услуги.

📌 Чтобы начать выполнение, отправь ссылку на профиль или пост.

Пример:
https://...
```

```text
📥 Данные получены
Ссылка: https://example.com/profile

✏️ Проверь данные:
Если всё верно, отправь +
Если нужно изменить ссылку, отправь -
```

```text
✅ Заказ выполнен

📌 Ссылка на подтверждение заказа:
https://funpay.com/orders/ABC123/

🙏 После проверки подтверди выполнение заказа.
```

## Примеры записей в базе

```sql
SELECT order_id, buyer_username, order_type, amount, target_username, target_link, status
FROM orders;
```

```text
FP123456 | buyer_one | stars    | 13  | @Mathohist | NULL                           | waiting_username_confirm
FP123457 | buyer_two | twiboost | 500 | NULL       | https://x.com/example/status/1 | processing
```

## Замечания по интеграциям

- `FunPayClient` читает список заказов и страницу заказа через cookies.
- Отправка сообщений на FunPay сделана через HTML-форму страницы заказа.
- `FragmentClient` использует Playwright и cookies Fragment.
- `TwiboostClient` работает через API, а если API-ключа нет, пытается логиниться через сайт.

Если верстка FunPay, Fragment или Twiboost меняется, обычно достаточно поправить селекторы и endpoint-ы в клиентах, не трогая сервисную логику.
