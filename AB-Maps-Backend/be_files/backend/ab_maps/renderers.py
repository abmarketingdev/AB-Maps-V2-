from rest_framework.renderers import BaseRenderer


class NDJSONRenderer(BaseRenderer):
    media_type = 'application/x-ndjson'
    format = 'ndjson'
    charset = None
    render_style = 'text'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # This renderer exists primarily to satisfy DRF content negotiation
        # for Accept: application/x-ndjson. Our views return StreamingHttpResponse
        # and will set the correct Content-Type and stream the body directly.
        if data is None:
            return b''
        if isinstance(data, (bytes, bytearray)):
            return data
        text = str(data)
        return text.encode('utf-8')


