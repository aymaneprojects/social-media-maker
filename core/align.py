"""Word-level timings for a narration track.

Runs faster-whisper locally (free, offline after the first model download),
then re-aligns the recognised words onto the exact script text so captions
keep the script's spelling and punctuation.

usage: python3 core/align.py voice.mp3 script.txt out.json [--model small]
"""
import argparse
import difflib
import json
import re
import unicodedata


def norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", w)


def tokenize(script: str):
    # keep punctuation glued to the word ("nuit," / "là.") ; split apostrophes softly
    return [t for t in re.split(r"\s+", script.strip()) if t]


def transcribe(audio: str, model_name: str, lang: str):
    from faster_whisper import WhisperModel

    import subprocess

    import numpy as np

    # decode with ffmpeg ourselves (avoids PyAV version issues)
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", audio, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        check=True,
        capture_output=True,
    ).stdout
    samples = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(samples, language=lang, word_timestamps=True, vad_filter=False, beam_size=5)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"text": w.word.strip(), "start": w.start, "end": w.end})
    return words


def align(script_tokens, asr):
    a = [norm(t) for t in script_tokens]
    b = [norm(w["text"]) for w in asr]
    times = [None] * len(script_tokens)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (asr[j1 + k]["start"], asr[j1 + k]["end"])
        elif tag == "replace" and j2 > j1:
            # spread the recognised span over the script words, by length
            s, e = asr[j1]["start"], asr[j2 - 1]["end"]
            lens = [max(1, len(a[i])) for i in range(i1, i2)]
            tot = sum(lens)
            cur = s
            for k, i in enumerate(range(i1, i2)):
                d = (e - s) * lens[k] / tot
                times[i] = (cur, cur + d)
                cur += d
    # fill remaining gaps by interpolation between known neighbours
    n = len(times)
    for i in range(n):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt_i = next((j for j in range(i + 1, n) if times[j]), None)
            nxt = times[nxt_i][0] if nxt_i is not None else prev + 0.4
            k = 1
            while i + k < n and times[i + k] is None:
                k += 1
            span = (nxt - prev) / (k + 0) if k else 0.3
            times[i] = (prev, prev + max(0.12, span))
    out = []
    for t, (s, e) in zip(script_tokens, times):
        out.append({"text": t, "startMs": round(s * 1000), "endMs": round(e * 1000)})
    # monotonic
    for i in range(1, len(out)):
        if out[i]["startMs"] < out[i - 1]["startMs"]:
            out[i]["startMs"] = out[i - 1]["startMs"]
        if out[i]["endMs"] < out[i]["startMs"]:
            out[i]["endMs"] = out[i]["startMs"] + 120
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", default="fr")
    args = ap.parse_args()
    script = open(args.script, encoding="utf-8").read()
    asr = transcribe(args.audio, args.model, args.lang)
    words = align(tokenize(script), asr)
    json.dump({"words": words, "asr": asr}, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"aligned {len(words)} words, last ends at {words[-1]['endMs'] if words else 0} ms")


if __name__ == "__main__":
    main()
