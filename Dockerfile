FROM node:22

WORKDIR /app
COPY package*.json ./
# Schema must be present before npm install: the postinstall script runs `prisma generate`
COPY prisma ./prisma

RUN npm install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
