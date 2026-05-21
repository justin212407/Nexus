from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM - required in all modes
    ANTHROPIC_API_KEY: str = ""

    # Intercom - required for live dispatch
    INTERCOM_ACCESS_TOKEN: str = ""
    INTERCOM_ADMIN_ID: str = ""
    INTERCOM_WEBHOOK_SECRET: str = "demo_secret"

    # Slack - required for live escalation
    SLACK_BOT_TOKEN: str = ""
    SLACK_ESCALATION_CHANNEL: str = "#nexus-alerts"

    # Coral sources - required for live mode
    SENTRY_ORG_SLUG: str = ""
    GITHUB_TOKEN: str = ""
    LINEAR_API_KEY: str = ""

    # Behaviour
    DEMO_MODE: bool = False
    CONFIDENCE_THRESHOLD: int = 70
    DATABASE_URL: str = "sqlite:///nexus.db"

    class Config:
        env_file = ".env"


settings = Settings()
