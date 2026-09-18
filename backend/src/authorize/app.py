"""HTTP entry point for the PromptFence API Lambda.

Everything lives in common/authorize.py, which the agent Lambda imports too;
this module only exists so the packaged handler is `app.handler`.
"""

from authorize import *  # noqa: F401,F403  (re-exported for the API bundle and tests)
from authorize import handler  # noqa: F401
