import os
import subprocess

import modal


APP_NAME = "focus-pet-cloud"
CLOUD_PORT = 47821
DATA_MOUNT = "/data"
DATA_DIR = f"{DATA_MOUNT}/focus-pet-cloud"
STEPFUN_SECRET_NAME = "focus-pet-cloud-stepfun"
TURN_SECRET_NAME = "focus-pet-cloud-turn"


def ignore_local_path(path):
    ignored_names = {
        ".DS_Store",
        ".git",
        ".modal",
        "dist",
        "node_modules",
        "out",
        "tmp",
        "release",
    }
    ignored_paths = {
        ("docs", "errorThing.md"),
    }
    parts = tuple(path.parts)
    return any(part in ignored_names for part in parts) or any(parts[-len(item):] == item for item in ignored_paths)


app = modal.App("focus-pet-cloud")

data_volume = modal.Volume.from_name("focus-pet-cloud-data", create_if_missing=True)
modal_secrets = [
    modal.Secret.from_name(STEPFUN_SECRET_NAME),
    modal.Secret.from_name(TURN_SECRET_NAME),
]
cloud_env = {
    "FOCUS_PET_CLOUD_HOST": "0.0.0.0",
    "FOCUS_PET_CLOUD_PORT": str(CLOUD_PORT),
    "FOCUS_PET_CLOUD_DATA_DIR": DATA_DIR,
}

for key in (
    "FOCUS_PET_CLOUD_PUBLIC_URL",
    "FOCUS_PET_CLOUD_RTC_ICE_SERVERS",
    "FOCUS_PET_CLOUD_SCREEN_LLM_ENDPOINT",
    "FOCUS_PET_CLOUD_STEPFUN_ENDPOINT",
    "FOCUS_PET_CLOUD_SCREEN_LLM_MODEL",
    "FOCUS_PET_CLOUD_SCREEN_CHECK_RATE_LIMIT_MAX",
):
    if os.environ.get(key):
        cloud_env[key] = os.environ[key]

image = (
    modal.Image.from_registry("node:22-slim", add_python="3.12")
    .add_local_dir(".", "/app", copy=True, ignore=ignore_local_path)
    .run_commands("cd /app && npm ci --omit=dev")
)


@app.function(
    image=image,
    volumes={DATA_MOUNT: data_volume},
    env=cloud_env,
    secrets=modal_secrets,
    min_containers=1,
    max_containers=1,
    timeout=86400,
)
@modal.concurrent(max_inputs=200)
@modal.web_server(47821, startup_timeout=30)
def cloud():
    env = os.environ.copy()
    subprocess.Popen(["npm", "run", "cloud:serve"], cwd="/app", env=env)
