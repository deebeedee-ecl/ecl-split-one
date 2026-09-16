FROM mcr.microsoft.com/playwright:v1.63.0-jammy

WORKDIR /app

RUN curl -fsSL -o /tmp/google-chrome-stable.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
  && dpkg -i /tmp/google-chrome-stable.deb \
  && rm -f /tmp/google-chrome-stable.deb \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["npm", "start"]
