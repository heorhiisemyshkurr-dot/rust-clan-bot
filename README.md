# Rust Clan Bot — тикеты для набора в клан

Discord-бот: панель набора с кнопками → форма (modal) → приватный канал-заявка с кнопками
**Взять / Принять / Отказать / Закрыть**, выдачей роли, DM кандидату, логами и HTML-транскриптом.

## Что умеет

- **Кастомные формы** — типы заявок и вопросы задаются в `config.json`, код править не нужно.
  До 3 форм показываются кнопками, больше — выпадающим списком. В одной форме максимум 5 вопросов (лимит Discord).
- **Приватные тикеты** — канал видят только кандидат, рекрутеры и бот. Нумерация `заявка-0001`.
- **Один открытый тикет на человека** (`maxOpenPerUser`), записи про удалённые каналы сами чистятся.
- **Решение в один клик** — «Принять» выдаёт роль участника (и по желанию ставит тег в ник),
  «Отказать» спрашивает причину и отправляет её кандидату в ЛС.
- **Логи и транскрипт** — в канал логов уходит эмбед + HTML-файл со всей перепиской в тёмной теме.
- **Баннер из файла** — картинка панели лежит в `assets/` и уходит вложением, хостинг не нужен.
- **Авто-архив** — принятая заявка переезжает в категорию архива, канал переименовывается в `✅-заявка-0001`.

## Установка

1. **Создай приложение бота:** https://discord.com/developers/applications → *New Application* →
   вкладка **Bot** → *Reset Token*, скопируй токен.
   Привилегированные intents **не нужны**, галочки включать не надо.
2. **Пригласи бота** на сервер (вкладка *OAuth2 → URL Generator*): scopes `bot` + `applications.commands`,
   права: *Manage Channels*, *Manage Roles*, *View Channels*, *Send Messages*, *Embed Links*,
   *Attach Files*, *Read Message History*, *Manage Messages*.
3. **Настрой окружение:**
   ```powershell
   cd rust-clan-bot
   copy .env.example .env   # вставь DISCORD_TOKEN, CLIENT_ID, GUILD_ID
   npm install
   npm run deploy           # регистрация слэш-команд
   npm start
   ```
4. **На сервере:** `/setup категория:<Заявки> архив:<Архив> рекрутеры:@Recruiter участник:@Member логи:#logs`,
   затем `/panel канал:#набор`.

> Важно: роль бота в списке ролей должна быть **выше** роли, которую он выдаёт, иначе выдать её нельзя.

## Команды

| Команда | Кто может | Что делает |
|---|---|---|
| `/panel [канал]` | Manage Server | публикует панель набора |
| `/setup [...]` | Manage Server | пишет ID категорий/ролей/логов в `config.json`, без аргументов показывает текущие |
| `/apply` | все | открыть форму без панели |
| `/ticket close [причина]` | рекрутер или автор | закрыть заявку с транскриптом |
| `/ticket add/remove <участник>` | рекрутер | дать/забрать доступ к каналу заявки |
| `/ticket info` | все в канале | данные по заявке |

## Настройка форм (`config.json`)

```jsonc
{
  "clanName": "RUST CLAN",
  "clanTag": "RC",
  "prefixNickname": false,      // true — при приёме ставит "RC Ник"
  "bannerFile": "assets/panel-banner.jpg",  // баннер из файла проекта
  "logoFile": "",               // миниатюра из файла, напр. "assets/logo.png"
  "bannerUrl": "",              // те же картинки ссылкой, если файлов нет
  "logoUrl": "",
  "maxOpenPerUser": 1,          // 0 — без лимита
  "deleteDelaySeconds": 10,     // через сколько удалять канал после закрытия
  "panel": {
    "title": "Набор в {clan}",
    "color": "#5CE02A",         // цвет полосы панели (пусто = colors.primary)
    "requirements": ["Возраст 16+"]
  },
  "forms": [{
    "id": "recruit",            // менять нельзя после публикации панели
    "label": "Заявка в клан",
    "emoji": "🪓",
    "channelPrefix": "заявка",
    "pingRoleId": "",           // своя роль-пинг для этой формы (пусто = recruiterRoleId)
    "acceptRoleId": "",         // своя роль при приёме (пусто = memberRoleId)
    "categoryId": "",           // своя категория (пусто = ticketCategoryId)
    "questions": [{
      "id": "nick",
      "label": "Ник в Rust и ссылка на Steam",
      "style": "short",         // short | paragraph
      "placeholder": "Bob | steamcommunity.com/id/...",
      "required": true,
      "maxLength": 200
    }]
  }]
}
```

В `panel.title`, `panel.description` и требованиях работают подстановки `{clan}` и `{tag}`.
После правки форм перезапусти бота (`npm start`) и обнови панель командой `/panel`.

## Хостинг 24/7 (Discloud)

