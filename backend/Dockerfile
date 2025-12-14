FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Environment variables should be passed by docker-compose, 
# but we expose the port
EXPOSE 3001

CMD ["npm", "start"]
