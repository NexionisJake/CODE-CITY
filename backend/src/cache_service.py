"""
Redis cache service. Falls back to in-memory dict if Redis is unavailable.
"""

import json
import os
import time
from typing import Optional

try:
    import redis
    _redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    _client = redis.from_url(_redis_url, decode_responses=True)
    _client.ping()
    REDIS_AVAILABLE = True
    print(f"[cache] Redis connected at {_redis_url}")
except Exception as e:
    print(f"[cache] Redis unavailable ({e}), using in-memory fallback")
    REDIS_AVAILABLE = False
    _client = None

# Fallback in-memory cache
_memory_cache: dict[str, str] = {}
_memory_timestamps: dict[str, float] = {}

CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "300"))  # 5 minutes default


def get_city(repo_url: str) -> Optional[dict]:
    """Get cached city data. Returns None if miss or expired."""
    key = f"codecity:v1:{repo_url}"
    
    try:
        if REDIS_AVAILABLE:
            raw = _client.get(key)
            if raw:
                print(f"[cache] REDIS HIT: {repo_url}")
                return json.loads(raw)
        else:
            raw = _memory_cache.get(key)
            if raw:
                age = time.time() - _memory_timestamps.get(key, 0)
                if age < CACHE_TTL:
                    print(f"[cache] MEMORY HIT: {repo_url} (age: {age:.0f}s)")
                    return json.loads(raw)
                else:
                    del _memory_cache[key]
    except Exception as e:
        print(f"[cache] Get error: {e}")
    
    return None


def set_city(repo_url: str, data: dict) -> None:
    """Store city data in cache with TTL."""
    key = f"codecity:v1:{repo_url}"
    serialized = json.dumps(data)
    
    try:
        if REDIS_AVAILABLE:
            _client.setex(key, CACHE_TTL, serialized)
            print(f"[cache] REDIS SET: {repo_url} (TTL: {CACHE_TTL}s)")
        else:
            _memory_cache[key] = serialized
            _memory_timestamps[key] = time.time()
            print(f"[cache] MEMORY SET: {repo_url}")
    except Exception as e:
        print(f"[cache] Set error: {e}")


def invalidate_city(repo_url: str) -> bool:
    """Delete cached city for a repo (called by webhook)."""
    key = f"codecity:v1:{repo_url}"
    
    try:
        if REDIS_AVAILABLE:
            deleted = _client.delete(key)
            print(f"[cache] REDIS DELETE: {repo_url} (found: {bool(deleted)})")
            return bool(deleted)
        else:
            if key in _memory_cache:
                del _memory_cache[key]
                print(f"[cache] MEMORY DELETE: {repo_url}")
                return True
    except Exception as e:
        print(f"[cache] Delete error: {e}")
    return False


def get_cache_stats() -> dict:
    """Return cache statistics for the health endpoint."""
    try:
        if REDIS_AVAILABLE:
            info = _client.info("memory")
            keys = _client.keys("codecity:v1:*")
            return {
                "backend":       "redis",
                "cached_repos":  len(keys),
                "memory_used":   info.get("used_memory_human", "unknown"),
                "redis_version": _client.info("server").get("redis_version", ""),
            }
        else:
            return {
                "backend":      "in-memory",
                "cached_repos": len(_memory_cache),
            }
    except Exception:
        return {"backend": "error"}
