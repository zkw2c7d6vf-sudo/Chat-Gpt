"""Real-format conversion tests using synthetic documents, never personal files."""
import io
import json
from pathlib import Path
import zipfile
from xml.sax.saxutils import escape

import pytest
from PIL import Image
from pillow_heif import register_heif_opener
from reportlab.pdfgen import canvas
from fastapi.testclient import TestClient
import file_tools
import server


def docx(text):
    data=io.BytesIO()
    with zipfile.ZipFile(data,'w') as out:
        out.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        out.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        out.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+''.join('<w:p><w:r><w:t>'+escape(line)+'</w:t></w:r></w:p>' for line in text.splitlines())+'<w:sectPr/></w:body></w:document>')
    return data.getvalue()


def pdf(pages=2):
    data=io.BytesIO();out=canvas.Canvas(data)
    for i in range(pages):out.drawString(50,750,f'November {24+i}, 2026 - Assignment {i+1} due at 6 PM');out.showPage()
    out.save();return data.getvalue()


def image(fmt,frames=1):
    register_heif_opener()
    data=io.BytesIO();im=Image.new('RGB',(120,80),(80,110,140))
    im.save(data,format=fmt,**({'save_all':True,'append_images':[Image.new('RGB',(120,80),'white') for _ in range(frames-1)]} if frames>1 else {}));return data.getvalue()


@pytest.mark.parametrize('operation,source,filename,mime',[ 
 ('heic-png','HEIF','photo.heic','image/png'),('heic-jpeg','HEIF','photo.heic','image/jpeg'),
 ('png-jpeg','PNG','photo.png','image/jpeg'),('png-webp','PNG','photo.png','image/webp'),('png-pdf','PNG','photo.png','application/pdf'),
 ('jpeg-png','JPEG','photo.jpg','image/png'),('jpeg-webp','JPEG','photo.jpeg','image/webp'),('jpeg-pdf','JPEG','photo.jpg','application/pdf'),
 ('webp-png','WEBP','photo.webp','image/png'),('webp-jpeg','WEBP','photo.webp','image/jpeg'),
 ('tiff-png','TIFF','scan.tiff','image/png'),('tiff-pdf','TIFF','scan.tif','application/pdf')])
def test_image_conversions_have_real_output(operation,source,filename,mime,tmp_path):
    name,data,kind=file_tools.convert(image(source),filename,operation,tmp_path)
    assert kind==mime and len(data)>0
    if mime=='application/pdf':
        with file_tools.open_pdf(data) as result:assert len(result)==1
    else:
        with Image.open(io.BytesIO(data)) as result:assert result.size==(120,80)
    assert '/' not in name


@pytest.mark.parametrize('operation,fmt',[('pdf-jpeg','JPEG'),('pdf-png','PNG')])
def test_pdf_pages_are_all_preserved(operation,fmt,tmp_path):
    name,data,mime=file_tools.convert(pdf(),'pages.pdf',operation,tmp_path)
    assert mime=='application/zip'
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert len(archive.namelist())==2
        for name in archive.namelist():
            with Image.open(io.BytesIO(archive.read(name))) as output:assert output.format==fmt and output.width>1000


def test_tiff_pages_and_alpha(tmp_path):
    _,data,mime=file_tools.convert(image('TIFF',2),'scan.tif','tiff-pdf',tmp_path)
    with file_tools.open_pdf(data) as output:assert len(output)==2
    _,data,mime=file_tools.convert(image('TIFF',2),'scan.tif','tiff-png',tmp_path)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:assert len(archive.namelist())==2
    data=io.BytesIO();Image.new('RGBA',(20,20),(0,0,0,0)).save(data,'PNG')
    _,result,_=file_tools.convert(data.getvalue(),'transparent.png','png-jpeg',tmp_path)
    with Image.open(io.BytesIO(result)) as result:assert result.getpixel((10,10))==(255,255,255)


def test_document_text_and_unicode_pdf(tmp_path):
    _,result,_=file_tools.convert(docx('November 24 - Lesson plan\nDecember 2 - Reflection'),'syllabus.docx','docx-text',tmp_path)
    assert b'Reflection' in result
    _,result,_=file_tools.convert(pdf(),'syllabus.pdf','pdf-text',tmp_path)
    assert b'Assignment 1' in result and b'Assignment 2' in result
    _,result,_=file_tools.convert('Résumé — classroom notes\nNovember 24 - Lesson plan'.encode(),'notes.txt','text-pdf',tmp_path)
    text=file_tools.extract_text(result,'.pdf')
    assert 'Résumé' in text and 'Lesson plan' in text


