# ForecastIQ ML Service

Production-ready FastAPI microservice that powers demand forecasting for the
ForecastIQ platform. The Next.js app posts a product's daily sales history;
the service returns a per-day demand forecast with prediction intervals and a
confidence score — matching the shape of the `forecasts` table
(`forecastDate`, `predictedDemand`, `confidenceScore`).

The forecasting API is **stateless**; an optional **data pipeline** loads and
preprocesses sales history directly from the ForecastIQ PostgreSQL database
(SQLAlchemy + psycopg) for training and batch workloads.

## Features

- **Automatic model selection** — moving average, linear trend with seasonal
  dummies, and additive Holt-Winters exponential smoothing are ranked by
  expanding-window backtest accuracy (sMAPE); the winner is refitted on the
  full history.
- **Data pipeline** — PostgreSQL sales loading, validation/cleaning with a
  full audit report, daily aggregation per product, gap-free calendar
  reindexing (zero-filled), leakage-safe feature engineering (calendar, lag,
  rolling, expanding), and chronological train/test splits.
- **Model training** — a Random Forest regressor per product, evaluated on a
  chronological holdout (MAE/RMSE/R²), persisted with joblib alongside its
  metrics and preprocessing contract; driven by a CLI (`make train`).
- **Prediction API** — trained models are loaded once at startup and served
  from memory; `POST /predict` recursively forecasts future demand from
  recent history, with intervals, holdout metrics, and a confidence score.
- **Prediction intervals & confidence** — intervals widen with lead time;
  confidence (0–100) derives from backtest residual dispersion.
- **Consistent error envelope** — every failure path returns
  `{ "error": { code, message, details }, "request_id" }`.
- **Request correlation** — `X-Request-ID` is honored/generated, echoed on
  responses, and attached to every log line.
- **Structured logging** — console format locally, JSON logs in production.
- **Ops-ready** — liveness/readiness probes, gzip, CORS, docs auto-disabled
  in production.

## Project layout

```
ml-service/
├── main.py                  # ASGI entrypoint (uvicorn main:app / python main.py)
├── requirements.txt         # pinned runtime dependencies
├── requirements-dev.txt     # test/lint tooling
├── pyproject.toml           # pytest + ruff configuration
├── Makefile                 # setup / dev / start / test / lint / clean
├── .env.example             # documented environment variables
├── app/
│   ├── main.py              # create_app() factory + lifespan
│   ├── core/                # config (env vars), logging, exceptions, database
│   ├── api/                 # deps, middleware, error handlers
│   │   └── v1/
│   │       ├── router.py
│   │       └── endpoints/   # health.py, forecast.py, predict.py
│   ├── schemas/             # pydantic request/response contracts
│   ├── services/            # forecasting, prediction, shared point building
│   ├── pipeline/            # loader, cleaning, preprocessing, features, service
│   ├── training/            # trainer, artifact store, TrainingService, CLI
│   ├── models/              # ForecastModel impls, backtesting, registry
│   └── utils/               # series preparation, accuracy metrics
├── scripts/
│   ├── setup.sh             # venv creation + dependency install
│   ├── run.sh               # run from the venv (--dev for reload)
│   └── train.py             # CLI: train models from PostgreSQL sales
└── tests/                   # pytest suite (in-process TestClient)
```

## Quickstart

```bash
cd ml-service
make setup-dev        # creates .venv, installs deps, seeds .env
make dev              # http://localhost:8000/docs (auto-reload)
```

Or manually:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

Run the checks:

```bash
make test
make lint
```

## Configuration

All settings come from environment variables (or `.env`); see
[.env.example](.env.example) for the full list. Highlights:

| Variable              | Default                 | Purpose                                   |
| --------------------- | ----------------------- | ----------------------------------------- |
| `ENVIRONMENT`         | `development`           | `production` enables JSON logs, hides docs |
| `HOST` / `PORT`       | `0.0.0.0` / `8000`      | Bind address for `python main.py`          |
| `CORS_ORIGINS`        | `http://localhost:3000` | Comma-separated allowed origins            |
| `LOG_LEVEL`           | `INFO`                  | Root log level                             |
| `DEFAULT_HORIZON_DAYS`| `30`                    | Horizon when the request omits one         |
| `MAX_HORIZON_DAYS`    | `90`                    | Hard cap; larger requests are rejected     |
| `MIN_HISTORY_POINTS`  | `8`                     | Minimum observations required              |
| `DEFAULT_SEASON_LENGTH` | `7`                   | Weekly seasonality                         |
| `DATABASE_URL`        | local Postgres          | ForecastIQ database (driver auto-added)    |
| `DEFAULT_TEST_FRACTION` | `0.2`                 | Chronological holdout share per product    |
| `OUTLIER_IQR_MULTIPLIER` | `3.0`                | IQR fence for winsorizing extreme days     |
| `MODEL_ARTIFACTS_DIR` | `artifacts`             | Root for trained models/metrics            |
| `TRAINING_N_ESTIMATORS` | `300`                 | Random Forest size                         |

## Data pipeline

`DataPipelineService` turns raw PostgreSQL sales into model-ready datasets.
Stages (each also usable standalone): `SalesDataLoader` →
`clean_daily_sales`/`aggregate_daily` → `reindex_daily_sales` →
`build_features` → `train_test_split`.

