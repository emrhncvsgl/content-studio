#!/bin/sh
# Dinleme denemesi: bir müzik parçasını bölümün yayın sesinin (anlatım + efekt) altına koyar.
# Müzik -26 LUFS'a ayarlanır, konuşmada sidechain ile ek kısılır, giriş/çıkış fade; toplam -14 LUFS (yayın standardı).
# Kullanım: sh tools/music/preview_mix.sh <müzik.wav|mp3> <bölüm_sesi.wav> <çıktı.wav> [başlangıç_sn]
set -e
M="$1"; V="$2"; O="$3"; SS="${4:-0}"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
FO=$(python3 -c "print(max(0, $D - 2.5))")
ffmpeg -v error -y -ss "$SS" -i "$M" -i "$V" -filter_complex \
  "[0:a]atrim=0:$D,loudnorm=I=-26:TP=-3:LRA=11,afade=t=in:d=1.5,afade=t=out:st=$FO:d=2.5,aformat=sample_rates=48000:channel_layouts=stereo[m];\
[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit[v][sc];\
[m][sc]sidechaincompress=threshold=0.03:ratio=4:attack=40:release=400:makeup=1[md];\
[v][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1[o]" -map "[o]" -ar 48000 "$O"
echo "[done] $O"
