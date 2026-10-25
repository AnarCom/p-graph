# Архитектура платформы

Платформа для описания и выполнения вычислительных pipeline в виде ориентированного графа (DAG) с запуском операций на Kubernetes.

## 1. Общая карта компонентов

```mermaid
flowchart LR
    subgraph Client
        UI["Frontend"]
    end

    subgraph APISvc["API Server"]
        API["API Server<br/>• CRUD pipelines<br/>• валидация DAG (при сохранении)<br/>• запуск / отмена / re-run<br/>• WebSocket/SSE статусы"]
    end

    subgraph OrchSvc["Orchestrator"]
        ORCH["Orchestrator / Runtime<br/>• топологическая сортировка<br/>• параллельный запуск операций<br/>• создание K8s Job, watch<br/>• сбор логов Pod'ов"]
    end

    subgraph Data["Хранилища"]
        PG[("PostgreSQL<br/>графы, runs, статусы,<br/>метаданные логов")]
        S3[("S3 / MinIO<br/>артефакты данных<br/>+ логи операций")]
    end

    subgraph K8s["Kubernetes (kind / minikube)"]
        JOB1["Job → Pod<br/>операция A"]
        JOB2["Job → Pod<br/>операция B"]
        JOBN["Job → Pod<br/>операция N"]
    end

    UI -- "REST (CRUD)" --> API
    UI <-. "WebSocket / SSE<br/>(статусы)" .-> API
    API -- "internal REST:<br/>start / cancel / re-run" --> ORCH
    API --> PG
    API <-. "статусы: LISTEN/NOTIFY<br/>или polling" .-> PG
    ORCH --> PG
    ORCH -- "создание Job / watch" --> K8s
    ORCH -. "чтение логов (K8s API)" .-> K8s
    ORCH -- "запись лога по завершении" --> S3
    API -- "логи (после завершения)" --> S3
    JOB1 -- "артефакты" --> S3
    JOB2 -- "артефакты" --> S3
    JOBN -- "артефакты" --> S3
```

Границы между сервисами:

- **API Server** — синхронный сервис «для UI»: CRUD, валидация, отдача статусов. Не знает про Kubernetes.
- **Orchestrator** — фоновый сервис с watch-циклом. **Единственная точка доступа к Kubernetes**: создание Job, watch, сбор логов. API проксирует запросы логов UI через него.
- **PostgreSQL — источник истины по статусам.** Orchestrator пишет статусы в БД, API читает их (LISTEN/NOTIFY или polling) и раздаёт в UI через WebSocket/SSE. Рестарт любого из сервисов не теряет состояние.
- **Логи всегда из MinIO**: Orchestrator записывает лог один раз — по завершении операции (полный лог пода через K8s API); API отдаёт логи из MinIO после терминального статуса, во время выполнения логов нет (детали в разделе 6).
- Запуск/отмена — внутренний REST-вызов API → Orchestrator. Альтернатива без прямого вызова: Orchestrator сам забирает новые run'ы из БД (polling) — тогда связность ещё ниже, но задержка старта выше.

## 2. Жизненный цикл запуска pipeline

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as API Server
    participant DB as PostgreSQL
    participant ORCH as Orchestrator
    participant K8s as Kubernetes
    participant S3 as MinIO

    UI->>API: POST /pipelines (граф)
    API->>API: валидация DAG (циклы — при сохранении)
    API->>DB: сохранить pipeline

    UI->>API: POST /runs (запуск)
    API->>DB: создать run (Pending)
    API->>ORCH: internal REST: start run

    ORCH->>DB: загрузить граф
    ORCH->>ORCH: топологическая сортировка
    ORCH->>DB: операции → Scheduled
    ORCH->>K8s: создать Job'ы (готовые операции, параллельно)
    ORCH->>DB: операции → Running

    loop пока есть незавершённые операции
        K8s-->>ORCH: статус Job (watch)
        alt успех
            ORCH->>DB: операция → Succeeded
            ORCH->>K8s: забрать полный лог пода
            ORCH->>S3: записать logs/attempt-{N}.log
            ORCH->>DB: manifest артефактов + ссылка на лог
            ORCH->>K8s: создать Job'ы следующих операций
        else ошибка (exit code ≠ 0)
            ORCH->>K8s: забрать полный лог пода
            ORCH->>S3: записать logs/attempt-{N}.log
            ORCH->>DB: операция → Failed (exit code, ссылка на лог)
            ORCH->>DB: незапущенные операции → Cancelled
            ORCH->>DB: run → Failed
            API-->>UI: уведомление: операция упала, граф остановлен
        end
    end

    ORCH->>DB: run → Succeeded | Failed

    loop статусы → UI
        DB-->>API: обновления (LISTEN/NOTIFY / polling)
        API-->>UI: WebSocket/SSE
    end

    UI->>API: GET логи (после завершения операции)
    API->>S3: GET logs/attempt-{N}.log
    S3-->>API: лог
    API-->>UI: логи
```

## 3. Машина состояний операции

```mermaid
stateDiagram-v2
    [*] --> Pending: run создан
    Pending --> Scheduled: план построен
    Scheduled --> Running: K8s Job создан
    Running --> Succeeded: exit code = 0
    Running --> Failed: exit code ≠ 0
    Running --> Cancelled: отмеfна run
    Failed --> Scheduled: ручной re-run (новая попытка)
    Succeeded --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

Единая модель статусов для БД, Kubernetes и UI.

Семантика ошибок:

- **Автоматических retry нет.** Ошибка пользовательского кода (exit code ≠ 0) → операция сразу `Failed`, исполнение графа останавливается.
- При этом незапущенные операции графа переводятся в `Cancelled`, run — в `Failed`; пользователь получает статус (WebSocket/SSE) и логи упавшей операции — этого достаточно, чтобы понять причину.
- **Единственный способ повторить — ручной re-run** узла (после исправления): операция возвращается в `Scheduled`, начинается новая попытка.
- Инфраструктурные сбои платформы (рестарт API/Orchestrator) статусов не меняют — состояние восстанавливается из БД (reconcile).
- K8s Job создаётся с `backoffLimit: 0` и `restartPolicy: Never` — один под на попытку, чтобы Kubernetes не делал скрытых ретраитов за нашей спиной.

## License

Проект распространяется под лицензией [Apache License 2.0](LICENSE).
