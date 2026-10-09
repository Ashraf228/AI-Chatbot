#!/usr/bin/env python3
"""Capacity diagnosis only. No application start, recovery verdict or artifact upload."""
import datetime
import hashlib
import http.client
import json
import math
import os
import pathlib
import platform
import re
import selectors
import signal
import socket
import subprocess
import sys
import time

GIB = 1024 ** 3
MIB = 1024 ** 2
MAX_OUTPUT = 8 * MIB
ALLOWED_EVENTS = {"preflight", "sample", "phase", "images", "storage", "finish", "process", "base", "data"}


class Reject(Exception):
    def __init__(self, code):
        self.code = code


def emit(event, **values):
    if event not in ALLOWED_EVENTS:
        raise Reject("LOG_SCHEMA")
    clean = {"event": event}
    for key, value in values.items():
        if not re.fullmatch(r"[a-z][a-z0-9_]*", key):
            raise Reject("LOG_SCHEMA")
        if value is None or isinstance(value, (bool, int)):
            clean[key] = value
        elif isinstance(value, float) and math.isfinite(value):
            clean[key] = round(value, 3)
        elif isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,150}", value):
            clean[key] = value
        else:
            raise Reject("LOG_SCHEMA")
    print(json.dumps(clean, sort_keys=True), flush=True)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def integer(value, code="BAD_METRIC"):
    if type(value) is not int or value < 0:
        raise Reject(code)
    return value


def validate_sources(root, rows):
    seen = set()
    for row in rows:
        name = row["path"]
        if name in seen or pathlib.PurePosixPath(name).is_absolute() or ".." in pathlib.PurePosixPath(name).parts:
            raise Reject("SOURCE_PATH")
        seen.add(name)
        p = root / name
        if not p.is_file() or any(x.is_symlink() for x in [p, *p.parents]):
            raise Reject("SOURCE_TYPE")
        data = p.read_bytes()
        if digest(data) != row["sha256"] or len(data) != row["bytes"]:
            raise Reject("SOURCE_HASH")
        if bool(p.stat().st_mode & 0o111) != (row["gitMode"] == "100755"):
            raise Reject("SOURCE_MODE")
    actual = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() or p.is_symlink()}
    if actual != seen:
        raise Reject("SOURCE_EXTRA")


def check_ci(env, event):
    if env.get("GITHUB_ACTIONS") != "true" or env.get("GITHUB_EVENT_NAME") != "workflow_dispatch":
        raise Reject("NOT_MANUAL_CI")
    if env.get("GITHUB_REPOSITORY") != "Ashraf228/AI-Chatbot" or event.get("repository", {}).get("private") is not False:
        raise Reject("NOT_PUBLIC_EXPECTED_REPOSITORY")
    if env.get("RUNNER_ENVIRONMENT") != "github-hosted" or env.get("RUNNER_OS") != "Linux" or env.get("RUNNER_ARCH") != "X64":
        raise Reject("NOT_STANDARD_NATIVE_RUNNER")
    if env.get("GITHUB_RUN_ATTEMPT") != "1" or not re.fullmatch(r"[0-9]+", env.get("GITHUB_RUN_ID", "")):
        raise Reject("RETRY_OR_BAD_RUN")
    if env.get("ACTIONS_STEP_DEBUG") == "true" or env.get("ACTIONS_RUNNER_DEBUG") == "true":
        raise Reject("DEBUG_NOT_ALLOWED")
    if event.get("inputs", {}).get("approval") != "CAPACITY_ONLY_ONCE":
        raise Reject("MISSING_APPROVAL")


class UnixHTTP(http.client.HTTPConnection):
    def __init__(self):
        super().__init__("localhost", timeout=5)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect("/var/run/docker.sock")


def engine_storage(timeout=5):
    c = UnixHTTP()
    c.timeout = timeout
    try:
        c.request("GET", "/v1.41/system/df")
        response = c.getresponse()
        raw = response.read(MAX_OUTPUT + 1)
        if response.status != 200 or len(raw) > MAX_OUTPUT:
            raise Reject("STORAGE_INSPECT")
        return json.loads(raw)
    finally:
        c.close()


