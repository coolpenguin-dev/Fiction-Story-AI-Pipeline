"""Retries for transient OpenAI API failures (connection, timeout, 5xx)."""

import os
import time
from typing import Any, Callable, TypeVar

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)

T = TypeVar("T")

_RETRYABLE = (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)


def openai_max_retries() -> int:
    return max(1, int(os.getenv("OPENAI_MAX_RETRIES", "3")))


def openai_retry_base_seconds() -> float:
    return max(0.5, float(os.getenv("OPENAI_RETRY_BASE_SECONDS", "2")))


def call_with_retry(fn: Callable[[], T], *, label: str = "OpenAI request") -> T:
    """Run fn with exponential backoff on transient API errors."""
    max_retries = openai_max_retries()
    base_delay = openai_retry_base_seconds()
    last_exc: BaseException | None = None

    for attempt in range(max_retries):
        try:
            return fn()
        except _RETRYABLE as e:
            last_exc = e
            if attempt >= max_retries - 1:
                raise
            delay = base_delay * (2**attempt)
            if isinstance(e, RateLimitError):
                delay = max(delay, 5.0)
            time.sleep(delay)

    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"{label} failed with no exception")


def is_connection_error(exc: BaseException) -> bool:
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return True
    msg = str(exc).lower()
    return "connection error" in msg or "timed out" in msg or "timeout" in msg


def format_analysis_error(exc: BaseException) -> str:
    """User-facing analysis error (no filename — batch UI adds file name)."""
    if is_connection_error(exc):
        return (
            "Could not reach OpenAI (network timeout or connection dropped). "
            "Retry this file. If it happens with multiple uploads, set "
            "ANALYZE_BATCH_CONCURRENCY=1 in backend/.env."
        )
    return f"Analysis failed: {exc}"
