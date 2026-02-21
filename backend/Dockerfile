FROM node:20-alpine

# Install LibreOffice for DOCX->PDF conversion
RUN apk add --no-cache libreoffice font-noto font-noto-cjk ttf-freefont

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript
RUN npm run build || true

# Expose port
EXPOSE 3000

# Start script: migrate + seed + run
CMD sh -c "npx prisma migrate deploy && npx prisma db seed || true; npm run dev"
