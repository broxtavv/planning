# ✨ AI Day Planner

Умный планер дня с ИИ-ассистентом. PWA + Android через Capacitor.

## 🚀 Быстрый запуск с телефона (без ПК!)

### Вариант A — GitHub Pages (самый простой)

1. Установи на телефон приложение **«GitHub»** из Play Store, создай аккаунт.
2. Через браузер зайди на **github.com** → **New repository** → назови `ai-day-planner`, поставь **Public**, нажми **Create**.
3. В репозитории нажми **Add file → Upload files**.
4. Загрузи 5 файлов: `index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`.
5. Нажми **Commit changes**.
6. Зайди в **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main / (root)** → **Save**.
7. Через 1–2 минуты сайт будет доступен: `https://ТВОЙ_ЛОГИН.github.io/ai-day-planner/`
8. Открой эту ссылку в **Chrome на Android**.
9. Меню Chrome (⋮) → **Установить приложение** / **Добавить на главный экран**.
10. Готово — приложение как нативное, работает оффлайн (кроме ИИ).

### Вариант B — локальный сервер на телефоне

Скачай в Play Store приложение **«Termux»** и выполни:

```bash
pkg update && pkg install python -y
cd /sdcard/Download/ai-day-planner
python -m http.server 8080
