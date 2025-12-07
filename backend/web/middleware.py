import time
import logging

from django.utils.deprecation import MiddlewareMixin


logger = logging.getLogger("web.middleware")


class RequestTimingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_ts = time.perf_counter()

    def process_response(self, request, response):
        try:
            dur_ms = (time.perf_counter() - getattr(request, "_start_ts", time.perf_counter())) * 1000
            logger.info("%s %s -> %s (%.1f ms)", request.method, request.path, getattr(response, "status_code", ""), dur_ms)
        except Exception:
            pass
        return response

