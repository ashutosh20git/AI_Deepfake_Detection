# deepfake-detector

[![CI](https://github.com/OWNER/deepfake-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/deepfake-detector/actions/workflows/ci.yml)

Containerized Node.js + Express project with Postgres and a Python FastAPI service.

## Prerequisites
- Docker
- Docker Compose

## Quick Start
1. `cp .env.example .env`
2. Configure `.env` with your desired credentials.
3. `docker-compose up --build`

## Architecture

```text
+----------------+      +----------------+      +------------------+
|                |      |                |      |                  |
|  Node.js API   +----->+  ML Service    |      |  PostgreSQL DB   |
|  (Port 3000)   |      |  (Port 8000)   |      |  (Port 5432)     |
|                |      |                |      |                  |
+-------+--------+      +----------------+      +---------+--------+
        |                                                 ^
        +-------------------------------------------------+
```
