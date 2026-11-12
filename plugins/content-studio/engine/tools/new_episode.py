"""Yeni bölüm klasörü + brief.yaml oluşturur (kanal varsayılanlarıyla). /shorts röportajının sonunda çağrılır.

Kullanım:
  voice/.venv-chatterbox/bin/python tools/new_episode.py --source 02 [--series <id>] [--lang en] [--format short] [--style auto] [--voice <profil>]
  voice/.venv-chatterbox/bin/python tools/new_episode.py --topic "Velcro nasıl icat edildi" --slug velcro [...]
  voice/.venv-chatterbox/bin/python tools/new_episode.py --channel inyourhand --topic "..." --slug promo   # başka kanal (tools/channel.py)
Bölüm numarası content/episodes altındaki en büyük <önek> numarasının bir fazlasıdır.
--source: serinin kaynak kaydı (channel.yaml series[].source → content_sources[<ad>] klasöründe <id>-<slug>.yaml; ör. bir prensip,
bir tarif, bir ülke kaydı). --principle eski adıdır (TRIZ kanalı), aynı işi yapar.
"""
import argparse
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))
import state  # noqa: E402
from channel import load_channel  # noqa: E402

ROOT = Path(__file__).parent.parent


def main():
    pre = argparse.ArgumentParser(add_help=False)
    pre.add_argument("--channel")                   # channels/<id>/channel.yaml; yoksa kökteki channel.yaml (tools/channel.py)
    cid = pre.parse_known_args()[0].channel
    ch = load_channel(channel_id=cid)
    pre.add_argument("--series")                    # channel.yaml series[].id; yoksa ilk seri
    sid = pre.parse_known_args()[0].series
    all_series = ch.get("series") or [{"id": "standalone", "episode_dir": "content/episodes/{prefix}{num:03d}-{slug}"}]
    series = next((s for s in all_series if s.get("id") == sid), None) if sid else all_series[0]
    if series is None:
        sys.exit(f"seri yok: {sid} (mevcut: {', '.join(s['id'] for s in all_series)})")
    ap = argparse.ArgumentParser(parents=[pre])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--source", "--principle", dest="source")
    g.add_argument("--topic")
    ap.add_argument("--slug")
    ap.add_argument("--lang", default=ch["languages"]["primary"])
    ap.add_argument("--format", default="short")
    ap.add_argument("--target-seconds", type=int)
    ap.add_argument("--style", default=series.get("style", "auto"))
    ap.add_argument("--style-mode", default="lang_neutral")
    ap.add_argument("--voice", default=series.get("voice") or ch["voice"]["default"])
    ap.add_argument("--tone", default=ch["tone"])
    ap.add_argument("--notes", default="", help="kullanıcının istekleri (ör. 'fotoğraflı olsun', 'şu örneği kullan')")
    a = ap.parse_args()

    if a.source:
        sources = ch.get("content_sources") or {}
        key = series.get("source") or next(iter(sources), None)
        if not key:
            sys.exit("kanalda content_sources yok: --topic kullan ya da channel.yaml'a kaynak klasörü ekle")
        src = ROOT / sources[key]
        files = list(src.glob(f"{a.source}-*.yaml"))
        if not files:
            sys.exit(f"kaynak kaydı yok: {src}/{a.source}-*.yaml (önce script-writer hazırlamalı)")
        slug = a.slug or files[0].stem.split("-", 1)[1]
    else:
        slug = a.slug or re.sub(r"[^a-z0-9]+", "-", a.topic.lower()).strip("-")[:40]

    eps = ROOT / "content" / "episodes"
    px = ch["episode_prefix"]
    nums = [int(m.group(1)) for p in eps.glob(f"{px}*") if (m := re.match(rf"{px}(\d+)", p.name))]
    num = max(nums, default=0) + 1
    ep_dir = ROOT / series.get("episode_dir", "content/episodes/{prefix}{num:03d}-{slug}").format(num=num, slug=slug, prefix=px)
    ep_dir.mkdir(parents=True)

    brief = {
        "episode": f"{px}{num:03d}",
        **({"channel": cid} if cid else {}),
        **({"source_id": a.source} if a.source else {"topic": a.topic}),
        "lang": a.lang, "format": a.format,
        "target_seconds": a.target_seconds or ch["formats"][a.format]["target_seconds"],
        "style": a.style, "style_mode": a.style_mode, "voice": a.voice, "tone": a.tone,
        "cta": ch["cta"].get(a.lang if a.lang != "both" else ch["languages"]["primary"]),
        "series": series["id"] if a.source else "standalone",  # serbest konu: seri yapısı/CTA'sı script-writer'da uyarlanır
        "notes": a.notes,
    }
    (ep_dir / "brief.yaml").write_text(yaml.safe_dump(brief, allow_unicode=True, sort_keys=False))
    st = state.load(ep_dir)
    state.save(ep_dir, st)
    print(ep_dir.relative_to(ROOT))


if __name__ == "__main__":
    main()
