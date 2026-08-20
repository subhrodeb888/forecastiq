"""SQLAlchemy engine and session management for the ForecastIQ database.

The engine is created lazily and cached process-wide; it does not open a
connection until first use, so importing this module never requires a live
database.
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


def build_engine(settings: Settings) -> Engine:
    """Create a pooled SQLAlchemy engine from the application settings.

    ``pool_pre_ping`` keeps the pool healthy against stale connections
    (serverless PostgreSQL drops idle sockets).
    """
    return create_engine(
        settings.database_url,
        echo=settings.database_echo,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout,
        pool_pre_ping=True,
    )


@lru_cache
def get_engine() -> Engine:
    """Process-wide engine shared by every database reader/writer."""
    return build_engine(get_settings())


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    """Session factory bound to the shared engine."""
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope: commit on success, roll back on error, always close."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
