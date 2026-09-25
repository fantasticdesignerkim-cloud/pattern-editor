#!/usr/bin/env python3
"""교재 PDF에서 **책 페이지 번호**로 이미지를 꺼내는 도구.

왜 있나: 원본 PDF(621MB)를 매번 열지 않고, 판독이 필요한 페이지만 파일로 꺼내 쓰기 위해서다.
  ★ PDF 크기 자체는 토큰과 무관하다(컨텍스트에 안 올라간다). 토큰을 먹는 건 **이미지를 여는 횟수**다.
  그래서 판독 결과는 docs/book/ 에 글로 남기고, 이미지는 꼭 필요할 때만 연다.

★ 페이지 오프셋(실측 확정): **책 P.N = PDF index N−1**.
  근거 — PDF index 71 의 쪽번호가 72(프릴 칼라), index 70 이 71(보 칼라)로 인쇄돼 있다.

산출물은 전부 books/pages/ (미추적). 교재 원본 이미지라 **커밋하지 않는다**.

사용:
  python3 tools/bookpage.py split              # 176쪽 전부 분할(원본 해상도 + 1/4 미리보기)
  python3 tools/bookpage.py page 151           # 책 151쪽 하나만
  python3 tools/bookpage.py crop 151 0.55 0.05 1.0 0.40 2   # 비율 크롭(x0 y0 x1 y1 확대배수)
"""
import io
import os
import sys

import pypdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "books", "패턴학교-상의편.pdf")
OUT = os.path.join(ROOT, "books", "pages")
SMALL = os.path.join(OUT, "small")
PAGE_OFFSET = -1          # 책 P.N → PDF index N-1
PREVIEW_DIV = 4           # 미리보기 축소율(1206x1637 ≈ 238KB — 전체 레이아웃 파악용)


def _reader():
    if not os.path.exists(PDF):
        sys.exit("교재 PDF 없음: " + PDF)
    return pypdf.PdfReader(PDF)


def raw_jpeg(reader, book_page):
    """그 페이지의 내장 JPEG 원본 바이트(재인코딩 없음)."""
    idx = book_page + PAGE_OFFSET
    if not (0 <= idx < len(reader.pages)):
        sys.exit("페이지 범위 밖: P.%d (PDF 1..%d 쪽)" % (book_page, len(reader.pages)))
    images = list(reader.pages[idx].images)
    if len(images) != 1:
        sys.exit("P.%d: 내장 이미지가 %d개 — 이 스캔 PDF 가정(쪽당 1장)과 다름" % (book_page, len(images)))
    return images[0].data


def write_page(reader, book_page, preview=True):
    os.makedirs(OUT, exist_ok=True)
    data = raw_jpeg(reader, book_page)
    path = os.path.join(OUT, "p%03d.jpg" % book_page)
    with open(path, "wb") as f:
        f.write(data)
    if preview:
        os.makedirs(SMALL, exist_ok=True)
        im = Image.open(io.BytesIO(data))
        im.resize((im.width // PREVIEW_DIV, im.height // PREVIEW_DIV)).save(
            os.path.join(SMALL, "p%03d.jpg" % book_page), "JPEG", quality=82)
    return path


def cmd_split(args):
    reader = _reader()
    first, last = 1, len(reader.pages)
    if len(args) == 2:
        first, last = int(args[0]), int(args[1])
    for p in range(first, last + 1):
        write_page(reader, p)
    print("분할 완료: P.%d–P.%d → %s (미리보기 %s)" % (first, last, OUT, SMALL))


def cmd_page(args):
    if not args:
        sys.exit("사용: bookpage.py page <책 페이지 번호>")
    print(write_page(_reader(), int(args[0])))


def cmd_crop(args):
    """비율 크롭 — 판독 시 숫자만 확대해서 볼 때. 좌표는 0..1 비율이라 해상도와 무관하다."""
    if len(args) < 5:
        sys.exit("사용: bookpage.py crop <페이지> <x0> <y0> <x1> <y1> [확대배수]")
    page = int(args[0])
    x0, y0, x1, y1 = (float(v) for v in args[1:5])
    zoom = float(args[5]) if len(args) > 5 else 2.0
    im = Image.open(io.BytesIO(raw_jpeg(_reader(), page)))
    box = (int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height))
    c = im.crop(box)
    c = c.resize((int(c.width * zoom), int(c.height * zoom)))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "p%03d_crop.jpg" % page)
    c.save(path, "JPEG", quality=92)
    print(path)


CMDS = {"split": cmd_split, "page": cmd_page, "crop": cmd_crop}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in CMDS:
        sys.exit(__doc__)
    CMDS[sys.argv[1]](sys.argv[2:])
