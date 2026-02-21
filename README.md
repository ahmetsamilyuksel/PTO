# ПТО DocOps — Система управления исполнительной документацией
# PTO DocOps — Construction As-Built Documentation System
# PTO DocOps — İnşaat İcra Dokümantasyonu Yönetim Sistemi

## О системе / About / Hakkında

Комплексная система для автоматизации ведения исполнительной документации (ИД) на строительных объектах в соответствии с нормативной базой РФ.

Comprehensive system for automating as-built documentation management at construction sites per Russian Federation regulations.

Rusya Federasyonu mevzuatına uygun olarak inşaat sahalarında icra dokümantasyonunun (İD) otomasyonu için kapsamlı sistem.

### Нормативная база / Regulatory Framework
- **СП 48.13330.2019** — Организация строительства
- **РД-11-02-2006** + **Приказ 1128** — Состав и порядок ИД
- **РД 11-05-2007** — Журналы учёта
- **Приказ Минстроя 1026/пр** (01.09.2023) — Новая форма общего журнала
- **СП 70.13330.2012** — Несущие и ограждающие конструкции

## Возможности / Features / Özellikler

### MVP (v1.0)
- ✅ Мастер создания проекта / Project setup wizard / Proje kurulum sihirbazı
- ✅ Матрица документов / Document matrix engine / Evrak matrisi motoru
- ✅ АОСР (акты скрытых работ) / Hidden works acts / Gizli işler aktları
- ✅ Акт передачи площадки / Site handover act / Yer teslim tutanağı
- ✅ Управление материалами и сертификатами / Materials & certificates / Malzeme ve sertifika yönetimi
- ✅ Входной контроль / Incoming control / Giriş kontrolü
- ✅ Общий журнал работ / General work journal / Genel iş günlüğü
- ✅ Рабочий процесс с аудитом / Workflow with audit / Denetim günlükli iş akışı
- ✅ Формирование комплекта ИД (ZIP) / ID package generation / İD paketi oluşturma
- ✅ Экспорт PDF/DOCX / PDF/DOCX export / PDF/DOCX dışa aktarma
- ✅ Мультиязычность: RU / TR / EN / Multilingual / Çok dilli

### V2 (планируется / planned / planlanan)
- Специальные журналы (бетонных, сварочных работ и др.)
- Модуль протоколов испытаний
- Интеграция КриптоПро/ЭЦП
- Офлайн-режим (PWA)
- Интеграция с CAD

## Быстрый старт / Quick Start / Hızlı Başlangıç

### Требования / Requirements / Gereksinimler
- Docker + Docker Compose
- 4 GB RAM минимум

### Запуск / Launch / Başlatma

```bash
# Клонирование / Clone / Klonlama
git clone <repo-url>
cd PTO

# Запуск / Start / Başlat
docker compose up --build

# Подождите ~2 минуты для инициализации / Wait ~2 min for init
```

Система будет доступна / System available at / Sistem adresi:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000/api
- **MinIO Console**: http://localhost:9001

### Демо-доступ / Demo Access / Demo Erişim

| Роль / Role / Rol | Email | Пароль / Password / Şifre |
|---|---|---|
| Инженер ПТО / QA Engineer / PTO Mühendisi | ahmet@saela.ru | password123 |
| Начальник участка / Site Chief / Şantiye Şefi | ivanov@saela.ru | password123 |
| Технадзор / Tech Supervisor / Teknik Nezaret | petrova@stroyinvest.ru | password123 |
| Авторский надзор / Design Supervisor / Müellif Nezareti | sidorov@proektburo.ru | password123 |

### Демо-сценарий / Demo Scenario / Demo Senaryo

Seed data включает / Seed data includes / Seed data içeriği:
- Проект: ЖК "Солнечный" — Корпус 3
- 2 секции (А, Б), 2 этажа
- 3 рабочих элемента (бетон, армирование, кладка)
- 2 материала с сертификатами
- Акт передачи площадки (подписан)
- АОСР (черновик)
- Общий журнал с записями
- 9 правил матрицы документов

## Архитектура / Architecture / Mimari

```
┌─────────────────────────────────────────┐
│           Frontend (React + Vite)       │
│         Ant Design + i18n (RU/TR/EN)   │
│              Nginx (port 80)            │
├─────────────────────────────────────────┤
│           Backend (Express + TS)        │
│         REST API (port 3000)            │
│  ┌─────────┬──────────┬──────────────┐  │
│  │ Prisma  │ Workflow │ Doc Generator│  │
│  │   ORM   │  Engine  │ (DOCX→PDF)  │  │
│  └────┬────┴──────────┴──────────────┘  │
│       │                                 │
├───────┼─────────────────────────────────┤
│  PostgreSQL    │    MinIO (S3)          │
│  (port 5432)   │    (port 9000/9001)   │
└─────────────────────────────────────────┘
```

