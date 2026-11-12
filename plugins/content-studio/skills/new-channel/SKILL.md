---
name: new-channel
description: >
  Yeni bir kanal kurar: kısa röportajla kanal kimliği (ad, konu, kitle, dil, ton, CTA, seri yapısı, içerik kuralları), anlatıcı
  sesi (hazır profil, ses tasarımı, Gemini hazır ses, ElevenLabs ya da izinli kendi ses) ve ardından tasarım dili
  (/design-language adımı). Sonucu channel.yaml (ilk kanal) ya da channels/<id>/channel.yaml (ek kanal) olarak yazar.
  Kullanıcı "kanal kur", "yeni kanal", "kanalımı ayarlayalım", "ikinci kanal" dediğinde kullan.
argument-hint: "[kanal adı ya da id]"
---

# /new-channel: kanalı kur

Ön koşul: motor kurulu (`.studio/engine-manifest.json` var). Yoksa önce `/content-studio:studio-setup`.
Bu bir sohbettir, form değil: kullanıcı bir alanı bilmiyorsa öneri sun, "sonra" derse varsayılanla geç ve özette işaretle.

## 1. Kanal kimliği
Önce serbest anlatmasını iste: "Kanal ne anlatacak, kim izleyecek, beğendiğin 1-2 kanal/video var mı?" Cevaptan çıkarabildiğini
sorma. Eksikleri tek AskUserQuestion turunda sor (en fazla 4):
- **Ad ve id** (id: küçük harf-tire; `episode_prefix` 2-4 harf, ör. `EP`, `IYH`)
- **Dil**: ana dil ve aktif diller (tr | en; ikisi birden mümkün, ikinci dilin sesi ayrıca gerekir)
- **Format**: Shorts (9:16, 30-90 sn) / uzun video (16:9) / ikisi
- **Ton**: 3 aday cümle öner (ör. "meraklı, sade, belgesel anlatıcısı" / "sıcak, saygılı, sakin" / "enerjik, esprili")
Sonra serbest metinle: `about` (2-3 cümle), `audience`, `cta` (her aktif dil için).

**Seri yapısı (isteğe bağlı)**: kanal tekrar eden bir kayıt dizisine dayanıyorsa (ör. 40 prensip, 81 ülke, tarif listesi)
`content_sources` + `series` kur: kayıt klasörü `content/sources/<seri>/`, her kayıt `<id>-<slug>.yaml` (tanım, doğrulanmış örnekler,
kaynaklar). İlk 1-2 kaydı script-writer ajanına doğrulanmış kaynaklarla hazırlat. Seri yoksa bölümler serbest konuyla açılır.

**İçerik kuralları**: kanalın hassas alanları (dini içerik, sağlık, çocuk, marka, siyaset) varsa kuralları açıkça yaz ve
`channel.yaml`'a koy; ajanlar bunları AYNEN uygular. Örnek kalıp: `religious_guidelines: true` + yorum satırlarında kurallar.
`assets.allowed_sources` / `forbidden`: şablondaki güvenli liste + kanala özgü kaynaklar (lisansı okunarak).

## 2. Anlatıcı sesi
`channel.yaml voice.backend` (studio-setup seçti; yoksa sor). Seçenekler, sisteme göre (`voice/.venv-chatterbox/bin/python .studio/plugin/scripts/detect_system.py --json`):
| Yol | Ne zaman | Nasıl |
|---|---|---|
| Hazır profil | Hızlı başlamak | `narrator_v3` (EN, sakin belgesel erkek), `tok_anlatici` (TR, derin tok erkek). Sentetik tasarım sesler. Başka kanalla aynı sesi paylaşacağını söyle. |
| Ses tasarımı | Kanala özgü ses (önerilen) | Apple Silicon: `voice/design_voice.py` (Qwen3 VoiceDesign, `voice/.venv-mlx`) metin tarifinden 3-4 aday → kör dinleme → seçilen adayın ilk 8-10 sn'si referans → `voice/profiles/<id>.yaml`. Diğer sistemler: Kaggle (VoxCPM2 tasarım) ya da Gemini hazır sesleri. Ayrıntı: `.studio/plugin/skills/voice-pipeline/SKILL.md` "Yeni ses profili". |
| Gemini hazır ses | API anahtarı var, yerel GPU yok | `tools/gemini_tts.py --voices A B C` ile 3 ses aynı cümleyi okur, kullanıcı seçer. Seçilen ses adını ve `--style` tarifini `channel.yaml voice` altına yaz (`gemini_voice`, `gemini_style`); bölüm sesi `tools/gemini_tts.py` ile üretilir (synth.py profili değil). |
| ElevenLabs (API) | Kullanıcının ElevenLabs hesabı ve API anahtarı var | Anahtarı kullanıcı `.env` dosyasına `ELEVENLABS_API_KEY=...` olarak yazar (sen yazma, değeri isteme). `tools/elevenlabs_voices.py list` → 3-4 aday → `audition --text "<kanalın konusundan bir cümle>"` → seçilen `voice_id` ile `voice/profiles/elevenlabs_<dil>.yaml`'ı `<kanal>_narrator.yaml` olarak kopyala. Üretim `voice/synth.py` ile otomatik. |
| Dış ses (elle) | API anahtarı yok; kullanıcı sesi kendisi üretir/kaydeder | `voice/profiles/external_<dil>.yaml` kopyala; ses `audio/<dil>/` altına konur. |
| Kendi sesi | Kullanıcı kendi sesini kullanmak istiyor | Yalnızca kendi sesi ya da yazılı izni olan kişi. **Gerçek/ünlü kişi sesi klonlanmaz.** |
Aday dinletme dosyalarını kullanıcıya gönder (telefondaysa SendUserFile). TTS ağır iştir: tek tek, bellek bekçisiyle, önce sor.
Seçilen sesi `voice.default`'a yaz. Test cümlesini kanalın kendi konusundan seç (başka kanalın metnini kullanma).

## 3. Tasarım dili
`.studio/plugin/skills/design-language/SKILL.md` akışını burada, bu kanal için yürüt (menü → turlar → deneme klibi → `design`).
Kullanıcı "sonra" derse `design.summary`'ye geçici bir satır yaz ve özette "tasarım dili bekliyor" diye işaretle.

## 4. Marka (kısa)
Logo/profil görseli ve outro varsa `content/channels/<id>/brand/` (ya da ilk kanal için `content/brand/`) altına konur; yoksa
`brand.outro: null` bırak. Fontu `tools/fetch_fonts.py`'ye ekleyip çalıştır.

## 5. Yaz ve doğrula
- İlk kanal: kökte `channel.yaml` (şablon `.studio/plugin/templates/channel.yaml`; `channel.yaml.example` kopyası projede).
  Ek kanal: `channels/<id>/channel.yaml` + `content/channels/<id>/`.
- `voice/.venv-chatterbox/bin/python tools/channel.py` kanalı listelemeli.
- Özet tablo göster: kimlik · ses · tasarım dili (tek cümle + deneme klibi) · seri · bekleyenler. Onay al.
- `docs/DECISIONS.md` en üstüne tarihli "Kanal kuruldu" kaydı (seçimler + gerekçe).
- Sonraki adım: "İlk bölümü yapalım mı? → `/content-studio:shorts`".
