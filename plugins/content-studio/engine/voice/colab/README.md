# Colab'da ses üretimi (ücretsiz T4 GPU)

TTS'i Colab'a taşır; Mac yalnızca Whisper kalite kapısını çalıştırır (hafif). Deneme başına ~8 sn (Mac CPU'da ~64 sn).

1. Mac: `voice/.venv-chatterbox/bin/python tools/colab_voice.py pack EP004`
   → `content/episodes/EP004-…/audio/_colab/bundle.en.zip` (senaryo, synth.py, profil, referans ses, katalog).
   synth.py'ye ek bayrak gerekirse `--` sonrasına: `pack EP004 -- --takes 3`.
2. Colab: colab.research.google.com → File → Upload notebook → `voice/colab/voice_colab.ipynb`.
   Runtime → Change runtime type → **T4 GPU**. Hücreyi çalıştır (ilk seferde kurulum ~4 dk), "Choose files" ile zip'i seç.
   Bitince `voice_<bölüm>.en.zip` tarayıcıdan iner.
3. **Runtime → Disconnect and delete runtime.** Kota kod çalışırken değil, GPU'ya bağlı kaldıkça düşer.
4. Mac: `voice/.venv-chatterbox/bin/python tools/colab_voice.py unpack ~/Downloads/voice_<bölüm>.en.zip`
   → `audio/en/` altına açar, `synth.py --gate-only` ile Whisper + ses kimliği kontrolü, seçim, `narration.wav`, `report.json`.

Notlar
- Not defteri bir kez yüklenince Colab'da (Drive'da) kalır; sonraki seferlerde yalnızca açılır.
- Oturum kapanınca kurulum ve model önbelleği gider; her oturumda ~4 dk kurulum + ~25 sn model yükleme.
- Ücretsiz kotanın sınırı açıklanmıyor ve değişken; GPU verilmezse aynı iş Mac'te `synth.py` ile yapılır.
- Tek sahne düzeltmeleri Mac'te (`synth.py --only sNN`); unpack mevcut `audio/<dil>`'in üzerine yazmayı reddeder.

## colab-mcp ile (Claude not defterini kendisi açar ve çalıştırır)
- Kayıt (bir kez, proje kapsamı): `claude mcp add colab-mcp -- uvx --from git+https://github.com/googlecolab/colab-mcp colab-mcp`.
  README'deki `uvx git+https://…` biçimi çalışmaz ("Not a valid package or extra name"); `--from … colab-mcp` gerekli.
  Kontrol: `claude mcp get colab-mcp` → Connected.
- Araçlar oturum başında yüklenir: MCP oturum ortasında eklendiyse araçlar o oturumda yoktur → yeni oturum aç (ya da araçları olan oturuma
  işi gönder).
- Kullanıcının elle yaptığı üç şey: tarayıcıda bağlantıyı onaylamak, Runtime → T4 GPU seçmek, "Choose files"ta zip'i seçmek
  (tarayıcı güvenliği; MCP dosya seçemez, base64 ile taşımak token açısından pahalı). Gerisini (hücreyi çalıştırma, runtime kapatma) Claude yapar.
- Kurulum notu: Colab Python 3.13 + torch 2.11; chatterbox torch 2.6.0+cu124'e iner, hazır torchvision uyuşmaz → `pip uninstall -y torchvision`
  (not defteri bunu yapıyor).
