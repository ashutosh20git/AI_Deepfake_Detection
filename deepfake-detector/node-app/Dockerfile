FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl openssl-dev

COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
