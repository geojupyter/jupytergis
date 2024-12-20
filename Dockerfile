FROM python:3.12

ARG VERSION="latest"
LABEL org.opencontainers.image.version=${VERSION}

# TODO: Install QGIS

RUN if [ "${VERSION}" != "latest" ]; then \
      pip install "jupytergis==${VERSION}"; \
    else \
      pip install jupytergis; \
    fi
