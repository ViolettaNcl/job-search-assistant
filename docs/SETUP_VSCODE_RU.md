# Запуск Violetta Global Job Assistant через VS Code

Эта инструкция рассчитана на Windows 10/11 + Visual Studio Code. Самый простой путь — запуск через Docker Compose: PostgreSQL и .NET-приложение поднимаются одной командой.

## 0. Что установить

1. **Visual Studio Code** — https://code.visualstudio.com/
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
3. **Git** — https://git-scm.com/downloads
4. Рекомендуемые расширения VS Code:
   - C# Dev Kit (Microsoft)
   - Docker (Microsoft)
   - GitHub Pull Requests (Microsoft, необязательно)

.NET SDK 10 нужен, если вы хотите запускать/отлаживать приложение без Docker. При Docker-запуске SDK на Windows необязателен, потому что он уже есть в контейнере сборки.

## 1. Распаковать и открыть проект

1. Распакуйте `job-search-assistant.zip`, например в:

```text
C:\Projects\job-search-assistant
```

2. Откройте VS Code.
3. `File` → `Open Folder...` → выберите `job-search-assistant`.
4. Откройте встроенный терминал: `Terminal` → `New Terminal`.

Проверьте Docker:

```powershell
docker --version
docker compose version
```

## 2. Создать Telegram-бота

1. В Telegram откройте `@BotFather`.
2. Выполните `/newbot`.
3. Название, например: `Violetta Global Job Assistant`.
4. Username, например: `ViolettaGlobalJobsBot` (если свободен).
5. Скопируйте Bot Token.

Никогда не коммитьте токен в GitHub.

## 3. Создать `.env`

В VS Code в корне проекта найдите `.env.example`.

Скопируйте его в новый файл `.env`:

```powershell
Copy-Item .env.example .env
```

Сгенерируйте ключ шифрования:

```powershell
python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
```

Если Python не установлен, можно выполнить в PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Заполните минимум:

```env
POSTGRES_PASSWORD=придумайте-длинный-случайный-пароль
TELEGRAM_BOT_TOKEN=токен_от_BotFather
TELEGRAM_ALLOWED_CHAT_ID=0
ENCRYPTION_KEY_BASE64=сгенерированный_ключ
ENABLE_AUTOMATIC_SUBMISSION=false

HH_ENABLED=true
HH_CLIENT_ID=
HH_CLIENT_SECRET=
HH_REDIRECT_URI=http://localhost:8080/api/hh/oauth/callback

REMOTIVE_ENABLED=true
ADZUNA_ENABLED=false
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

На первом запуске HH и Adzuna можно не настраивать. Remotive уже даст международные remote-вакансии без API key.

## 4. Первый запуск

В терминале VS Code:

```powershell
docker compose up --build
```

Для запуска в фоне:

```powershell
docker compose up --build -d
```

Проверка контейнеров:

```powershell
docker compose ps
```

Логи приложения:

```powershell
docker compose logs -f app
```

Откройте:

```text
http://localhost:8080
```

Health check:

```text
http://localhost:8080/health
```

## 5. Защитить Telegram-бота вашим Chat ID

Пока в `.env`:

```env
TELEGRAM_ALLOWED_CHAT_ID=0
```

Напишите боту `/start`. Он покажет ваш numeric chat id.

Вставьте его в `.env`:

```env
TELEGRAM_ALLOWED_CHAT_ID=123456789
```

Перезапустите:

```powershell
docker compose down
docker compose up -d
```

Теперь команды игнорируются от других Telegram chat id.

## 6. Проверить международный поиск

В dashboard нажмите **«Собрать вакансии»** или в Telegram используйте `/best` после фонового сбора.

Remotive включён по умолчанию и ищет международные remote-вакансии. Команда:

```text
/world
```

показывает вакансии не из HH.

Команда:

```text
/sources
```

показывает количество вакансий по источникам.

## 7. Подключить Adzuna для США и других стран

1. Зарегистрируйтесь: https://developer.adzuna.com/
2. Получите `app_id` и `app_key`.
3. В `.env`:

```env
ADZUNA_ENABLED=true
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
```

4. Перезапустите контейнеры:

```powershell
docker compose down
docker compose up -d --build
```

По умолчанию код ищет: US, UK, Germany, Canada, Australia, France, Netherlands, Poland. Список можно изменить в `src/JobSearchAssistant/appsettings.json` → `Adzuna.CountryCodes`.

## 8. Подключить HeadHunter

HH нужен как один из источников и для официальной отправки отклика через API.

1. Зарегистрируйте приложение на https://dev.hh.ru/admin
2. Callback URL:

```text
http://localhost:8080/api/hh/oauth/callback
```

3. Заполните `.env`:

```env
HH_CLIENT_ID=...
HH_CLIENT_SECRET=...
```

4. Перезапустите приложение.
5. Откройте dashboard → **«Подключить HH»**.
6. Авторизуйтесь на hh.ru.
7. В dashboard нажмите «Загрузить мои резюме» и выберите нужное.

## 9. Как работать каждый день

Telegram:

```text
/today       новые за сутки
/best        лучшие совпадения
/world       международные
/sources     статистика источников
/applied     сделанные отклики
/interviews  активные HR/Tech/Test
/stats       общая воронка
```

Для HH кнопка может отправить отклик через официальный API.

Для международных источников кнопка **«Откликнуться на сайте»** открывает официальный/исходный application URL. После отправки нажмите **«Я откликнулась»** — система создаст Application и больше не предложит эту вакансию как новую.

Любую ссылку с Wellfound, LinkedIn, Greenhouse, Lever, Ashby, Getmatch, Habr Career или карьерного сайта можно прислать боту: система сохранит её в единой CRM и защитит от повторной отправки той же ссылки.

## 10. Если вы уже запускали старую HH-only версию

В модели БД появились новые поля. Для тестовой локальной базы проще один раз удалить старый Docker volume:

```powershell
docker compose down -v
docker compose up --build -d
```

**Внимание:** `-v` удаляет локальную базу со старыми тестовыми данными. Не делайте этого после того, как начнёте хранить настоящую историю откликов. Следующая production-итерация должна перейти на EF Core migrations.

## 11. Остановка и запуск

Остановить:

```powershell
docker compose stop
```

Запустить снова:

```powershell
docker compose start
```

Полностью остановить контейнеры:

```powershell
docker compose down
```

Данные PostgreSQL сохраняются в Docker volume, если не использовать `-v`.

## 12. Запуск без Docker для разработки

Установите .NET 10 SDK и PostgreSQL, затем:

```powershell
dotnet restore
dotnet test tests/JobSearchAssistant.Tests/JobSearchAssistant.Tests.csproj
dotnet run --project src/JobSearchAssistant/JobSearchAssistant.csproj
```

Для debugging в VS Code откройте C# project через C# Dev Kit и используйте `Run and Debug`.

## 13. GitHub

После проверки локально:

```powershell
git init
git add .
git commit -m "Initial global job assistant"
git branch -M main
git remote add origin https://github.com/ViolettaNcl/job-search-assistant.git
git push -u origin main
```

`.env` уже должен оставаться вне Git благодаря `.gitignore`.
