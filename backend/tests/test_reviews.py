from app.routers.reviews import summarize


def test_summary():
    s = summarize([5, 5, 4, 3])
    assert s["count"] == 4 and s["average"] == 4.2 and s["stars"][5] == 2 and s["stars"][1] == 0
    assert summarize([])["average"] == 0
