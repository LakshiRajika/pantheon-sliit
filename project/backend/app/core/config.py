"""Application configuration loaded from environment variables and `.env`, exposed as a cached Settings singleton."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Pantheon"
    app_env: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30

    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"

    google_api_key: str | None = None
    gemini_model: str = "gemini-flash-latest"

    openrouter_api_key: str | None = None
    openrouter_model: str = "openrouter/free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 20

    cors_origins: str = "http://localhost:5173"

    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        """Split the comma-separated `cors_origins` string into a list of trimmed origin URLs."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide Settings instance, constructing it once and caching it for subsequent calls."""
    return Settings()
