FROM node:22
RUN apt-get update && apt-get install -y nodejs npm

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --omit=dev

# Bundle app source
COPY . ./

#server.js port
EXPOSE 3002
CMD ["npm", "start"]