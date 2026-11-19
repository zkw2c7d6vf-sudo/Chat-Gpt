"""Private, bounded file conversion workers. Never fetch document resources or retain inputs."""
from __future__ import annotations
import io
from contextlib import closing
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import warnings
import zipfile
from datetime import datetime
from xml.etree import ElementTree as ET

MAX_INPUT = 30 * 1024 * 1024
MAX_OUTPUT = 150 * 1024 * 1024
MAX_PAGES = 100
MAX_PIXELS = 40_000_000
# One entry is a real input -> output option, not a filename extension change.
CONVERSIONS = [
 ('heic-png','HEIC → PNG',['.heic','.heif'],'png'),
 ('heic-jpeg','HEIC → JPEG',['.heic','.heif'],'jpeg'),
 ('png-jpeg','PNG → JPEG',['.png'],'jpeg'),
 ('png-webp','PNG → WebP',['.png'],'webp'),
 ('png-pdf','PNG → PDF',['.png'],'image-pdf'),
 ('jpeg-png','JPEG → PNG',['.jpg','.jpeg'],'png'),
 ('jpeg-webp','JPEG → WebP',['.jpg','.jpeg'],'webp'),
 ('jpeg-pdf','JPEG → PDF',['.jpg','.jpeg'],'image-pdf'),
 ('webp-png','WebP → PNG',['.webp'],'png'),
 ('webp-jpeg','WebP → JPEG',['.webp'],'jpeg'),
 ('tiff-png','TIFF → PNG',['.tif','.tiff'],'png'),
 ('tiff-pdf','TIFF → PDF',['.tif','.tiff'],'image-pdf'),
 ('pdf-jpeg','PDF → JPEG',['.pdf'],'pdf-jpeg'),
 ('pdf-png','PDF → PNG',['.pdf'],'pdf-png'),
 ('pdf-text','PDF → text',['.pdf'],'text'),
 ('word-pdf','Word → PDF',['.docx','.doc'],'office-pdf'),
 ('docx-text','Word DOCX → text',['.docx'],'text'),
 ('odt-pdf','ODT → PDF',['.odt'],'office-pdf'),
 ('rtf-pdf','RTF → PDF',['.rtf'],'office-pdf'),
 ('text-pdf','Text → PDF',['.txt','.md'],'text-pdf'),
]


