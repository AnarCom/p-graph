# p-graph

> Платформа для описания и выполнения вычислительных pipeline в виде ориентированного графа (DAG) с запуском операций на Kubernetes.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-minikube-326CE5?logo=kubernetes&logoColor=white)](https://minikube.sigs.k8s.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![MinIO](https://img.shields.io/badge/MinIO-S3%20артефакты-C72E49?logo=minio&logoColor=white)](https://min.io)

## Общая карта компонентов

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

    subgraph K8s["Kubernetes (minikube)"]
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

## Структура репозитория

Монорепозиторий: Go-модуль в корне, инфраструктура — `deploy/`. Пустые каталоги каркаса содержат `.gitkeep` (git не трекает пустые директории) — файлы удаляются по мере появления кода.

```
p-graph/
├── cmd/                        # точки входа (по сервису на каталог)
│   ├── apiserver/              #   API Server: REST + WebSocket/SSE
│   └── orchestrator/           #   Orchestrator: планировщик, K8s watch
├── internal/
│   ├── model/                  # доменные типы: Pipeline, Run, Operation, статусы
│   ├── api/                    # HTTP-хендлеры API Server
│   ├── orchestrator/           # ядро исполнения: планирование run'ов
│   ├── storage/                # PostgreSQL: доступ к данным
│   ├── migrator/               # применение миграций БД
│   ├── artifacts/              # S3/MinIO клиент: artifacts/{run_id}/{node_id}, логи
│   └── k8s/                    # создание Job, watch, сбор логов Pod'ов
├── migrations/                 # SQL-миграции, схема БД меняется только через них
├── deploy/
│   ├── docker/                 # Dockerfiles сервисов
│   └── k8s/                    # манифесты кластера: каталог = приложение
│       ├── postgres/           #   БД (deployment, service, pvc)
│       ├── minio/              #   S3-хранилище (deployment, service, ingress)
│       ├── apiserver/          #   API Server (deployment, service, ingress)
│       ├── orchestrator/       #   Orchestrator (deployment, service, rbac)
│       └── argo/               #   Argo (ingress, configmap)
├── go.mod                      # module github.com/AnarCom/p-graph
├── CLAUDE.md                   # соглашения проекта
├── LICENSE                     # Apache License 2.0
└── README.md
```

## Локальный запуск (minikube)

Требуется: [minikube](https://minikube.sigs.k8s.io/docs/start/), `kubectl`, драйвер docker.

```bash
# 1. Поднять кластер с ingress-контроллером (один раз)
minikube start --driver=docker
minikube addons enable ingress

# 2. Собрать образ apiserver и загрузить его в minikube
docker build -f deploy/docker/apiserver/Dockerfile -t pgraph-apiserver:v1 .
minikube image load pgraph-apiserver:v1

# 3. Применить все манифесты (namespace pgraph)
kubectl apply -k deploy/k8s

# 4. Проверить, что всё поднялось
kubectl get pods -n pgraph

# 5. Подключиться к PostgreSQL (порт кластера напрямую недоступен на macOS)
kubectl port-forward svc/postgres 5432:5432 -n pgraph
psql -h 127.0.0.1 -U pgraph -d pgraph

# 6. Для доступа к консоли minio
echo "127.0.0.1 minio.local" | sudo tee -a /etc/hosts > /dev/null # добавляем локальную DNS запись
sudo minikube tunnel
curl http://minio.local

# 7. Для доступа к argo
echo "127.0.0.1 minio.local" | sudo tee -a /etc/hosts > /dev/null
curl http://argo.local

# 8. Чтобы запустить workflow
создать argo-bucket
в argo интерфейсе запустить workflow
```

## Жизненный цикл запуска pipeline

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

## Машина состояний операции

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