def storage_metrics(data):
    keys = ("Images", "BuildCache", "Containers", "Volumes")
    if any(k not in data for k in keys):
        raise Reject("STORAGE_SCHEMA")
    images, cache, containers, volumes = [[] if data[k] is None else data[k] for k in keys]
    if any(not isinstance(x, list) for x in (images, cache, containers, volumes)):
        raise Reject("STORAGE_SCHEMA")
    def total(rows, key):
        numbers = [row.get(key) for row in rows]
        return sum(numbers) if all(type(n) is int and n >= 0 for n in numbers) else None
    usage = [v.get("UsageData") or {} for v in volumes]
    return dict(layers_bytes=integer(data.get("LayersSize")), images=len(images),
                virtual_image_bytes=total(images, "Size"), cache_records=len(cache),
                cache_reported_bytes=total(cache, "Size"), containers=len(containers),
                writable_bytes=total(containers, "SizeRw"), volumes=len(volumes), volume_bytes=total(usage, "Size"))


class Runner:
    def __init__(self, root, contract):
        self.root, self.contract = root, contract
        self.started = time.monotonic()
        # The first workflow step and this controller share the same VM boottime clock.
        consumed = time.clock_gettime(time.CLOCK_BOOTTIME) - float(os.environ["CAPACITY_STARTED_BOOTTIME"])
        if consumed < 0 or consumed > 900:
            raise Reject("CLOCK_BINDING")
        self.end = self.started + contract["limits"]["totalSeconds"] - consumed
        self.phase = "preflight"
        self.samples = 0
        self.min_free = None
        self.max_used = 0
        self.min_memory_available = None
        self.baseline_free = None
        self.last_log = -100.0
        self.created = []
        self.volumes = []
        self.images = {}
        self.cleanup_errors = 0
        self.aborted_child = False
        self.run_id = os.environ["GITHUB_RUN_ID"]
        self.prefix = "ssb-cap-" + self.run_id
        self.work = pathlib.Path(os.environ["RUNNER_TEMP"]) / self.prefix
        self.work.mkdir(mode=0o700)
        self.docker_config = self.work / "docker-config"
        self.docker_config.mkdir(mode=0o700)
        self.env = {"PATH": os.environ["PATH"], "HOME": str(self.work), "DOCKER_CONFIG": str(self.docker_config),
                    "DOCKER_BUILDKIT": "1", "BUILDX_NO_DEFAULT_ATTESTATIONS": "1", "CI": "true"}
        self.fs_paths = [pathlib.Path("/"), self.work, self.root]

    def sample(self, enforce=True, force_log=False):
        available = []
        for p in self.fs_paths:
            v = os.statvfs(p)
            available.append(v.f_bavail * v.f_frsize)
            if enforce and v.f_favail < self.contract["limits"]["minFreeInodes"]:
                raise Reject("LOW_INODES")
        free = min(available)
        self.samples += 1
        self.min_free = free if self.min_free is None else min(self.min_free, free)
        self.baseline_free = free if self.baseline_free is None else self.baseline_free
        self.max_used = max(self.max_used, self.baseline_free - free)
        memory = {}
        for line in pathlib.Path("/proc/meminfo").read_text().splitlines():
            k, value = line.split(":", 1)
            if k in ("MemAvailable", "MemTotal"):
                memory[k] = int(value.split()[0]) * 1024
        mem = memory.get("MemAvailable", 0)
        self.min_memory_available = mem if self.min_memory_available is None else min(mem, self.min_memory_available)
        if enforce and (free < self.contract["limits"]["stopFreeBytes"] or memory.get("MemAvailable", 0) < 512 * MIB):
            raise Reject("LOW_SPACE_OR_MEMORY")
        if force_log or time.monotonic() - self.last_log >= 10:
            emit("sample", phase=self.phase, free_bytes=free, min_free_bytes=self.min_free,
                 sampled_peak_delta_bytes=self.max_used, sample_count=self.samples,
                 memory_available_bytes=memory.get("MemAvailable"), min_memory_available_bytes=self.min_memory_available)
            self.last_log = time.monotonic()
        return free

    def command(self, args, deadline, cleanup=False):
        start = time.monotonic()
        effective = min(deadline, self.end if cleanup else self.end - 30)
        if effective <= start:
            raise Reject("DEADLINE")
        child = subprocess.Popen(args, cwd=self.root, env=self.env, stdin=subprocess.DEVNULL,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        selector = selectors.DefaultSelector()
        selector.register(child.stdout, selectors.EVENT_READ, "out")
        selector.register(child.stderr, selectors.EVENT_READ, "err")
        out, err, count = bytearray(), bytearray(), 0
        try:
            while selector.get_map() or child.poll() is None:
                if time.monotonic() >= effective:
                    raise Reject("COMMAND_TIMEOUT")
                self.sample(enforce=not cleanup)
                for key, _ in selector.select(0.25):
                    b = os.read(key.fileobj.fileno(), 65536)
                    if not b:
                        selector.unregister(key.fileobj)
                    else:
                        count += len(b)
                        if count > MAX_OUTPUT:
                            raise Reject("COMMAND_OUTPUT_LIMIT")
                        (out if key.data == "out" else err).extend(b)
            code = child.wait(timeout=1)
            emit("process", phase=self.phase, exit_code=code, milliseconds=int((time.monotonic()-start)*1000),
                 stdout_bytes=len(out), stderr_bytes=len(err), closed=True)
            if code != 0:
                raise Reject("COMMAND_NONZERO")
            return bytes(out)
        except BaseException:
            self.aborted_child = True
            try:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=min(2, max(0.1, self.end-time.monotonic())))
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    try:
                        child.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        self.cleanup_errors += 1
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            except ProcessLookupError:
                child.wait(timeout=1)
            raise
        finally:
            selector.close()
            child.stdout.close()
            child.stderr.close()

    def docker(self, args, seconds=10, deadline=None, cleanup=False):
        return self.command(["docker", "--host", "unix:///var/run/docker.sock", *args],
                            min(time.monotonic()+seconds, deadline or self.end), cleanup=cleanup)

    def snapshot(self):
        remaining = self.end - time.monotonic() - (0 if self.phase == "closure" else 30)
        if remaining <= 0:
            raise Reject("SNAPSHOT_DEADLINE")
        data = engine_storage(min(5, remaining))
        emit("storage", phase=self.phase, **storage_metrics(data))
        self.sample(enforce=self.phase != "closure", force_log=True)

    def inspect_image(self, reference, expected=None):
        data = json.loads(self.docker(["image", "inspect", reference]))
        if not isinstance(data, list) or len(data) != 1:
            raise Reject("IMAGE_SCHEMA")
        image = data[0]
        if image.get("Os") != "linux" or image.get("Architecture") != "amd64":
            raise Reject("IMAGE_PLATFORM")
        if expected is not None and image.get("Id") != expected:
            raise Reject("IMAGE_ID")
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", image.get("Id", "")) or not isinstance(image.get("Config"), dict):
            raise Reject("IMAGE_SCHEMA")
        if image["Config"].get("Volumes") not in (None, {}):
            raise Reject("UNEXPECTED_IMAGE_VOLUME")
        return image

    def bases(self):
        self.phase = "bases"
        for name, ref in self.contract["bases"].items():
            # Exactly one pinned pull per base; no tag fallback or platform substitution.
            self.docker(["pull", "--platform=linux/amd64", ref], seconds=120)
            image = self.inspect_image(ref)
            if ref not in image.get("RepoDigests", []):
                raise Reject("BASE_DIGEST")
            emit("base", name=name, id=image["Id"], platform="linux:amd64", size_bytes=integer(image.get("Size")))
            self.images[name] = image["Id"]
        self.snapshot()

    def container(self, name, image, mounts, command, user="1000:1000"):
        args = ["create", "--pull=never", "--name", self.prefix+"-"+name,
                "--label", "com.ssb.capacity-run="+self.run_id,
                "--network=none", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
                "--memory=256m", "--pids-limit=64", "--user", user,
                "--log-driver=json-file", "--log-opt=max-size=1m", "--log-opt=max-file=1"]
        for source, target in mounts:
            args += ["--mount", "type=volume,src="+source+",dst="+target]
        args += ["--entrypoint", command[0], image, *command[1:]]
        cid = self.docker(args).decode().strip()
        if not re.fullmatch(r"[0-9a-f]{64}", cid):
            raise Reject("CONTAINER_ID")
        self.created.append(cid)
        info = json.loads(self.docker(["inspect", cid]))[0]
        if info["Image"] != image or info["HostConfig"]["NetworkMode"] != "none" or info["HostConfig"].get("PortBindings"):
            raise Reject("CONTAINER_BINDING")
        return cid

    def build(self):
        self.phase = "builds"
        phase_end = min(time.monotonic()+270, self.end-30)
        for app in ("api", "dashboard", "reporter", "widget"):
            start = time.monotonic()
            spec = self.contract["builds"][app]
            iid = self.work / (app+".iid")
            args = ["build", "--platform=linux/amd64", "--pull=false", "--progress=plain",
                    "--network=default", "--iidfile", str(iid),
                    "--label", "com.ssb.capacity-run="+self.run_id,
                    "--build-arg", "APP_COMMIT_SHA=capacity-source-"+self.contract["sourceManifestSHA256"],
                    "--build-arg", "BUILD_COMMIT=capacity-source-"+self.contract["sourceManifestSHA256"],
                    "--build-arg", "BUILD_DATE=2026-10-05T00:00:00Z",
                    "-t", self.prefix+"-"+app+":diagnostic",
                    "-f", str(self.root/spec["dockerfile"]), str(self.root/spec["context"])]
            self.docker(args, seconds=270, deadline=phase_end)
            image = self.inspect_image(iid.read_text().strip())
            if app != "widget" and image["Config"].get("User") != "node":
                raise Reject("APPLICATION_UID")
            self.images[app] = image["Id"]
            emit("images", app=app, id=image["Id"], bytes=integer(image.get("Size")),
                 seconds=time.monotonic()-start, measured_sets=1, recovery_set_measured=False)
            self.snapshot()
        emit("phase", phase="builds", result="FOUR_CURRENT_IMAGES_MEASURED")

    def data_probe(self):
        self.phase = "synthetic_data"
        phase_end = min(time.monotonic()+60, self.end-30)
        for suffix in ("data", "state"):
            name = self.prefix+"-"+suffix
            self.docker(["volume", "create", "--label", "com.ssb.capacity-run="+self.run_id, name], deadline=phase_end)
            self.volumes.append(name)
        writer = self.container("volume-probe", self.images["node"],
            [(self.volumes[0], "/data"), (self.volumes[1], "/state")],
            ["node", "-e", (self.root/"synthetic-fill.cjs").read_text()], user="0:0")
        result = json.loads(self.docker(["start", "--attach", writer], seconds=60, deadline=phase_end))
        if result != {"synthetic": True, "dataBytes": 1073741824, "stateBytes": 67108864}:
            raise Reject("SYNTHETIC_RECEIPT")
        for app in ("api", "dashboard", "reporter", "widget"):
            cid = self.container("writable-"+app, self.images[app], [],
                                 ["/bin/sh", "-c", "dd if=/dev/zero of=/tmp/capacity-only.bin bs=1048576 count=128 conv=fsync"])
            self.docker(["start", "--attach", cid], seconds=15, deadline=phase_end)
        self.snapshot()
        for name in self.volumes:
            rows = json.loads(self.docker(["volume", "inspect", name]))
            if len(rows) != 1 or rows[0].get("Labels", {}).get("com.ssb.capacity-run") != self.run_id:
                raise Reject("VOLUME_BINDING")
            mount = rows[0]["Mountpoint"]
            if mount != "/var/lib/docker/volumes/"+name+"/_data":
                raise Reject("VOLUME_MOUNT")
            out = self.command(["sudo", "-n", "du", "-sx", "--block-size=1", mount], min(phase_end, time.monotonic()+5))
            emit("data", volume="data" if name.endswith("-data") else "state", allocated_bytes=int(out.split()[0]), synthetic=True)

    def cleanup(self):
        self.phase = "closure"
        for cid in self.created:
            try:
                state = json.loads(self.docker(["inspect", cid], seconds=3, cleanup=True))[0]
                if state.get("Config", {}).get("Labels", {}).get("com.ssb.capacity-run") != self.run_id:
                    raise Reject("CLEANUP_OWNERSHIP")
                if state["State"]["Running"]:
                    self.docker(["stop", "--time=1", cid], seconds=3, cleanup=True)
                state = json.loads(self.docker(["inspect", cid], seconds=3, cleanup=True))[0]["State"]
                if state["Running"]:
                    raise Reject("CONTAINER_STILL_RUNNING")
                emit("process", phase="closure", container_id=cid, exit_code=state["ExitCode"],
                     running=False, oom=bool(state.get("OOMKilled")), graceful_application_proof=False)
            except Exception:
                self.cleanup_errors += 1
        try:
            self.snapshot()
        except Exception:
            self.cleanup_errors += 1

    def execute(self):
        status = "INCOMPLETE"
        primary = None
        daemon_checked = False
        try:
            if platform.machine() != "x86_64":
                raise Reject("NOT_NATIVE_X64")
            if self.sample(force_log=True) < self.contract["limits"]["startFreeBytes"]:
                raise Reject("INSUFFICIENT_INITIAL_SPACE")
            info = json.loads(self.docker(["info", "--format", "{{json .}}"]));
            if info.get("OSType") != "linux" or info.get("Architecture") not in ("x86_64", "amd64") or info.get("DockerRootDir") != "/var/lib/docker":
                raise Reject("DAEMON_BINDING")
            stat = self.command(["sudo", "-n", "stat", "-c", "%d", "/var/lib/docker"], time.monotonic()+5)
            if int(stat.strip()) != pathlib.Path("/").stat().st_dev:
                raise Reject("UNMONITORED_DOCKER_FILESYSTEM")
            if self.docker(["ps", "-aq", "--no-trunc"]).strip():
                raise Reject("PREEXISTING_CONTAINER")
            if self.docker(["volume", "ls", "-q", "--filter", "name="+self.prefix]).strip():
                raise Reject("RESOURCE_COLLISION")
            daemon_checked = True
            emit("preflight", daemon_identity_sha256=digest(str(info.get("ID", "")).encode()),
                 cpus=integer(info.get("NCPU")), memory_bytes=integer(info.get("MemTotal")),
                 platform="linux:amd64", public_standard_runner=True)
            self.snapshot()
            self.bases()
            self.phase = "version_check"
            base = self.container("base-check", self.images["node"], [],
                ["node", "-e", 'console.log(JSON.stringify([process.version,require("child_process").execFileSync("npm",["--version"],{encoding:"utf8",timeout:3000}).trim()]))'])
            version = json.loads(self.docker(["start", "--attach", base]))
            if version != ["v24.17.0", "11.13.0"]:
                raise Reject("BASE_VERSION")
            emit("base", name="node_version", node=version[0], npm=version[1])
            self.build()
            self.data_probe()
            status = "CAPACITY_CURRENT_SET_MEASURED"
        except BaseException as error:
            primary = error.code if isinstance(error, Reject) else "INTERNAL_OR_SIGNAL"
        finally:
            if daemon_checked:
                try:
                    self.cleanup()
                except BaseException:
                    self.cleanup_errors += 1
            try:
                emit("finish", result=status if primary is None and not self.cleanup_errors else "CAPACITY_DIAGNOSIS_INCOMPLETE",
                 code=primary, cleanup_errors=self.cleanup_errors, created_containers=len(self.created),
                 created_volumes=len(self.volumes), sampled_peak_delta_bytes=self.max_used,
                 min_free_bytes=self.min_free, duration_seconds=time.monotonic()-self.started,
                 remaining_after_two_gib_reserve=max(0, (self.min_free or 0)-2*GIB),
                 aborted_command=self.aborted_child, daemon_build_cancellation_verified=not self.aborted_child,
                 recovery_set_measured=False, full_recovery_fit_proven=False, e1=False,
                     native_recovery=False, images_pushed=False, artifacts_uploaded=False)
            except BaseException:
                primary = primary or "PUBLIC_LOG_UNAVAILABLE"
        if primary is not None or self.cleanup_errors:
            raise Reject(primary or "CLOSURE_INCOMPLETE")


def main():
    root = pathlib.Path(__file__).resolve().parent
    event = json.loads(pathlib.Path(os.environ.get("GITHUB_EVENT_PATH", "/nonexistent")).read_text())
    check_ci(os.environ, event)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda _sig, _frame: (_ for _ in ()).throw(Reject("CANCELLED")))
    contract = json.loads((root/"contract.json").read_text())
    validate_sources(root/"source", json.loads((root/"source-manifest.json").read_text()))
    runner = Runner(root, contract)
    runner.execute()


if __name__ == "__main__":
    try:
        main()
    except Reject as e:
        emit("finish", result="CAPACITY_DIAGNOSIS_ABORTED", code=e.code, e1=False, recovery=False)
        sys.exit(1)
    except BaseException:
        emit("finish", result="CAPACITY_DIAGNOSIS_ABORTED", code="INTERNAL_OR_SIGNAL", e1=False, recovery=False)
        sys.exit(1)