def office_binary():
    configured = os.environ.get('MIDNIGHT_LIBREOFFICE')
    candidates = [configured] if configured else []
    candidates += [shutil.which('libreoffice'), shutil.which('soffice')]
    if sys.platform == 'darwin':
        candidates += [str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice'), '/Applications/LibreOffice.app/Contents/MacOS/soffice']
    if os.name == 'nt':
        candidates += [str(Path(os.environ.get('PROGRAMFILES', 'C:/Program Files'))/'LibreOffice/program/soffice.exe')]
    return next((str(p) for p in candidates if p and Path(p).is_file()), None)


def capabilities():
    import importlib.util
    core = all(importlib.util.find_spec(m) for m in ('PIL','pypdfium2','reportlab','pillow_heif'))
    office = bool(office_binary())
    return {'conversions':[{'id':key,'label':label,'extensions':exts,'available':core and (target!='office-pdf' or office),
       'notice':('Install the file-tools dependencies with the Midnight launcher.' if not core else
                 'Install free LibreOffice on this computer, then restart Midnight.' if target=='office-pdf' and not office else '')}
       for key,label,exts,target in CONVERSIONS], 'max_bytes':MAX_INPUT,'max_pages':MAX_PAGES}


def safe_name(filename):
    # Treat user filenames as labels only. Never use them as paths.
    stem = re.sub(r'[^\w .-]', '_', Path(filename.replace('\\','/')).stem, flags=re.UNICODE).strip(' .')[:80]
    return stem or 'converted'


def checked_zip(data):
    archive = zipfile.ZipFile(io.BytesIO(data))
    entries = archive.infolist()
    if len(entries)>2500 or sum(i.file_size for i in entries)>80*1024*1024:
        archive.close(); raise ValueError('This document is too large after decompression.')
    if any(i.flag_bits & 1 for i in entries):
        archive.close(); raise ValueError('Password-protected documents are not supported.')
    return archive


def docx_text(data):
    with checked_zip(data) as archive:
        raw=archive.read('word/document.xml')
    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw: raise ValueError('Unsupported document XML.')
    root=ET.fromstring(raw);ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    return '\n'.join(''.join(p.itertext()) if not p.findall('.//w:t',ns) else ''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in root.findall('.//w:p',ns))[:300000]


def open_pdf(data):
    import pypdfium2 as pdfium
    doc=pdfium.PdfDocument(data)
    if not 1<=len(doc)<=MAX_PAGES:
        doc.close();raise ValueError(f'Choose a PDF with 1–{MAX_PAGES} pages.')
    return doc


def extract_text(data, extension):
    if extension=='.docx': return docx_text(data)
    if extension in ('.txt','.md'):
        try:return data.decode('utf-8-sig')[:300000]
        except UnicodeDecodeError:raise ValueError('Save text as UTF-8, then try again.')
    if extension=='.pdf':
        with open_pdf(data) as doc:
            chunks=[]
            for page in doc:
                with closing(page):
                    with closing(page.get_textpage()) as text:chunks.append(text.get_text_range())
                if sum(map(len,chunks))>300000:break
            return '\n'.join(chunks)[:300000]
    raise ValueError('Choose a PDF, Word DOCX or UTF-8 text file.')


def package_outputs(outputs, stem):
    if len(outputs)==1:return outputs[0]
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:
        for name,data,mime in outputs:archive.writestr(name,data)
    return stem+'.zip',buffer.getvalue(),'application/zip'


def convert(data, filename, operation, work):
    if not data or len(data)>MAX_INPUT:raise ValueError('Choose a non-empty file up to 30 MB.')
    option=next((o for o in CONVERSIONS if o[0]==operation),None)
    if not option:raise ValueError('Choose a supported conversion.')
    extension=Path(filename).suffix.lower();_,_,allowed,target=option
    if extension not in allowed:raise ValueError('Choose a '+', '.join(allowed)+' file for this conversion.')
    stem=safe_name(filename)
    if target=='office-pdf':return office_pdf(data,extension,stem,work)
    if target=='text':
        text=extract_text(data,extension)
        if not text.strip():raise ValueError('No selectable text found. Scanned PDFs need OCR first.')
        return stem+'.txt',text.encode('utf-8'),'text/plain; charset=utf-8'
    if target.startswith('pdf-'):
        from PIL import Image
        outputs=[];total=0;fmt=target.split('-')[1]
        with open_pdf(data) as doc:
            for i,page in enumerate(doc):
                with closing(page):
                    width,height=page.get_size()
                    if width*height*4>MAX_PIXELS:raise ValueError('A PDF page exceeds the rendering size limit.')
                    bitmap=page.render(scale=2)
                    try:
                        image=bitmap.to_pil().convert('RGB');buf=io.BytesIO()
                        image.save(buf,format='JPEG' if fmt=='jpeg' else 'PNG',quality=92)
                    finally:bitmap.close()
                value=buf.getvalue();total+=len(value)
                if total>MAX_OUTPUT:raise ValueError('The converted pages exceed 150 MB. Split this PDF first.')
                outputs.append((f'{stem}-page-{i+1:03d}.{ "jpg" if fmt=="jpeg" else "png"}',value,'image/jpeg' if fmt=='jpeg' else 'image/png'))
        return package_outputs(outputs,stem)
    if target=='text-pdf':return text_pdf(extract_text(data,extension),stem)
    from PIL import Image,ImageOps
    from pillow_heif import register_heif_opener
    register_heif_opener(thumbnails=False)
    Image.MAX_IMAGE_PIXELS=MAX_PIXELS
    outputs=[]
    with warnings.catch_warnings():
        warnings.simplefilter('error',Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as original:
            expected={'.heic':'HEIF','.heif':'HEIF','.png':'PNG','.jpg':'JPEG','.jpeg':'JPEG','.webp':'WEBP','.tif':'TIFF','.tiff':'TIFF'}
            if original.format!=expected[extension]:raise ValueError('The file content does not match its extension.')
            count=getattr(original,'n_frames',1) if extension in ('.tif','.tiff') else 1
            if count>MAX_PAGES:raise ValueError('Choose a TIFF with at most 100 pages.')
            images=[];total_pixels=0
            for i in range(count):
                original.seek(i);total_pixels+=original.width*original.height
                if original.width*original.height>MAX_PIXELS or total_pixels>80_000_000:raise ValueError('The image collection exceeds the pixel limit. Split the file first.')
                image=ImageOps.exif_transpose(original).copy()
                if target=='image-pdf':images.append(flatten(image));continue
                fmt='JPEG' if target=='jpeg' else target.upper()
                if fmt=='JPEG':image=flatten(image)
                buf=io.BytesIO();image.save(buf,format=fmt,quality=92)
                suffix='jpg' if target=='jpeg' else target
                name=f'{stem}{"-page-"+str(i+1).zfill(3) if count>1 else ""}.{suffix}'
                outputs.append((name,buf.getvalue(),'image/'+('jpeg' if target=='jpeg' else target)))
            if images:
                # Preserve image detail; 150 dpi controls the page's physical size.
                buf=io.BytesIO();images[0].save(buf,format='PDF',save_all=True,append_images=images[1:],resolution=150)
                return stem+'.pdf',buf.getvalue(),'application/pdf'
    return package_outputs(outputs,stem)


def flatten(image):
    from PIL import Image
    rgba=image.convert('RGBA');background=Image.new('RGB',image.size,'white');background.paste(rgba,mask=rgba.getchannel('A'));return background


def text_pdf(text,stem):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    fonts=[Path(__file__).parent/'static/fonts/DejaVuSans.ttf']
    font=next((p for p in fonts if p.exists()),None)
    if font:pdfmetrics.registerFont(TTFont('MidnightText',str(font)))
    face='MidnightText' if font else 'Helvetica'
    buf=io.BytesIO();pdf=canvas.Canvas(buf,pagesize=letter);pdf.setTitle(stem);pdf.setFont(face,11);y=744;pages=1
    for raw in text.expandtabs(4).splitlines():
        line=''
        for char in raw:
            if pdfmetrics.stringWidth(line+char,face,11)>516:
                pdf.drawString(48,y,line);line='';y-=16
                if y<48:
                    pdf.showPage();pdf.setFont(face,11);y=744;pages+=1
                    if pages>MAX_PAGES:raise ValueError('The text would produce more than 100 pages.')
            line+=char
        pdf.drawString(48,y,line);y-=16
        if y<48:pdf.showPage();pdf.setFont(face,11);y=744;pages+=1
        if pages>MAX_PAGES:raise ValueError('The text would produce more than 100 pages.')
    pdf.save();return stem+'.pdf',buf.getvalue(),'application/pdf'


def office_pdf(data,extension,stem,work):
    binary=office_binary()
    if not binary:raise ValueError('Install free LibreOffice on this computer, then restart Midnight for Word, ODT and RTF to PDF.')
    if extension in ('.docx','.odt'):
        with checked_zip(data) as archive:
            for name in archive.namelist():
                if name.endswith('.rels'):
                    raw=archive.read(name)
                    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:raise ValueError('Unsupported document XML.')
                    for rel in ET.fromstring(raw):
                        if rel.get('TargetMode')=='External' and not rel.get('Type','').endswith('/hyperlink'):
                            raise ValueError('This document links external resources. Embed linked images or templates in Word first.')
    profile=work/'office-profile';profile.mkdir();(profile/'user').mkdir()
    (profile/'user/registrymodifications.xcu').write_text('''<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item></oor:items>''')
    source=work/('document'+extension);source.write_bytes(data)
    out=work/'pdf';out.mkdir()
    subprocess.run([binary,'-env:UserInstallation='+profile.as_uri(),'--headless','--nologo','--nodefault','--nofirststartwizard','--convert-to','pdf:writer_pdf_Export','--outdir',str(out),str(source)],capture_output=True,timeout=60,check=True)
    result=out/'document.pdf'
    if not result.is_file():raise ValueError('LibreOffice could not convert this document. Check that it opens normally and is not password-protected.')
    converted=result.read_bytes()
    with open_pdf(converted):pass
    return stem+'.pdf',converted,'application/pdf'


MONTHS='January February March April May June July August September October November December'.split()
MONTH_PATTERN='(?:'+'|'.join(m+'|'+m[:3] for m in MONTHS)+r')\.?'
DATE_PATTERN=re.compile(r'(?<!\w)(?P<iso>\d{4}-\d{1,2}-\d{1,2})\b|\b(?P<month>'+MONTH_PATTERN+r')\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(?P<year>20\d{2}))?|(?<![\d/])(?P<num>\d{1,2}/\d{1,2}(?:/\d{2,4})?)(?![\d/])',re.I)
TIME_PATTERN=re.compile(r'\b(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ampm>[ap]\.?m\.?)\b|\b(?P<h24>\d{1,2}):(?P<m24>\d{2})\b',re.I)


def deadlines(text,year):
    if not 2000<=year<=2100:raise ValueError('Choose a year between 2000 and 2100.')
    lines=[s.strip() for s in text.splitlines() if s.strip()];result=[];seen=set()
    for i,line in enumerate(lines):
        for match in DATE_PATTERN.finditer(line):
            warning=[]
            try:
                if match['iso']:
                    parts=list(map(int,match['iso'].split('-')));date=datetime(*parts)
                elif match['month']:
                    month=next(n+1 for n,m in enumerate(MONTHS) if m.lower().startswith(match['month'].rstrip('.').lower()))
                    y=int(match['year'] or year);date=datetime(y,month,int(match['day']))
                    if not match['year']:warning.append(f'Year assumed: {year}')
                else:
                    parts=list(map(int,match['num'].split('/')));month,day=parts[:2];y=parts[2] if len(parts)==3 else year
                    if y<100:y+=2000
                    date=datetime(y,month,day)
                    warning.append('Numeric date interpreted as month/day')
                    if len(parts)==2:warning.append(f'Year assumed: {year}')
            except (ValueError,StopIteration):continue
            context=line
            if len(DATE_PATTERN.sub('',line).strip(' :-–—|\t'))<5:
                context=line+' — '+(lines[i+1] if i+1<len(lines) else lines[i-1] if i else '')
            time_match=TIME_PATTERN.search(context)
            hour,minute=23,59
            if time_match:
                try:
                    if time_match['h24']:hour,minute=int(time_match['h24']),int(time_match['m24'])
                    else:
                        hour,minute=int(time_match['h']),int(time_match['m'] or 0)
                        if not 1<=hour<=12:raise ValueError()
                        hour=hour%12+(12 if time_match['ampm'].lower().startswith('p') else 0)
                    date.replace(hour=hour,minute=minute)
                except ValueError:
                    hour,minute=23,59;warning.append('Invalid time; verify the suggested time')
            else:warning.append('No time listed: 11:59 PM suggested')
            title=DATE_PATTERN.sub('',context)
            title=TIME_PATTERN.sub('',title)
            title=re.sub(r'\s+',' ',title).strip(' :-–—|,')
            title=re.sub(r'^(?:due|by|on)\s*[:\-]?\s*','',title,flags=re.I).strip(' :-–—|,')
            title=re.sub(r'\s+(?:due(?:\s+at)?|at|by|on)$','',title,flags=re.I).strip() or 'Review deadline'
            local=f'{date:%Y-%m-%d}T{hour:02d}:{minute:02d}'
            key=(title.lower(),local)
            if key in seen:continue
            seen.add(key)
            result.append({'text':title[:500],'localDate':local,'source':context[:1500],'warnings':warning})
            if len(result)>=200:return result
    return result


def worker():
    # Keep parsing/rendering out of the server process; hard timeout enforced by the caller.
    work=Path(sys.argv[1]);spec=json.loads((work/'request.json').read_text());data=(work/'input').read_bytes()
    try:
        if spec['action']=='extract':
            text=extract_text(data,Path(spec['filename']).suffix.lower())
            if not text.strip():raise ValueError('No selectable text found. This PDF may be scanned; use OCR or paste its text.')
            (work/'result.json').write_text(json.dumps({'text':text,'candidates':deadlines(text,spec['year'])}))
        else:
            name,value,mime=convert(data,spec['filename'],spec['operation'],work)
            if len(value)>MAX_OUTPUT:raise ValueError('The output exceeds 150 MB. Split the input first.')
            (work/'output').write_bytes(value);(work/'result.json').write_text(json.dumps({'name':name,'mime':mime}))
    except Exception as exc:
        message=str(exc) if isinstance(exc,ValueError) else 'This file could not be processed. Check that it opens normally and is not damaged or password-protected.'
        (work/'result.json').write_text(json.dumps({'error':message}));sys.exit(1)


if __name__=='__main__':worker()
