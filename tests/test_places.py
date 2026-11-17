"""Town labels resolve locally, including locations whose timezone names differ."""
import pytest
from fastapi.testclient import TestClient
import server
from places import nearest_town

@pytest.mark.parametrize('lat,lon,name',[(42.8864,-78.8784,'Buffalo'),(43,-78.75,'Williamsville'),(-33.8688,151.2093,'Sydney')])
def test_nearest_town_is_a_place_not_a_timezone(lat,lon,name):
    assert nearest_town(lat,lon)['name'] == name


def test_remote_ocean_does_not_claim_a_town():
    assert nearest_town(0,-140)['name'] == ''


def test_local_endpoint_and_validation(monkeypatch):
    import httpx
    monkeypatch.setattr(httpx,'AsyncClient',lambda *a,**k:pytest.fail('Town lookup must stay local'))
    with TestClient(server.app,base_url=server.BASE) as client:
        data=client.get('/api/weather/place?lat=42.8864&lon=-78.8784').json()
        assert data['name']=='Buffalo' and data['source']=='GeoNames'
        assert client.get('/api/weather/place?lat=91&lon=0').status_code==400
        assert client.get('/api/weather/place?lat=0&lon=nan').status_code==400
