# funpayplugg

Автообработка заказов FunPay.

Поддержка:
- Telegram Stars через Fragment
- услуги через Twiboost

## Файлы

```text
funpayplugg/
├─ main.py
├─ cfg.py
├─ data.py
├─ db.py
├─ logs.py
├─ funpay.py
├─ fragment.py
├─ twiboost.py
├─ parse.py
├─ msg.py
├─ requirements.txt
├─ .env.example
└─ services/
   ├─ runner.py
   ├─ stars_job.py
   └─ boost_job.py
```

## Установка

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
```

## Настройка

Скопируй `.env.example` в `.env` и заполни:

- `FUNPAY_COOKIES`
- `FRAGMENT_COOKIES`
- `TWIBOOST_API_KEY` или `TWIBOOST_USERNAME` + `TWIBOOST_PASSWORD`

## Запуск

```powershell
python main.py
```

## Что делает

- следит за новыми заказами и сообщениями на FunPay
- определяет тип заказа
- для Stars берет username и отправляет через Fragment
- для услуг просит ссылку и запускает заказ в Twiboost
- хранит состояния в SQLite

## Статусы

- `new`
- `waiting_username`
- `waiting_username_confirm`
- `waiting_link`
- `waiting_link_confirm`
- `processing`
- `completed`
- `problem`