### Технологии / Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Ant Design 5
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL 16
- **Storage**: MinIO (S3-compatible)
- **Documents**: docxtemplater + LibreOffice (DOCX→PDF)
- **Auth**: JWT + bcrypt, RBAC

## Структура проекта / Project Structure / Proje Yapısı

```
PTO/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Модель данных / Data model
│   │   ├── seed.ts          # Seed данные / Seed data
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts         # Точка входа / Entry point
│   │   ├── config.ts        # Конфигурация / Config
│   │   ├── routes/          # API маршруты / API routes
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   ├── documents.ts
│   │   │   ├── materials.ts
│   │   │   ├── journals.ts
│   │   │   ├── workflow.ts
│   │   │   ├── packages.ts
│   │   │   ├── matrix.ts
│   │   │   └── ...
│   │   ├── services/        # Бизнес-логика / Business logic
│   │   │   ├── documentMatrix.ts
│   │   │   ├── documentGenerator.ts
│   │   │   ├── workflowEngine.ts
│   │   │   ├── validation.ts
│   │   │   ├── packageBuilder.ts
│   │   │   └── storage.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts      # JWT аутентификация / JWT auth
│   │   │   └── audit.ts     # Аудит лог / Audit logging
│   │   └── utils/
│   │       ├── fileNaming.ts # Именование файлов / File naming
│   │       └── qrcode.ts    # QR-коды / QR codes
│   └── templates/           # Шаблоны документов / Doc templates
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── i18n/            # Мультиязычность / i18n
│   │   │   ├── ru.ts        # Русский
│   │   │   ├── tr.ts        # Türkçe
│   │   │   └── en.ts        # English
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ProjectSetup.tsx
│   │   │   ├── DocumentMatrix.tsx
│   │   │   ├── Documents.tsx
│   │   │   ├── Materials.tsx
│   │   │   ├── Journals.tsx
│   │   │   └── Packages.tsx
│   │   ├── components/
│   │   └── api/
│   └── nginx.conf
└── README.md
```

## API Endpoints

### Аутентификация / Auth
- `POST /api/auth/register` — Регистрация
- `POST /api/auth/login` — Вход
- `GET /api/auth/me` — Текущий пользователь

### Проекты / Projects
- `GET/POST /api/projects` — Список / Создание
- `GET/PUT /api/projects/:id` — Детали / Обновление
- `POST /api/projects/:id/setup` — Полная настройка (wizard)

### Документы / Documents
- `GET/POST /api/documents` — Список / Создание
- `GET/PUT /api/documents/:id` — Детали / Обновление
- `POST /api/documents/:id/generate` — Генерация DOCX/PDF
- `GET /api/documents/:id/validate` — Валидация

### Рабочий процесс / Workflow
- `POST /api/workflow/:documentId/transition` — Переход статуса

### Материалы / Materials
- `GET/POST /api/materials` — Список / Создание
- `POST /api/materials/:id/certificates` — Добавить сертификат
- `POST /api/materials/:id/incoming-control` — Входной контроль

### Журналы / Journals
- `GET/POST /api/journals` — Список / Создание
- `POST /api/journals/:id/entries` — Добавить запись

### Комплекты / Packages
- `GET/POST /api/packages` — Список / Создание
- `POST /api/packages/:id/build` — Сформировать ZIP
- `GET /api/packages/:id/download` — Скачать

### Матрица / Matrix
- `GET /api/matrix?projectId=...` — Правила матрицы
- `GET /api/matrix/status?projectId=...` — Статус заполнения

## Как добавить новый тип документа / Adding a Document Type / Yeni Doküman Türü Ekleme

1. **Добавить enum** в `prisma/schema.prisma` → `DocumentType`
2. **Создать шаблон** DOCX с плейсхолдерами `{field_name}` в `backend/templates/`
3. **Зарегистрировать шаблон** через API или seed:
   ```sql
   INSERT INTO "DocumentTemplate" (id, name, "documentType", "filePath", fields, ...)
   ```
4. **Добавить правило матрицы** (опционально):
   ```sql
   INSERT INTO "DocumentMatrixRule" ("workType", "documentType", "triggerEvent", ...)
   ```
5. **Добавить перевод** в `frontend/src/i18n/{ru,tr,en}.ts` → `doc.types.NEW_TYPE`
6. **Запустить миграцию**: `npx prisma migrate dev`

## Кастомизация шаблонов / Template Customization / Şablon Özelleştirme

Шаблоны используют синтаксис docxtemplater:
- `{field_name}` — простая подстановка
- `{#loop}...{/loop}` — цикл
- `{%image}` — изображение (в будущем)

Откройте шаблон в Word/LibreOffice, отредактируйте, сохраните в `backend/templates/`.

## Лицензия / License

MIT

---

*Разработано для автоматизации ИТД-процессов на строительных объектах.*
*Built to automate as-built documentation processes at construction sites.*
*İnşaat sahalarında icra dokümantasyonu süreçlerini otomatize etmek için geliştirildi.*
