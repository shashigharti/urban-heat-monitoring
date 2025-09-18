FROM node:20 AS frontend-build
WORKDIR /app/client

COPY client/ ./
RUN npm install && npm run build

FROM python:3.12-slim
WORKDIR /app/server

COPY server/ ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=frontend-build /app/client/build ./static

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
