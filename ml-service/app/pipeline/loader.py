"""Reads raw sales line items from the ForecastIQ PostgreSQL database."""

import logging
from datetime import date

import pandas as pd
from sqlalchemy import Engine, text

from app.core.exceptions import DataLoadingError
from app.pipeline.schemas import DAILY_COLUMNS

logger = logging.getLogger(__name__)

# Mirrors the Drizzle schema (db/schema.ts): ``sale_items`` carries the
# quantity and product reference, ``sales`` carries the sale date. Column
# identifiers are quoted because Drizzle uses camelCase names.
_BASE_QUERY = """
SELECT
    si."productId"::text AS product_id,
    s."saleDate"::date   AS sale_date,
    si.quantity          AS quantity
FROM sale_items AS si
JOIN sales AS s ON s.id = si."saleId"
WHERE si.quantity IS NOT NULL
  AND s."saleDate" IS NOT NULL
"""

_PRODUCTS_QUERY = """
SELECT DISTINCT si."productId"::text AS product_id
FROM sale_items AS si
ORDER BY product_id
"""


class SalesDataLoader:
    """Pulls raw sales line items out of PostgreSQL.

    Aggregation, cleaning, and reindexing deliberately happen downstream in
    the pipeline, so invalid rows can be inspected and reported before they
    are merged into a daily grain.
    """

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def load_line_items(
        self,
        *,
        product_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> pd.DataFrame:
        """Fetch line items (not yet aggregated) at a day grain.

        Returns a frame with ``product_id``, ``sale_date``, ``quantity``
        columns — empty (with those columns) when nothing matches. Database
        failures are wrapped in :class:`DataLoadingError`.
        """
        sql, params = self._build_query(
            product_id=product_id, start_date=start_date, end_date=end_date
        )
        try:
            frame = pd.read_sql_query(text(sql), self._engine, params=params)
        except Exception as exc:
            raise DataLoadingError(
                "failed to load sales history from PostgreSQL", details=str(exc)
            ) from exc
        if frame.empty:
            return pd.DataFrame(columns=DAILY_COLUMNS)
        logger.info(
            "loaded %d sales line items (product=%s, start=%s, end=%s)",
            len(frame),
            product_id or "all",
            start_date or "-",
            end_date or "-",
        )
        return frame

    def load_product_ids(self) -> list[str]:
        """Distinct product ids that have at least one recorded sale."""
        try:
            frame = pd.read_sql_query(text(_PRODUCTS_QUERY), self._engine)
        except Exception as exc:
            raise DataLoadingError(
                "failed to list products with sales history", details=str(exc)
            ) from exc
        return frame["product_id"].tolist()

    @staticmethod
    def _build_query(
        *,
        product_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[str, dict[str, object]]:
        """Assemble the filtered query and its bound parameters."""
        clauses: list[str] = []
        params: dict[str, object] = {}
        if product_id is not None:
            clauses.append('si."productId" = CAST(:product_id AS uuid)')
            params["product_id"] = product_id
        if start_date is not None:
            clauses.append('s."saleDate"::date >= :start_date')
            params["start_date"] = start_date.isoformat()
        if end_date is not None:
            clauses.append('s."saleDate"::date <= :end_date')
            params["end_date"] = end_date.isoformat()
        sql = _BASE_QUERY
        if clauses:
            sql += "  AND " + "\n  AND ".join(clauses) + "\n"
        return sql, params
