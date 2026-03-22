from __future__ import annotations


def stars_intro(username: str | None, amount: int) -> str:
    shown_username = username or "не указан"
    return (
        "🎁 Заказ принят\n"
        "Спасибо за покупку Telegram Stars.\n\n"
        "📌 Данные по заказу:\n"
        f"Юзернейм: {shown_username}\n"
        f"Количество: {amount}\n\n"
        "✏️ Проверь данные:\n"
        "Если всё верно, отправь +\n"
        "Если нужно изменить данные, отправь -"
    )


def request_username() -> str:
    return (
        "📌 Юзернейм не найден в заказе.\n"
        "Отправь username в формате @username."
    )


def stars_reenter_username() -> str:
    return "✏️ Отправь новый username в формате @username."


def stars_processing() -> str:
    return (
        "🚀 Начинаю выполнение\n"
        "Зачисление занимает немного времени."
    )


def stars_completed(order_id: str) -> str:
    return (
        "🎉 Готово\n"
        "Звезды отправлены на указанный аккаунт.\n\n"
        "📌 Ссылка на подтверждение заказа:\n"
        f"https://funpay.com/orders/{order_id}/\n\n"
        "🙏 После проверки подтверди выполнение заказа."
    )


def stars_delay() -> str:
    return (
        "⏳ Есть задержка при отправке.\n"
        "Я продолжаю обработку заказа и сообщу сюда после завершения."
    )


def twiboost_intro() -> str:
    return (
        "⚡ Заказ принят\n"
        "Спасибо за покупку услуги.\n\n"
        "📌 Чтобы начать выполнение, отправь ссылку на профиль или пост.\n\n"
        "Пример:\n"
        "https://..."
    )


def twiboost_link_confirm(link: str) -> str:
    return (
        "📥 Данные получены\n"
        f"Ссылка: {link}\n\n"
        "✏️ Проверь данные:\n"
        "Если всё верно, отправь +\n"
        "Если нужно изменить ссылку, отправь -"
    )


def request_link() -> str:
    return "📌 Пришли ссылку на профиль или пост в формате https://..."


def twiboost_reenter_link() -> str:
    return "✏️ Пришли новую ссылку на профиль или пост."


def twiboost_started() -> str:
    return (
        "🚀 Заказ запущен\n"
        "Обработка уже началась.\n\n"
        "Результат появляется постепенно.\n"
        "Когда всё будет завершено, я сообщу сюда."
    )


def twiboost_completed(order_id: str) -> str:
    return (
        "✅ Заказ выполнен\n\n"
        "📌 Ссылка на подтверждение заказа:\n"
        f"https://funpay.com/orders/{order_id}/\n\n"
        "🙏 После проверки подтверди выполнение заказа."
    )


def generic_error() -> str:
    return (
        "⚠️ Возникла ошибка при обработке заказа.\n"
        "Я уже повторяю попытку. Если задержка сохранится, напишу сюда."
    )
