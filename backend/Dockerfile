# Start with the official Node.js 18 slim image
FROM node:18-slim

# Install Python 3, pip, virtualenv, and build essentials
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy python requirements
COPY requirements.txt ./

# Set up Python virtual environment and install requirements
RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Expose port (express default is 5000 in server.js)
EXPOSE 5000

# Set virtual env python as the default python command path
ENV PATH="/app/venv/bin:$PATH"

# Start Express server
CMD ["node", "server.js"]