```python
from app.core.config import get_settings
from app.pipeline.service import DataPipelineService

pipeline = DataPipelineService.from_settings(get_settings())
result = pipeline.prepare_dataset("3f6b2c90-7d0f-4b6d-9d4f-9c2d2c9f4b31", test_days=14)

result.daily      # gap-free daily frame: product_id, sale_date, quantity
result.features   # calendar + lag + rolling/expanding predictors, no leakage
result.split      # chronological train/test partition of the feature frame
result.series     # zero-filled numpy demand series (to_daily_series semantics)
result.cleaning   # audit report: dropped/merged/clipped row counts
```

The pipeline reads the web app's `sale_items` ⨝ `sales` tables, so it needs
`DATABASE_URL` pointing at the same PostgreSQL database. Days without a
recorded sale are treated as zero demand, matching the sales ledger.

## Model training

`TrainingService` composes the data pipeline with a Random Forest trainer:
metrics come from the chronological holdout, then the persisted estimator is
refit on all rows. Random Forest is a deliberate upgrade over the statistical
baselines — it exploits the engineered calendar/lag/rolling predictors,
captures non-linear effects, needs no feature scaling, and tolerates
zero-inflated demand.

```bash
make train ARGS="--all"                                     # every product with sales
make train ARGS="<product-id> --test-days 14"               # one product, 14-day holdout
.venv/bin/python scripts/train.py --all --test-fraction 0.25
```

Each run writes, per product, under `MODEL_ARTIFACTS_DIR/<product_id>/`:

- `model.joblib` — the fitted estimator (joblib);
- `metrics.json` — holdout MAE/RMSE/R², row counts, library versions;
- `features.json` — the preprocessing contract (feature columns, lag/rolling
  spec, training window, cleaning audit) needed to rebuild inputs at
  inference time.

Exit codes: `0` all trained, `1` at least one failure, `2` usage error.
Failures for individual products are logged and do not stop the batch.

## API

Base path: `/api/v1`. Interactive docs at `/docs` (non-production).

| Method | Path                 | Description                     |
| ------ | -------------------- | ------------------------------- |
| GET    | `/health`            | Liveness probe                  |
| GET    | `/health/ready`      | Readiness probe (model registry)|
| GET    | `/forecasts/models`  | List forecasting models         |
| POST   | `/forecasts`         | Generate a demand forecast      |
| POST   | `/predict`           | Predict with the trained model  |

### `POST /predict`

Serves the persisted Random Forest for a product (train first with
`make train`). The request mirrors `POST /forecasts` — recent daily sales
history (`>=` the feature warm-up window, 28 days by default) — and the
service rebuilds the training-time features recursively per future day.

```bash
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "3f6b2c90-7d0f-4b6d-9d4f-9c2d2c9f4b31",
    "horizon_days": 7,
    "history": [{"date": "2026-06-07", "quantity": 24}, ...]
  }'
```

```json
{
  "product_id": "3f6b2c90-7d0f-4b6d-9d4f-9c2d2c9f4b31",
  "model": "random_forest",
  "horizon_days": 7,
  "generated_at": "2026-06-08T09:00:00.000000Z",
  "points": [
    {"date": "2026-06-09", "predicted_demand": 26, "lower_bound": 21, "upper_bound": 31}
  ],
  "metrics": {"mae": 1.83, "rmse": 2.47, "r2": 0.91, "confidence_score": 88.6,
              "trained_at": "2026-06-08T07:00:00.000000Z"}
}
```

Unknown products return 404 `model_not_found`; fewer history days than the
feature warm-up window return 422 `validation_error`.

### Example

```bash
curl -X POST http://localhost:8000/api/v1/forecasts \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "3f6b2c90-7d0f-4b6d-9d4f-9c2d2c9f4b31",
    "horizon_days": 14,
    "history": [
      {"date": "2026-05-25", "quantity": 12},
      {"date": "2026-05-26", "quantity": 15}
    ]
  }'
```

```json
{
  "product_id": "3f6b2c90-7d0f-4b6d-9d4f-9c2d2c9f4b31",
  "model": "holt_winters",
  "horizon_days": 14,
  "season_length": 7,
  "generated_at": "2026-06-08T08:30:00.000000Z",
  "points": [
    {"date": "2026-06-09", "predicted_demand": 18, "lower_bound": 11, "upper_bound": 25}
  ],
  "metrics": {"mae": 2.41, "smape": 11.7, "confidence_score": 84.2}
}
```

Notes on semantics:

- `history` needs at least `MIN_HISTORY_POINTS` entries with unique dates;
  missing days are treated as zero demand (matching the sales ledger).
- `model` may be `auto` (default), `moving_average`, `linear_trend`, or
  `holt_winters`.
- `include_intervals: false` returns `null` bounds.

## Integration with the Next.js app

The web app should aggregate `sale_items` per day for a product and POST them
to `POST /api/v1/forecasts`, then persist the returned points into the
`forecasts` table. Set `ML_SERVICE_URL=http://localhost:8000` in the web
app's environment and forward the incoming `X-Request-ID` header for
end-to-end tracing. (Web app wiring is intentionally out of scope here.)

## Production

```bash
ENVIRONMENT=production LOG_JSON=true .venv/bin/uvicorn main:app \
  --host 0.0.0.0 --port 8000 --workers 2
```

Docs are hidden and logs are JSON in production. `/api/v1/health` and
`/api/v1/health/ready` are safe targets for load-balancer and Kubernetes
probes.
