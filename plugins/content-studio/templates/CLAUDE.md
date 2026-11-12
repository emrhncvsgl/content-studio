# Content Studio projesi

Bu klasör `content-studio` plugin'iyle kuruldu. Motor (tools/, voice/, studio/, catalog/) plugin'den kopyalandı; kanala özgü
her şey `channel.yaml`, `channels/` ve `content/` altındadır. Plugin dosyaları (skill alt dosyaları, ajanlar, stil kütüphanesi)
`.studio/plugin/` bağlantısından okunur. Bağlantı kırıksa ya da plugin güncellendiyse: `/content-studio:studio-setup --update`.
Kararlar ve test sonuçları (en yenisi üstte): [docs/DECISIONS.md](docs/DECISIONS.md).

## Kullanım
- İlk kurulum: `/content-studio:studio-setup` (sistemi algılar, ortamı onayla kurar) → `/content-studio:new-channel`
  (kanal kimliği, ses, tasarım dili) → `/content-studio:shorts` (bölüm üretimi).
- Bölüm: `/content-studio:shorts [kaynak no | konu | bölüm kodu]`. Röportaj → senaryo (ONAY 1) → ses → storyboard (ONAY 2) →
  render → yayın paketi → kullanıcı izler (ONAY 3). Durum: `<bölüm>/state.json`.
- Tasarım dilini sonradan değiştirmek: `/content-studio:design-language`.
- Ajanlar: script-writer, localizer, voice-producer, visual-director, editor, qa-reviewer (plugin'le gelir).

## Kurallar
- Aynı anda yalnızca bir ağır iş (TTS, toplu Whisper, Remotion render). Uzun işler arka planda, bellek bekçisiyle.
- Gerçek kişi sesi klonlanmaz; yalnızca sentetik tasarım ses ya da izinli kendi ses.
- ⚠️ işaretli varsayımlar testle kapatılır, sonuç DECISIONS.md'ye yazılır.
- Onaysız paket kurulmaz, onaysız dosya/model silinmez.
- Her görsel/ses varlığı lisansıyla `assets.csv`'ye yazılır; yalnızca `channel.yaml assets.allowed_sources`.
- Sözleşme dosyaları (brief, script) yazılınca `tools/validate.py` çalıştırılır.
- Öğrenilen her kural kanal dosyasına (`channel.yaml design`/kurallar) ya da DECISIONS.md'ye yazılır; yalnızca hafızada kalmaz.

## Yapı
- `channel.yaml` kanal ayarları ve tasarım dili · `catalog/` stiller, duygular, telaffuz · `content/` kaynak kayıtları, bölümler, marka
- `voice/` ses hattı (`synth.py`, `textnorm.py`, `asr.py`, `profiles/`, `refs/`, `kaggle/`, `colab/`) · `tools/` doğrulayıcı, durum, yeni bölüm, paket
- `studio/` Remotion projesi. Public dizini `../content`; `npm run studio` önizleme,
  `npx remotion render src/index.ts <Kompozisyon> out/x.mp4`. Editör: `node studio/editor/server.mjs --watch` (localhost:3100).
- Stil kütüphanesi: `.studio/plugin/library/lemo/` (Lemo-Opuscar MIT sürümü, ~67 stil tarifi) ve
  `.studio/plugin/library/cinecode/` (kamera hareketleri, görünümler, tipografi, ses referansları; MIT).

## Ortam
<!-- /studio-setup bu bölümü sistemine göre doldurur -->
- Python araçları: `voice/.venv-chatterbox/bin/python`
- Ses motoru: (kurulumda seçilir)
- whisper.cpp: `whisper-cli`, model `voice/models/ggml-large-v3-turbo-q5_0.bin`
