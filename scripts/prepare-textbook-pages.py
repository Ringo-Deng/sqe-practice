"""Create independently loadable original PDF pages; run only when textbooks change."""
import argparse
import hashlib
import io
import json
import subprocess
import tempfile
from pathlib import Path

import fitz
from PIL import Image

root = Path(__file__).resolve().parents[1]
catalog_path = root / 'lib/textbooks.json'
catalog = json.loads(catalog_path.read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, default=root / 'library-source' / 'SQE')
parser.add_argument('--book-id', action='append', dest='book_ids')
parser.add_argument('--ebook', action='store_true', help='Downsample embedded images for a smaller web reader asset')
parser.add_argument('--screen', action='store_true', help='Use screen-resolution images for compact web reader assets')
parser.add_argument('--optimize-images', action='store_true', help='Downsample large images while preserving selectable PDF text')
parser.add_argument('--single-file', action='store_true', help='Keep each prepared textbook as one multi-page PDF')
args = parser.parse_args()
for book in catalog:
    if args.book_ids and book['id'] not in args.book_ids:
        continue
    source = args.source_dir / book['sourceFile']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == book['sha256']
    with tempfile.TemporaryDirectory() as temporary:
        prepared = Path(temporary) / source.name
        if args.optimize_images:
            optimized = fitz.open(source)
            seen: set[int] = set()
            for page in optimized:
                for image_info in page.get_images(full=True):
                    xref = image_info[0]
                    if xref in seen:
                        continue
                    seen.add(xref)
                    original = optimized.extract_image(xref)['image']
                    try:
                        image = Image.open(io.BytesIO(original))
                        image.load()
                    except Exception:
                        continue
                    if max(image.size) <= 1100:
                        continue
                    image.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
                    if image.mode not in ('RGB', 'L'):
                        background = Image.new('RGB', image.size, 'white')
                        if 'A' in image.getbands():
                            background.paste(image, mask=image.getchannel('A'))
                        else:
                            background.paste(image.convert('RGB'))
                        image = background
                    output = io.BytesIO()
                    image.save(output, format='JPEG', quality=68, optimize=True)
                    if output.tell() < len(original):
                        page.replace_image(xref, stream=output.getvalue())
            optimized.save(prepared, garbage=4, clean=True, deflate=True,
                           deflate_images=True, deflate_fonts=True, use_objstms=1)
            optimized.close()
        elif args.ebook or args.screen:
            profile = '/screen' if args.screen else '/ebook'
            subprocess.run([
                'gs', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.6',
                f'-dPDFSETTINGS={profile}', '-dNOPAUSE', '-dQUIET', '-dBATCH',
                f'-sOutputFile={prepared}', str(source),
            ], check=True)
        else:
            prepared = source
        document = fitz.open(prepared)
        assert len(document) == book['pageCount']
        if args.single_file:
            destination = root / 'public' / book['url'].lstrip('/')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(prepared.read_bytes())
            print(json.dumps({'book': book['id'], 'pages': len(document),
                              'originalBytes': source.stat().st_size,
                              'totalPageBytes': destination.stat().st_size}))
            document.close()
            continue
        directory_url = book['pageUrlTemplate'].removesuffix('/{page}.pdf')
        directory = root / 'public' / directory_url.lstrip('/')
        directory.mkdir(parents=True, exist_ok=True)
        sizes = []
        for index in range(len(document)):
            with fitz.open() as page:
                page.insert_pdf(document, from_page=index, to_page=index)
                data = page.tobytes(garbage=4, deflate=True)
            (directory / f'{index + 1}.pdf').write_bytes(data)
            sizes.append(len(data))
        print(json.dumps({'book': book['id'], 'pages': len(sizes),
                         'originalBytes': source.stat().st_size,
                         'medianPageBytes': sorted(sizes)[len(sizes) // 2],
                         'maxPageBytes': max(sizes), 'totalPageBytes': sum(sizes)}))
        document.close()
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