@pytest.mark.skipif(not file_tools.office_binary(),reason='Optional LibreOffice is not installed')
def test_real_word_to_pdf(tmp_path):
    _,result,mime=file_tools.convert(docx('Conversion check\nNovember 24 - Lesson plan due at 6 PM'),'lesson.docx','word-pdf',tmp_path)
    assert mime=='application/pdf' and 'Lesson plan' in file_tools.extract_text(result,'.pdf')
    # Legacy Word, ODT and RTF are generated by the real office engine, then converted back.
    import subprocess
    original=tmp_path/'fixture.docx';original.write_bytes(docx('Format conversion check'))
    for extension,filter_name,op in [('.doc','doc:MS Word 97','word-pdf'),('.odt','odt','odt-pdf'),('.rtf','rtf','rtf-pdf')]:
        output=tmp_path/extension[1:];output.mkdir()
        subprocess.run([file_tools.office_binary(),'-env:UserInstallation='+(tmp_path/('fixture-'+extension[1:])).as_uri(),'--headless','--convert-to',filter_name,'--outdir',str(output),str(original)],check=True,capture_output=True,timeout=45)
        work=tmp_path/('convert-'+extension[1:]);work.mkdir()
        _,result,mime=file_tools.convert((output/('fixture'+extension)).read_bytes(),'fixture'+extension,op,work)
        assert 'Format conversion check' in file_tools.extract_text(result,'.pdf')


def test_deadline_dates_context_times_and_invalid_values():
    result=file_tools.deadlines('November 24, 2026 — Lesson plan due at 6 PM\n12/2/27 Final reflection due 11:59 pm\n2027-02-30 impossible\nDecember 3\nObservation paper\nNov 24, 2026 — Lesson plan due at 6 PM',2027)
    assert len(result)==3
    assert result[0]['localDate']=='2026-11-24T18:00'
    assert result[1]['localDate']=='2027-12-02T23:59'
    assert result[2]['localDate']=='2027-12-03T23:59'
    assert 'Observation paper' in result[2]['text'] and result[2]['warnings']
    assert len(file_tools.deadlines('No dates here',2026))==0


def test_wrong_extension_broken_file_and_limits(tmp_path):
    with pytest.raises(ValueError,match='Choose a .png'):file_tools.convert(image('PNG'),'bad.jpg','png-jpeg',tmp_path)
    with pytest.raises(ValueError,match='content does not match'):file_tools.convert(image('JPEG'),'bad.png','png-jpeg',tmp_path)
    with pytest.raises(ValueError):file_tools.open_pdf(pdf(101))
    with pytest.raises(ValueError):file_tools.deadlines('Nov 2',1900)
    assert file_tools.safe_name('../../notes')=='notes'


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(server,'DATA',tmp_path)
    with TestClient(server.app,base_url=server.BASE) as client:yield client


def test_local_api_conversion_extraction_csrf_and_cleanup(client,tmp_path,monkeypatch):
    assert client.post('/api/files/convert?filename=x.png&operation=png-jpeg',content=image('PNG')).status_code==403
    headers={'X-Midnight-Token':server.CSRF,'Content-Type':'application/octet-stream'}
    response=client.post('/api/files/convert?filename=x.png&operation=png-jpeg',content=image('PNG'),headers=headers)
    assert response.status_code==200 and response.content.startswith(b'\xff\xd8')
    assert response.headers['cache-control']=='no-store' and 'attachment' in response.headers['content-disposition']
    response=client.post('/api/files/extract?filename=class.docx&year=2026',content=docx('November 24 — Lesson plan due at 6 PM'),headers=headers)
    assert response.status_code==200 and len(response.json()['candidates'])==1
    assert not list(tmp_path.iterdir())
    response=client.post('/api/files/convert?filename=x.png&operation=png-jpeg',content=b'broken',headers=headers)
    assert response.status_code==400
    response=client.post('/api/files/convert?filename=x.png&operation=png-jpeg',content=b'',headers={**headers,'Content-Length':str(file_tools.MAX_INPUT+1)})
    assert response.status_code==413
    assert len(client.get('/api/files/options').json()['conversions'])==20
    assert len(client.get('/api/sounds').json()['recordings'])==4


def test_word_rejects_external_images(tmp_path):
    data=io.BytesIO(docx('External image'))
    with zipfile.ZipFile(data,'a') as archive:archive.writestr('word/_rels/document.xml.rels','<Relationships><Relationship TargetMode="External" Type="image" Target="http://127.0.0.1:9000/secret"/></Relationships>')
    with pytest.raises(ValueError,match='external resources'):file_tools.convert(data.getvalue(),'linked.docx','word-pdf',tmp_path)
