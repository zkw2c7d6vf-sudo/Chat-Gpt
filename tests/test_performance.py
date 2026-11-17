"""Deterministic concurrency checks; no network, accounts, or device calls."""
import asyncio
import threading
from unittest.mock import patch
import server


def test_news_bounded_parallel_shared_and_ordered():
    async def run():
        server.CACHE.clear()
        feeds = [f'https://example.com/{i}' for i in range(12)]
        entered = threading.Event()
        release = threading.Event()
        guard = threading.Lock()
        calls = []
        active = peak = 0

        def fetch(url):
            nonlocal active, peak
            with guard:
                calls.append(url)
                active += 1
                peak = max(peak, active)
                if active == 4:
                    entered.set()
            assert release.wait(5)
            with guard:
                active -= 1
            if url.endswith('/3'):
                raise OSError('offline')
            return [{'title': url}]

        # Each test owns its event-loop-bound primitives.
        with patch.object(server, 'config', return_value={'feeds': feeds}), patch.object(server, 'news_fetch', fetch), patch.object(server, 'feed_slots', asyncio.Semaphore(4)), patch.object(server, 'feed_pending', {}):
            first = asyncio.create_task(server.news())
            second = asyncio.create_task(server.news())
            try:
                assert await asyncio.to_thread(entered.wait, 5)
            finally:
                release.set()
            a, b = await asyncio.gather(first, second)
            assert a == b
            assert [item['title'] for item in a['articles']] == [url for url in feeds if not url.endswith('/3')]
            assert len(a['errors']) == 1
            assert len(calls) == 12 and peak == 4
            assert not server.feed_pending
    asyncio.run(run())


def test_feed_invalidation_during_fetch_does_not_restore_old_cache():
    async def run():
        server.CACHE.clear()
        entered = threading.Event()
        release = threading.Event()
        def fetch(url):
            entered.set()
            assert release.wait(5)
            return [{'title': 'old settings'}]
        with patch.object(server, 'news_fetch', fetch), patch.object(server, 'feed_slots', asyncio.Semaphore(4)), patch.object(server, 'feed_pending', {}):
            pending = asyncio.create_task(server.cached_feed('https://example.com/feed'))
            try:
                assert await asyncio.to_thread(entered.wait, 5)
                server.invalidate_cache()
            finally:
                release.set()
            await pending
            assert ('rss', 'https://example.com/feed') not in server.CACHE
    asyncio.run(run())


def test_closing_one_request_does_not_cancel_shared_feed():
    async def run():
        server.CACHE.clear()
        entered = threading.Event()
        release = threading.Event()
        calls = []
        def fetch(url):
            calls.append(url)
            entered.set()
            assert release.wait(5)
            return [{'title': 'shared'}]
        with patch.object(server, 'news_fetch', fetch), patch.object(server, 'feed_slots', asyncio.Semaphore(4)), patch.object(server, 'feed_pending', {}):
            first = asyncio.create_task(server.cached_feed('https://example.com/feed'))
            second = asyncio.create_task(server.cached_feed('https://example.com/feed'))
            try:
                assert await asyncio.to_thread(entered.wait, 5)
                first.cancel()
                try:
                    await first
                except asyncio.CancelledError:
                    pass
            finally:
                release.set()
            assert await second == [{'title': 'shared'}]
            assert len(calls) == 1
    asyncio.run(run())