Бот тримає стан у файлах, тому на хостингу ID категорій і ролей краще задавати через змінні
оточення — вони переживають перезаливку, а `config.json` при новому завантаженні перезаписується.

1. Налаштуй бота локально (`/setup`), подивись ID у `config.json` і перенеси їх у `.env`:
   ```
   TICKET_CATEGORY_ID=
   ARCHIVE_CATEGORY_ID=
   RECRUITER_ROLE_ID=
   MEMBER_ROLE_ID=
   LOG_CHANNEL_ID=
   ```
   Значення з `.env` мають пріоритет над `config.json`.
2. Збери архів: `npm run pack` → `dist/lab-bot.zip` (без `node_modules`, залежності ставить хостинг).
3. Залий архів у Discloud — через сайт discloud.app або їхнього бота в Discord командою `.up` з вкладеним zip.
4. Параметри беруться з `discloud.config` у корені: `MAIN=src/index.js`, `RAM=100`, `AUTORESTART=true`.

> В архіві лежить `.env` з токеном — не пересилай його нікому.

**Пам'ять.** Безкоштовний тариф дає близько 100 МБ. Кеші discord.js обрізані в `src/index.js`,
а `npm start` запускається з `--max-old-space-size=72`. Якщо бот падає з OOM — підніми `RAM`
у `discloud.config` (на платному тарифі) або хости на VPS.

## Лічильник складу в статусі бота

Бот показує, скільки людей має задану роль — у статусі («Дивиться MAIN TEAM: 12»)
і в описі профілю бота (About Me).

**Потрібен привілейований intent.** Developer Portal → твій застосунок → Bot →
Privileged Gateway Intents → увімкни **Server Members Intent** → Save Changes.
Без нього Discord не віддає список учасників; бот це переживе — підніметься без
лічильника і напише про це в консоль, заявки працюватимуть як звичайно.

Налаштування — блок `presence` у `config.json`:

```jsonc
"presence": {
  "roleId": "1537142805850226748",   // роль, яку рахуємо (MAIN TEAM)
  "guildId": "",                     // порожньо = перший сервер бота
  "activityType": "Watching",        // Playing | Watching | Listening | Competing
  "template": "MAIN TEAM: {count}",  // текст статусу
  "descriptionTemplate": "...",      // опис профілю бота
  "updateDescription": true,
  "intervalMinutes": 15              // мінімум 5
}
```

У шаблонах працюють `{count}` (людей з роллю), `{total}` (усього на сервері),
`{clan}` і `{tag}`. Статус оновлюється за розкладом, опис профілю — лише коли
число змінилось, бо в нього жорсткі ліміти на зміни.

## Сповіщення про нові відео (TikTok, YouTube тощо)

Бот стежить за RSS-стрічкою і кидає нове відео в канал із пінгом.

TikTok не має відкритого API для сповіщень, а прямий парсинг сайту з серверного IP
він блокує. Тому потрібен генератор RSS: вставляєш посилання на профіль —
отримуєш адресу стрічки. Публічний rsshub.app зараз закритий Cloudflare (403),
робочий варіант — rss.app або власний інстанс RSSHub.

Отриману адресу вписуєш у `config.json` → `feeds[0].url`:

```jsonc
"feeds": [{
  "id": "tiktok",
  "url": "",                      // адреса RSS-стрічки
  "channelId": "1537141628991447040",
  "mention": "@everyone",         // або "<@&ID_ролі>", або ""
  "template": "{mention}\n🎬 **НОВЕ ВІДЕО НА TIKTOK!**\n{link}",
  "intervalMinutes": 10,          // мінімум 5
  "maxPerCheck": 3                // захист від залпу при збої стрічки
}]
```

У шаблоні працюють `{mention}`, `{title}`, `{link}`, `{clan}`.
Посилання краще лишати останнім рядком — Discord сам розгорне прев’ю відео.

Перша перевірка нічого не публікує: бот запам’ятовує поточну стрічку у
`data/feeds.json`, щоб не залити канал старими відео. Далі публікується лише нове.
Для пінгу `@everyone` боту потрібне право **Згадувати @everyone** у тому каналі.

## Структура

```
src/index.js       запуск клиента и роутер взаимодействий
src/commands.js    слэш-команды
src/tickets.js     создание, claim, приём, отказ, закрытие
src/ui.js          эмбеды, кнопки, модалки
src/transcript.js  HTML-транскрипт канала
src/store.js       JSON-база тикетов (data/tickets.json)
src/presence.js    лічильник ролі у статусі бота
src/feeds.js       стеження за RSS і сповіщення про відео
src/config.js      чтение/запись config.json и .env
assets/            картинки панелі та правил
scripts/pack.mjs   збірка zip для хостингу
```

`data/tickets.json` и `.env` в `.gitignore` — токен и база в репозиторий не попадают.
