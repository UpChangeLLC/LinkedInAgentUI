"""Circuit breaker for LLM provider calls.

Prevents cascading failures by fast-failing requests after consecutive errors.
States:
  - closed: Normal operation, requests pass through
  - open: Fast-fail all requests with ServiceUnavailableError
  - half-open: Allow one test request through to check recovery
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


class ServiceUnavailableError(RuntimeError):
    """Raised when the circuit breaker is open (service unavailable)."""
    pass


class CircuitBreaker:
    """Simple circuit breaker with three states: closed, open, half-open."""

    def __init__(
        self,
        failure_threshold: int = 3,
        reset_timeout: float = 60.0,
        name: str = "default",
    ):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.name = name
        self._failures = 0
        self._state = "closed"
        self._last_failure_time: float = 0

    @property
    def state(self) -> str:
        if self._state == "open" and self._time_since_failure > self.reset_timeout:
            return "half-open"
        return self._state

    @property
    def _time_since_failure(self) -> float:
        return time.monotonic() - self._last_failure_time

    async def call(self, func, *args, **kwargs):
        """Execute func through the circuit breaker."""
        current_state = self.state

        if current_state == "open":
            logger.warning(
                "Circuit breaker '%s' is OPEN — fast-failing request "
                "(failures=%d, reset in %.0fs)",
                self.name,
                self._failures,
                max(0, self.reset_timeout - self._time_since_failure),
            )
            raise ServiceUnavailableError(
                f"AI analysis temporarily unavailable. "
                f"The service will retry automatically in {int(max(0, self.reset_timeout - self._time_since_failure))}s."
            )

        if current_state == "half-open":
            logger.info("Circuit breaker '%s' is HALF-OPEN — testing recovery", self.name)

        try:
            result = await func(*args, **kwargs)
            # Success — reset the breaker
            if self._state != "closed":
                logger.info("Circuit breaker '%s' recovered — closing circuit", self.name)
            self._failures = 0
            self._state = "closed"
            return result
        except Exception as exc:
            self._failures += 1
            self._last_failure_time = time.monotonic()
            if self._failures >= self.failure_threshold:
                self._state = "open"
                logger.error(
                    "Circuit breaker '%s' OPENED after %d consecutive failures",
                    self.name,
                    self._failures,
                )
            raise exc


# Singleton breaker for LLM provider calls
llm_breaker = CircuitBreaker(
    failure_threshold=3,
    reset_timeout=60.0,
    name="llm_provider",
)
