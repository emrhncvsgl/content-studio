# Kaggle çekirdeği (tools/kaggle_voice.py doldurur ve gönderir): paketi aç, synth.py'yi T4'te çalıştır, sonucu zip'le.
# Colab not defterinin (voice/colab/voice_colab.ipynb) tarayıcısız karşılığı; çıktı /kaggle/working/voice_<bölüm>.<dil>.zip.
import base64, glob, io, json, os, subprocess, sys, time, zipfile

BUNDLE = "__BUNDLE_B64__"
t0 = time.time()


def sh(cmd):
    print("$", cmd, flush=True)
    subprocess.run(cmd, shell=True, check=True)


sh("nvidia-smi --query-gpu=name,memory.total --format=csv")
work = "/tmp/cs"
os.makedirs(work, exist_ok=True)
os.chdir(work)
zipfile.ZipFile(io.BytesIO(base64.b64decode(BUNDLE))).extractall(work)
m = json.load(open("colab_manifest.json"))
print("[bölüm]", m["episode"], m["lang"], m["extra_args"], flush=True)

# motor profilden: voxcpm2_torch → VoxCPM (sabit commit, R3'te denendi); diğerleri chatterbox
sh("pip install -q pyyaml")
import yaml  # noqa: E402
voice = json.load(open(m["script"]))["voice"]
_ea = (m.get("jobs") or [{"extra_args": m["extra_args"]}])[0]["extra_args"]
if "--voice" in _ea:   # deneme profili (colab_voice.pack onu pakete koyar); işlerin hepsi aynı motoru kullanmalı
    voice = _ea[_ea.index("--voice") + 1]
engine = yaml.safe_load(open(f"voice/profiles/{voice}.yaml"))["engines"][m["lang"]]
print("[motor]", voice, engine, flush=True)
if engine == "voxcpm2_torch":
    sh("pip install -q 'voxcpm @ git+https://github.com/OpenBMB/VoxCPM@f0c787f0937dc1c9a8f4f64d9a332d9c5da2e629' soundfile "
       "2>&1 | grep -v 'dependency resolver\\|requires\\|^$' || true")
else:
    sh("pip install -q chatterbox-tts==0.1.7 2>&1 | grep -v 'dependency resolver\\|requires\\|^$' || true")
    sh("pip uninstall -y -q torchvision || true")  # hazır torchvision torch 2.6 ile uyuşmuyor (Colab'daki gibi)
print(f"[kurulum] {time.time() - t0:.0f}s", flush=True)

# İşler: tek iş (extra_args) ya da m["jobs"] (2026-11-08): Kaggle T4 × 2, her iş kendi GPU'sunda paralel (CUDA_VISIBLE_DEVICES)
jobs = m.get("jobs") or [{"extra_args": m["extra_args"], "out": m["out"]}]
ngpu = max(1, len(subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True).stdout.strip().splitlines()))
procs = []
for i, j in enumerate(jobs):
    env = {**os.environ, "CUDA_VISIBLE_DEVICES": str(i % ngpu)}
    log = open(f"/kaggle/working/job{i}.log", "w")
    print(f"[iş {i}] GPU {i % ngpu}: {j['extra_args']}", flush=True)
    procs.append((i, subprocess.Popen([sys.executable, "-W", "ignore", "voice/synth.py", m["script"], "--device", "cuda", "--no-asr",
                                       *j["extra_args"]], env=env, stdout=log, stderr=subprocess.STDOUT), log))
    if (i + 1) % ngpu == 0:   # GPU sayısından fazla iş varsa sırayla
        for _, p, _ in procs[-ngpu:]:
            p.wait()
bad = []
for i, p, log in procs:
    p.wait(); log.close()
    tail = open(f"/kaggle/working/job{i}.log").read().splitlines()[-3:]
    print(f"[iş {i}] kod {p.returncode} | " + " | ".join(tail), flush=True)
    if p.returncode != 0:
        bad.append(i)

zp = f"/kaggle/working/voice_{m['episode']}.{m['lang']}.zip"
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for j in jobs:
        for f in glob.glob(j["out"] + "/**", recursive=True):
            if os.path.isfile(f) and not f.endswith("narration.wav"):  # anlatım Mac'te kapıdan sonra yazılır
                z.write(f)
    z.write("colab_manifest.json")
print(f"[toplam] {time.time() - t0:.0f}s → {zp}", flush=True)
if bad:
    sys.exit(f"synth.py hata: işler {bad}")
