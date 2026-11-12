"""TTS'e gidecek metni hazırlar: rakam → yazı, yüzde, telaffuz sözlüğü (PLAN 6.2).

R1 testi: Chatterbox Multilingual Türkçede rakamları okuyamıyor ("1946" → "Windows R…").
Bu yüzden TTS'e rakam gitmez. Altyazı ve Whisper karşılaştırması orijinal metni kullanır.
"""
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent

TR_ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
TR_TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]
TR_BIG = [(10**9, "milyar"), (10**6, "milyon"), (1000, "bin")]

EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
           "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
EN_BIG = [(10**9, "billion"), (10**6, "million"), (1000, "thousand")]


def tr_int(n: int) -> str:
    if n == 0:
        return "sıfır"
    words = []
    for value, name in TR_BIG:
        if n >= value:
            q, n = divmod(n, value)
            if not (value == 1000 and q == 1):  # "bir bin" değil "bin"
                words.append(tr_int(q))
            words.append(name)
    h, n = divmod(n, 100)
    if h:
        if h > 1:
            words.append(TR_ONES[h])
        words.append("yüz")  # "bir yüz" değil "yüz"
    t, o = divmod(n, 10)
    words += [w for w in (TR_TENS[t], TR_ONES[o]) if w]
    return " ".join(words)


def en_int(n: int) -> str:
    if n == 0:
        return "zero"
    words = []
    for value, name in EN_BIG:
        if n >= value:
            q, n = divmod(n, value)
            words += [en_int(q), name]
    h, n = divmod(n, 100)
    if h:
        words += [EN_ONES[h], "hundred"]
    if n >= 20:
        t, o = divmod(n, 10)
        words.append(EN_TENS[t] + (f"-{EN_ONES[o]}" if o else ""))
    elif n:
        words.append(EN_ONES[n])
    return " ".join(words)


def en_year(n: int) -> str:
    """1100-1999 ve 2010+ yıl okunuşu: 1946 → nineteen forty-six."""
    hi, lo = divmod(n, 100)
    if lo == 0:
        return f"{en_int(hi)} hundred"
    return f"{en_int(hi)} {'oh-' + en_int(lo) if lo < 10 else en_int(lo)}"


def numbers_to_words(text: str, lang: str) -> str:
    if lang == "tr":
        text = re.sub(r"%\s?(\d+)", r"yüzde \1", text)
        num = r"\d{1,3}(?:\.\d{3})+|\d+"  # 40.000 binlik ayırıcı
        dec_sep, dec_word, thou_sep = ",", "virgül", "."
        to_words = tr_int
    else:
        text = re.sub(r"(\d+)\s?%", r"\1 percent", text)
        num = r"\d{1,3}(?:,\d{3})+|\d+"
        dec_sep, dec_word, thou_sep = ".", "point", ","
        to_words = en_int

    def repl(m):
        whole, frac = m.group(1), m.group(2)
        n = int(whole.replace(thou_sep, ""))
        if lang == "en" and frac is None and thou_sep not in whole and (1100 <= n <= 1999 or 2010 <= n <= 2099):
            words = en_year(n)
        else:
            words = to_words(n)
        if frac:
            words += f" {dec_word} " + " ".join(to_words(int(d)) for d in frac)
        # TR: "1946'da" → "bin dokuz yüz kırk altıda" (kesme işareti kalkar, ek bitişir)
        return words + (m.group(3) or "")

    suffix = r"(?:'(\w+))?" if lang == "tr" else r"()"
    return re.sub(rf"({num})(?:{re.escape(dec_sep)}(\d+))?{suffix}", repl, text)


def load_pronunciation(lang: str) -> dict:
    p = ROOT / "catalog" / f"pronunciation.{lang}.yaml"
    return yaml.safe_load(p.read_text()) or {} if p.exists() else {}


def apply_pronunciation(text: str, table: dict) -> str:
    for src, dst in table.items():
        text = re.sub(rf"(?<!\w){re.escape(src)}(?!\w)", dst, text)
    return text


def prepare(text: str, lang: str, table: dict | None = None) -> str:
    """Orijinal metin → TTS'e gidecek metin."""
    table = load_pronunciation(lang) if table is None else table
    return numbers_to_words(apply_pronunciation(text, table), lang)


if __name__ == "__main__":
    for lang, s in [("tr", "1946'da Altshuller, 40.000 patenti inceledi; TRIZ'in başarısı %95."),
                    ("en", "In 1946, Altshuller studied 40,000 patents. TRIZ works 95% of the time, 2.5 times faster.")]:
        print(lang, "|", prepare(s, lang))
