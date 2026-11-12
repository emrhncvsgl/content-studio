"""Kanal profili seçimi (2026-11-09, ikinci kanal inyourhand.org ile).

Varsayılan kanal: kökteki `channel.yaml` (TRIZ Academy). Diğer kanallar: `channels/<id>/channel.yaml`.
Bölüm hangi kanala aitse `brief.yaml` içinde `channel: <id>` yazar (yoksa varsayılan). Bütün araçlar kanalı buradan okur:
  from channel import load_channel;  ch = load_channel(ep_dir)          # bölümün kanalı
  ch = load_channel(channel_id="inyourhand")                           # adıyla
Kanal dosyasındaki `episode_prefix` (vars. "EP") bölüm klasörünün önekidir: content/episodes/<önek><no>-<slug>; numara önek başına artar.
Kanala özgü içerik (marka, logo, müzik tercihi) `content/channels/<id>/` altında; channel.yaml yolları content/'e göredir.
"""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def channel_path(channel_id: str | None = None) -> Path:
    if not channel_id:
        return ROOT / "channel.yaml"
    p = ROOT / "channels" / channel_id / "channel.yaml"
    if not p.exists():
        raise SystemExit(f"kanal yok: {p} (mevcut: {', '.join(list_channels())})")
    return p


def list_channels() -> list[str]:
    default = yaml.safe_load((ROOT / "channel.yaml").read_text())["id"]
    return [default] + sorted(p.parent.name for p in (ROOT / "channels").glob("*/channel.yaml"))


def load_channel(ep_dir: Path | str | None = None, channel_id: str | None = None) -> dict:
    if ep_dir and not channel_id:
        brief = Path(ep_dir) / "brief.yaml"
        if brief.exists():
            channel_id = (yaml.safe_load(brief.read_text()) or {}).get("channel")
    ch = yaml.safe_load(channel_path(channel_id).read_text())
    ch.setdefault("episode_prefix", "EP")
    return ch


if __name__ == "__main__":
    print("\n".join(list_channels()))
