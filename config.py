from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # -- LLM --
    # Required in all modes. The only API called during DEMO_MODE.
    ANTHROPIC_API_KEY: str

    # -- Intercom --
    # Required for live dispatch. Not needed when DEMO_MODE=true.
    INTERCOM_ACCESS_TOKEN: str = ""
    INTERCOM_WEBHOOK_SECRET: str = "demo_secret"
    INTERCOM_ADMIN_ID: str = ""

    # -- Slack --
    # Required for live escalation posting. Not needed in DEMO_MODE.
    SLACK_BOT_TOKEN: str = ""
    SLACK_ESCALATION_CHANNEL: str = "#nexus-alerts"

    # -- Coral sources --
    # Used by Coral Protocol CLI for live data source auth.
    # Not needed when DEMO_MODE=true - mock fixtures are used instead.
    SENTRY_ORG_SLUG: str = ""
    GITHUB_TOKEN: str = ""
    LINEAR_API_KEY: str = ""

    # -- Behaviour --
    # DEMO_MODE=true -> use mock JSON fixtures, skip all external API calls
    # except Anthropic. Set this to true for all local dev and demo day.
    DEMO_MODE: bool = False

    # Confidence below this triggers Slack escalation in dispatch_agent.
    CONFIDENCE_THRESHOLD: int = 70
    DATABASE_URL: str = "sqlite:///nexus.db"

    class Config:
        env_file = ".env"


settings = Settings()
