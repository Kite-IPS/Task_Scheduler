FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Build argument for API URL (default to localhost, override for production)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build the app
RUN npm run build

# Install serve to run the application
RUN npm install -g serve

# Expose port 80
EXPOSE 80

# Start the app
CMD ["serve", "-s", "dist", "-l", "80"]