
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm install

RUN if [ -f node_modules/@xbibzlibrary/whatsbibz/lib/Utils/sound-sticker.js ]; then \
      sed -i 's/fps=12/fps=24/g' node_modules/@xbibzlibrary/whatsbibz/lib/Utils/sound-sticker.js; \
    else \
      echo "File sound-sticker.js tidak ditemukan"; \
    fi

COPY . .

CMD ["npm", "start"]
