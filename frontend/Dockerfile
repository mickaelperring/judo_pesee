FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Dev mode default
CMD ["npm", "run", "dev"]