import { Config } from "@remotion/cli/config";

// Bölüm dosyaları (ses, görseller, timeline) content/ altında durur; staticFile("episodes/EP001-.../audio/en/narration.wav")
Config.setPublicDir("../content");
// QA (EP001): JPEG ara kareler videoyu tam aralıklı yuvj420p yapıyordu (pixelFormat ayarına rağmen);
// PNG ara karelerle yayın standardı sınırlı aralıklı yuv420p çıkıyor (biraz daha yavaş render).
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
// 16 GB bellek: aynı anda tek ağır iş kuralı; render paralelliği düşük tutulur (8 GB'ta --concurrency=1)
Config.setConcurrency(2);
// GPU (Mac: ANGLE → Metal). Headless Chrome varsayılanda GPU'yu kapatır; canvas/filtre ağırlıklı stillerde (vox) ~5 kat hızlı
// (2026-11-01 ölçümü: 300 kare 354 → 76 sn, görüntü farkı ortalama 1.7/255). Concurrency 4 ek kazanç vermedi (darboğaz GPU).
// Chrome'un GPU modunda uzun render'larda bellek sızıntısı bildirilmiş: çökme olursa render'ı --frames ile parçalara böl.
// Platform: macOS → ANGLE/Metal, Windows → ANGLE/Direct3D (ikisi de GPU). Linux'ta ANGLE çoğu sürücüde açılmaz → swangle (yazılım,
// her yerde çalışır); NVIDIA'lı Linux'ta "angle-egl" denenebilir. Gerekirse komut satırında --gl=<değer> ile ezilir.
Config.setChromiumOpenGlRenderer(process.platform === "linux" ? "swangle" : "angle");
