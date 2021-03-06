./swaggerly \
    -spec-dir=petstore \
    -bind-addr=0.0.0.0:3123 \
    -spec-rewrite-url=api.uber.com=API.UBER.COM \
    -document-rewrite-url=www.google.com=www.google.co.uk \
    -site-url=http://127.0.0.1:3123 \
    -assets-dir=./examples/markdown/assets \
    -log-level=trace
