import os
import subprocess

import modal


APP_NAME = "focus-pet-cloud"
CLOUD_PORT = 47821
DATA_MOUNT = "/data"
DATA_DIR = f"{DATA_MOUNT}/focus-pet-cloud"


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
    return any(part in ignored_names for part in path.parts)


app = modal.App("focus-pet-cloud")

data_volume = modal.Volume.from_name("focus-pet-cloud-data", create_if_missing=True)

image = (
    modal.Image.from_registry("node:22-slim", add_python="3.12")
    .add_local_dir(".", "/app", copy=True, ignore=ignore_local_path)
    .run_commands("cd /app && npm ci --omit=dev")
)


@app.function(
    image=image,
    volumes={DATA_MOUNT: data_volume},
    env={
        "FOCUS_PET_CLOUD_HOST": "0.0.0.0",
        "FOCUS_PET_CLOUD_PORT": str(CLOUD_PORT),
        "FOCUS_PET_CLOUD_DATA_DIR": DATA_DIR,
    },
    min_containers=1,
    max_containers=1,
    timeout=86400,
)
@modal.concurrent(max_inputs=200)
@modal.web_server(47821, startup_timeout=30)
def cloud():
    env = os.environ.copy()
    subprocess.Popen(["npm", "run", "cloud:serve"], cwd="/app", env=env)
